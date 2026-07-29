"""In-memory token-bucket rate limiting — M6 production ops.

Single-process, dependency-free (no Redis): each Uvicorn worker/pod keeps
its own buckets keyed by ``route:ip[:user]``. This under-counts true global
rate when the API runs with N>1 replicas (each pod allows up to the
configured rate independently) — acceptable for the current deployment size
and dramatically simpler than wiring a shared store; revisit with a Redis
(or Postgres advisory-lock) backend if/when horizontal scale makes the
per-pod undercount a real abuse vector.

Usage — as a FastAPI dependency::

    from services.shared.rate_limit import rate_limit

    @router.post("/api/v1/auth/login", dependencies=[Depends(rate_limit("login"))])
    def login(...): ...

Limits are configured via env, e.g. ``RATE_LIMIT_LOGIN=20/min``
(``services.shared.config`` documents the defaults). A blocked request gets
``429`` with a ``Retry-After`` header.
"""

from __future__ import annotations

import os
import threading
import time
from dataclasses import dataclass
from typing import Callable

from fastapi import HTTPException, Request

_DEFAULT_SPECS: dict[str, str] = {
    "login": "20/min",
    "upload": "30/min",
    "coach_ask": "30/min",
    "sql_exec": "60/min",
    "site_contact": "10/min",
}

_UNIT_SECONDS: dict[str, float] = {
    "s": 1.0,
    "sec": 1.0,
    "second": 1.0,
    "seconds": 1.0,
    "m": 60.0,
    "min": 60.0,
    "minute": 60.0,
    "minutes": 60.0,
    "h": 3600.0,
    "hour": 3600.0,
    "hours": 3600.0,
}


def parse_rate_spec(spec: str) -> tuple[float, float]:
    """``"20/min"`` -> ``(capacity=20.0, refill_per_sec=20/60)``.

    Falls back to ``20/min`` on any malformed input rather than raising —
    a typo'd env var should degrade to "rate limited" behavior, not crash
    the app at import time.
    """
    try:
        count_s, _, unit_s = (spec or "").partition("/")
        count = float(count_s)
        if count <= 0:
            raise ValueError("count must be positive")
    except Exception:
        count = 20.0
        unit_s = "min"
    seconds = _UNIT_SECONDS.get((unit_s or "min").strip().lower(), 60.0)
    return count, count / seconds


@dataclass
class _Bucket:
    tokens: float
    updated_at: float


class TokenBucketLimiter:
    """One instance per named route; buckets are keyed by caller identity."""

    def __init__(self, capacity: float, refill_per_sec: float, *, max_keys: int = 20_000) -> None:
        self.capacity = capacity
        self.refill_per_sec = refill_per_sec
        self._buckets: dict[str, _Bucket] = {}
        self._lock = threading.Lock()
        self._max_keys = max_keys

    def check(self, key: str) -> tuple[bool, float]:
        """Consume one token for ``key``. Returns ``(allowed, retry_after_seconds)``."""
        now = time.monotonic()
        with self._lock:
            if len(self._buckets) > self._max_keys:
                stale = [k for k, b in self._buckets.items() if now - b.updated_at > 600]
                for k in stale:
                    self._buckets.pop(k, None)
            bucket = self._buckets.get(key)
            if bucket is None:
                bucket = _Bucket(tokens=self.capacity, updated_at=now)
                self._buckets[key] = bucket
            else:
                elapsed = max(0.0, now - bucket.updated_at)
                bucket.tokens = min(self.capacity, bucket.tokens + elapsed * self.refill_per_sec)
                bucket.updated_at = now
            if bucket.tokens >= 1.0:
                bucket.tokens -= 1.0
                return True, 0.0
            retry_after = (1.0 - bucket.tokens) / self.refill_per_sec if self.refill_per_sec > 0 else 60.0
            return False, retry_after

    def reset(self) -> None:
        with self._lock:
            self._buckets.clear()


_limiters: dict[str, TokenBucketLimiter] = {}
_limiters_lock = threading.Lock()


def _limiter_for(route: str) -> TokenBucketLimiter:
    with _limiters_lock:
        limiter = _limiters.get(route)
        if limiter is not None:
            return limiter
        spec = os.getenv(f"RATE_LIMIT_{route.upper()}", _DEFAULT_SPECS.get(route, "60/min"))
        capacity, refill = parse_rate_spec(spec)
        limiter = TokenBucketLimiter(capacity, refill)
        _limiters[route] = limiter
        return limiter


def _client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _bucket_key(request: Request, route: str) -> str:
    user = getattr(request.state, "user", None)
    user_id = getattr(user, "id", None)
    ip = _client_ip(request)
    return f"{route}:ip:{ip}:user:{user_id}" if user_id else f"{route}:ip:{ip}"


def rate_limit(route: str) -> Callable[[Request], None]:
    """FastAPI dependency factory — ``Depends(rate_limit("login"))``."""

    def _dependency(request: Request) -> None:
        limiter = _limiter_for(route)
        allowed, retry_after = limiter.check(_bucket_key(request, route))
        if not allowed:
            retry_after_hdr = str(max(1, int(retry_after) + 1))
            raise HTTPException(
                status_code=429,
                detail="请求过于频繁，请稍后再试",
                headers={"Retry-After": retry_after_hdr},
            )

    return _dependency


def reset_all() -> None:
    """Test helper — clears every route's buckets and forces re-reading env."""
    with _limiters_lock:
        for limiter in _limiters.values():
            limiter.reset()
        _limiters.clear()
