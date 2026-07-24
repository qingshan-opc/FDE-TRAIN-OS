"""Certificate on-chain anchoring — M6 production ops.

Dev/stub mode generates a deterministic content hash and a pseudo transaction
hash stored in ``certificate_issuances.meta_json``. Production can swap the
backend via ``CHAIN_PROVIDER=http`` + ``CHAIN_HTTP_URL``.

Compliance: only certificate metadata is anchored — never raw ID numbers.
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
from typing import Any
from uuid import uuid4

from services.shared import now_iso

log = logging.getLogger("fde.chain")


def _content_hash(payload: dict[str, Any]) -> str:
    canonical = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def anchor_certificate(
    *,
    cert_id: str,
    user_id: str,
    course_title: str,
    issued_at: str,
    masked_name: str | None = None,
    id_tail: str | None = None,
) -> dict[str, Any]:
    """Return chain metadata to merge into certificate meta_json."""
    payload = {
        "cert_id": cert_id,
        "user_id": user_id,
        "course_title": course_title,
        "issued_at": issued_at,
        "masked_name": masked_name,
        "id_tail": id_tail,
    }
    content_hash = _content_hash(payload)
    provider = (os.getenv("CHAIN_PROVIDER") or "stub").strip().lower()

    if provider == "http":
        base = (os.getenv("CHAIN_HTTP_URL") or "").rstrip("/")
        if base:
            try:
                import httpx

                with httpx.Client(timeout=15.0) as client:
                    resp = client.post(
                        f"{base}/anchor",
                        json={"cert_id": cert_id, "content_hash": content_hash, "payload": payload},
                    )
                    resp.raise_for_status()
                    data = resp.json()
                    return {
                        "chain_provider": "http",
                        "chain_network": data.get("network") or "custom",
                        "chain_tx_hash": str(data.get("tx_hash") or data.get("transaction_id") or ""),
                        "chain_content_hash": content_hash,
                        "chain_anchor_at": data.get("anchored_at") or now_iso(),
                    }
            except Exception as exc:
                log.warning("chain http anchor failed for %s, falling back to stub: %s", cert_id, exc)

    # Stub / fallback — deterministic pseudo tx for dev verification UX
    pseudo = hashlib.sha256(f"{content_hash}:{cert_id}".encode()).hexdigest()
    return {
        "chain_provider": "stub",
        "chain_network": os.getenv("CHAIN_NETWORK", "FDE-Trust-Stub"),
        "chain_tx_hash": f"0x{pseudo[:64]}",
        "chain_content_hash": content_hash,
        "chain_anchor_at": now_iso(),
        "chain_anchor_id": f"anchor-{uuid4().hex[:12]}",
    }
