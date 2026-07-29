"""KYC (real-name identity verification) provider adapter — M6 production ops.

Compliance constraint that shapes this whole module: the platform must
*never* persist a learner's raw ID number or a face/selfie image. Every
provider implementation here returns only an opaque ``provider_ref`` plus a
coarse ``status`` — any human-entered name/ID text is masked (``mask_name`` /
``mask_id_tail``) *before* it reaches a DB write in ``services.learner.app``.

Two providers ship today:

- ``StubKycProvider`` — dev/demo default. Starts a verification in
  ``pending`` state; a human (or a test) flips it to ``verified``/``rejected``
  via the dev-only webhook (``POST /api/v1/me/identity/webhook``, itself
  disabled whenever ``FDE_ENV=prod``).
- ``EnvKycProvider`` — thin HTTP adapter for a real vendor reachable at
  ``KYC_HTTP_URL``. This module intentionally knows nothing about *which*
  vendor — the vendor-specific contract lives behind that URL.

Selected via ``KYC_PROVIDER=stub|http`` (see ``get_kyc_provider``).
"""

from __future__ import annotations

import logging
import os
from typing import Any, Protocol, runtime_checkable
from uuid import uuid4

log = logging.getLogger("fde.kyc")


@runtime_checkable
class KycProvider(Protocol):
    """Every provider exposes a stable ``name`` and a single verb."""

    name: str

    def start_verification(self, user_id: str, return_url: str) -> dict[str, Any]:
        """Kick off a verification attempt.

        Returns ``{"provider_ref": str, "status": str}`` — ``status`` is one
        of ``pending|verified|rejected``. Must never return (or accept) a raw
        ID number or biometric image; those stay entirely on the provider's
        side of ``provider_ref``.
        """
        ...


class StubKycProvider:
    """Dev/demo provider — no external calls, always starts ``pending``."""

    name = "stub"

    def start_verification(self, user_id: str, return_url: str) -> dict[str, Any]:
        ref = f"stub-{uuid4().hex[:20]}"
        log.info("stub KYC start_verification user_id=%s provider_ref=%s", user_id, ref)
        return {"provider_ref": ref, "status": "pending"}


class EnvKycProvider:
    """HTTP adapter over ``KYC_HTTP_URL`` — ``POST {base}/start``.

    Expected upstream response shape: ``{"provider_ref"|"id": str, "status": str}``.
    Any transport/response failure raises — callers must not silently treat
    an unreachable KYC provider as "verified" or "skip verification".
    """

    name = "http"

    def __init__(self, base_url: str) -> None:
        self._base_url = (base_url or "").rstrip("/")

    def start_verification(self, user_id: str, return_url: str) -> dict[str, Any]:
        if not self._base_url:
            raise RuntimeError("KYC_HTTP_URL is not configured (KYC_PROVIDER=http)")
        import httpx

        try:
            with httpx.Client(timeout=10.0) as client:
                resp = client.post(
                    f"{self._base_url}/start",
                    json={"user_id": user_id, "return_url": return_url},
                )
                resp.raise_for_status()
                data = resp.json()
        except Exception as exc:
            log.error("KYC http provider start_verification failed: %s", exc)
            raise RuntimeError(f"KYC provider unavailable: {exc}") from exc
        ref = str(data.get("provider_ref") or data.get("id") or uuid4().hex)
        status = str(data.get("status") or "pending")
        if status not in ("pending", "verified", "rejected"):
            status = "pending"
        return {"provider_ref": ref, "status": status}


def mask_name(name: str | None) -> str | None:
    """姓名打码：仅保留首字，其余替换为 `*`；真实姓名从不落库。"""
    if not name:
        return None
    name = name.strip()
    if not name:
        return None
    if len(name) <= 1:
        return name
    return name[0] + "*" * (len(name) - 1)


def mask_id_tail(id_number: str | None) -> str | None:
    """证件号打码：仅保留末 6 位；其余字符（含真实证件号全文）从不落库。"""
    if not id_number:
        return None
    value = id_number.strip()
    if not value:
        return None
    return value[-6:] if len(value) >= 6 else "*" * len(value)


def matches_name(submitted_name: str | None, stored_masked: str | None) -> bool:
    """Compare a user-entered name against stored masked_name."""
    if not submitted_name or not stored_masked:
        return False
    return mask_name(submitted_name.strip()) == stored_masked.strip()


from services.chain.hash_utils import hash_id_number  # noqa: F401 — re-export for KYC callers


def matches_id_tail(submitted_tail: str | None, stored_tail: str | None) -> bool:
    """Compare user-entered ID tail (6 digits) against stored id_tail."""
    if not submitted_tail or not stored_tail:
        return False
    sub = submitted_tail.strip()
    if not sub.isdigit() or len(sub) != 6:
        return False
    stored = stored_tail.strip()
    if len(stored) == 4:
        return sub[-4:] == stored
    if len(stored) >= 6:
        return sub == stored[-6:]
    return sub.endswith(stored)


def get_kyc_provider(override: str | None = None) -> KycProvider:
    """Factory reading ``KYC_PROVIDER`` (+ ``KYC_HTTP_URL``) at call time.

    Reading env lazily (rather than caching at import time) keeps this
    trivially testable via ``monkeypatch.setenv`` without needing to reload
    the module.
    """
    kind = (override or os.getenv("KYC_PROVIDER", "stub")).strip().lower()
    if kind == "http":
        return EnvKycProvider(os.getenv("KYC_HTTP_URL", ""))
    return StubKycProvider()
