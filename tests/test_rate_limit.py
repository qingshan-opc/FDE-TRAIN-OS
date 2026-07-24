"""Token-bucket rate limiter unit tests (services.shared.rate_limit).

Pure in-memory logic — no DB/network needed. Uses tiny fake Request-like
objects (only the attributes `rate_limit`'s dependency reads) rather than a
real Starlette Request, keeping this fast and independent of the running API.
"""

from __future__ import annotations

import time

import pytest
from fastapi import HTTPException

from services.shared.rate_limit import TokenBucketLimiter, parse_rate_spec, rate_limit, reset_all


@pytest.fixture(autouse=True)
def _reset_limiters():
    reset_all()
    yield
    reset_all()


def test_parse_rate_spec_minutes():
    capacity, refill = parse_rate_spec("20/min")
    assert capacity == 20
    assert refill == pytest.approx(20 / 60)


def test_parse_rate_spec_seconds():
    capacity, refill = parse_rate_spec("5/s")
    assert capacity == 5
    assert refill == pytest.approx(5.0)


def test_parse_rate_spec_hours():
    capacity, refill = parse_rate_spec("120/hour")
    assert capacity == 120
    assert refill == pytest.approx(120 / 3600)


def test_parse_rate_spec_malformed_falls_back_to_20_per_min():
    capacity, refill = parse_rate_spec("garbage")
    assert capacity == 20.0
    assert refill == pytest.approx(20 / 60)


def test_token_bucket_allows_up_to_capacity_then_blocks():
    limiter = TokenBucketLimiter(capacity=3, refill_per_sec=0.0)
    assert limiter.check("k")[0] is True
    assert limiter.check("k")[0] is True
    assert limiter.check("k")[0] is True
    allowed, retry_after = limiter.check("k")
    assert allowed is False
    assert retry_after > 0


def test_token_bucket_refills_over_time():
    limiter = TokenBucketLimiter(capacity=1, refill_per_sec=1000.0)
    assert limiter.check("k")[0] is True
    assert limiter.check("k")[0] is False
    time.sleep(0.01)
    assert limiter.check("k")[0] is True


def test_token_bucket_keys_are_independent():
    limiter = TokenBucketLimiter(capacity=1, refill_per_sec=0.0)
    assert limiter.check("a")[0] is True
    assert limiter.check("b")[0] is True
    assert limiter.check("a")[0] is False


class _FakeUser:
    def __init__(self, id: str) -> None:
        self.id = id


class _FakeState:
    def __init__(self, user=None) -> None:
        self.user = user


class _FakeClient:
    def __init__(self, host: str) -> None:
        self.host = host


class _FakeRequest:
    def __init__(self, ip: str = "1.2.3.4", user=None, headers: dict | None = None) -> None:
        self.state = _FakeState(user)
        self.client = _FakeClient(ip)
        self.headers = headers or {}


def test_rate_limit_dependency_blocks_after_limit(monkeypatch):
    monkeypatch.setenv("RATE_LIMIT_TESTROUTE", "2/min")
    dep = rate_limit("testroute")
    req = _FakeRequest(ip="9.9.9.9")

    dep(req)
    dep(req)
    with pytest.raises(HTTPException) as exc_info:
        dep(req)

    assert exc_info.value.status_code == 429
    assert "Retry-After" in exc_info.value.headers
    assert int(exc_info.value.headers["Retry-After"]) >= 1


def test_rate_limit_dependency_separates_by_ip(monkeypatch):
    monkeypatch.setenv("RATE_LIMIT_TESTROUTE_IP", "1/min")
    dep = rate_limit("testroute_ip")

    dep(_FakeRequest(ip="1.1.1.1"))  # consumes the only token for this IP
    dep(_FakeRequest(ip="2.2.2.2"))  # different IP — independent bucket, must not raise


def test_rate_limit_dependency_separates_by_user(monkeypatch):
    monkeypatch.setenv("RATE_LIMIT_TESTROUTE_USER", "1/min")
    dep = rate_limit("testroute_user")

    dep(_FakeRequest(ip="3.3.3.3", user=_FakeUser("u1")))
    dep(_FakeRequest(ip="3.3.3.3", user=_FakeUser("u2")))  # same IP, different user — independent


def test_rate_limit_uses_x_forwarded_for_when_present(monkeypatch):
    monkeypatch.setenv("RATE_LIMIT_TESTROUTE_XFF", "1/min")
    dep = rate_limit("testroute_xff")

    dep(_FakeRequest(ip="10.0.0.1", headers={"x-forwarded-for": "8.8.8.8, 10.0.0.1"}))
    with pytest.raises(HTTPException):
        # Same X-Forwarded-For client IP behind a different proxy hop — still limited.
        dep(_FakeRequest(ip="10.0.0.2", headers={"x-forwarded-for": "8.8.8.8, 10.0.0.2"}))


def test_reset_all_clears_state_between_tests(monkeypatch):
    monkeypatch.setenv("RATE_LIMIT_TESTROUTE_RESET", "1/min")
    dep = rate_limit("testroute_reset")
    req = _FakeRequest(ip="5.5.5.5")

    dep(req)
    with pytest.raises(HTTPException):
        dep(req)

    reset_all()
    dep(req)  # fresh bucket after reset — must not raise
