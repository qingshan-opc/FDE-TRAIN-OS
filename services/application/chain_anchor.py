"""Certificate on-chain anchoring — FDE minimal certificate chain.

Default provider mines a real block in ``chain_blocks`` / ``chain_transactions``.
Public on chain: holder name, certificate metadata, SHA256(id_number) — never raw ID.

Compliance: raw ID numbers are hashed in-process at KYC and only the digest is stored
and anchored. See ``GET /api/v1/chain/algorithms`` for the public algorithm spec.
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
from typing import Any

from services.shared import now_iso

log = logging.getLogger("fde.chain")


def _content_hash(payload: dict[str, Any]) -> str:
    from services.chain.hash_utils import tx_content_hash

    return tx_content_hash(payload)


def anchor_certificate(
    *,
    cert_id: str,
    user_id: str,
    course_title: str,
    issued_at: str,
    holder_name: str | None = None,
    id_number_sha256: str | None = None,
    masked_name: str | None = None,
    id_tail: str | None = None,
    tx_type: str = "cert_issue",
    extra: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Mine a certificate transaction onto the FDE chain."""
    provider = (os.getenv("CHAIN_PROVIDER") or "fde").strip().lower()

    if provider == "http":
        base = (os.getenv("CHAIN_HTTP_URL") or "").rstrip("/")
        payload = {
            "cert_id": cert_id,
            "user_id": user_id,
            "course_title": course_title,
            "issued_at": issued_at,
            "holder_name": holder_name or masked_name,
            "id_number_sha256": id_number_sha256,
        }
        content_hash = _content_hash(payload)
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
                log.warning("chain http anchor failed for %s, falling back to fde: %s", cert_id, exc)

    if provider == "stub":
        payload = {
            "cert_id": cert_id,
            "user_id": user_id,
            "course_title": course_title,
            "issued_at": issued_at,
            "masked_name": masked_name,
            "id_tail": id_tail,
        }
        content_hash = _content_hash(payload)
        pseudo = hashlib.sha256(f"{content_hash}:{cert_id}".encode()).hexdigest()
        return {
            "chain_provider": "stub",
            "chain_network": os.getenv("CHAIN_NETWORK", "FDE-Trust-Stub"),
            "chain_tx_hash": f"0x{pseudo[:64]}",
            "chain_content_hash": content_hash,
            "chain_anchor_at": now_iso(),
        }

    from services.chain.ledger import anchor_certificate_tx

    name = (holder_name or masked_name or "").strip() or "—"
    try:
        meta = anchor_certificate_tx(
            cert_id=cert_id,
            holder_name=name,
            course_title=course_title,
            issued_at=issued_at,
            id_number_sha256=id_number_sha256,
            tx_type=tx_type,
            extra={"user_id": user_id, **(extra or {})} if user_id or extra else extra,
        )
        public = meta.pop("chain_public_payload", None)
        if public:
            meta["chain_holder_name"] = public.get("holder_name")
            meta["chain_id_number_sha256"] = public.get("id_number_sha256")
        return meta
    except Exception as exc:
        log.error("fde chain anchor failed for %s: %s", cert_id, exc, exc_info=True)
        raise
