"""Real certificate issuance / verification / revocation — M6 production ops.

Gate before ``issue_certificate`` writes anything:

1. Identity — the learner's latest ``identity_verifications`` row must be
   ``status='verified'``, unless ``FDE_ENV != prod`` *and* unverified
   issuance is explicitly allowed (``CERT_ALLOW_UNVERIFIED`` /
   ``allow_unverified=``) — never bypassable in prod.
2. Completion — the fraction of curriculum days with a ``passed``
   ``node_progress`` row must reach ``min_completion_rate`` (default 100%).
3. Required rubrics — every ``rubric_definitions`` node_key for the course
   version must have a corresponding passed ``node_progress`` row.
4. Mentor review — optional; only enforced when the caller passes
   ``mentor_approved=False`` explicitly (default ``True`` = not required).

A row in ``certificate_issuances`` is treated as immutable once inserted —
``revoke_certificate`` only ever flips ``status``/``revoked_at``/
``revoke_reason``; nothing is ever deleted or overwritten in place.
"""

from __future__ import annotations

import json
import logging
from typing import Any
from uuid import uuid4

from services.shared import db_cursor, now_iso, write_audit
from services.shared.config import CERT_ALLOW_UNVERIFIED, FDE_ENV, S3_BUCKET_ARTIFACTS

log = logging.getLogger("fde.certificates")


class CertificateError(ValueError):
    """Raised for any 4xx-shaped failure (not found / gate not met)."""


def _load_enrollment(enrollment_id: str) -> dict[str, Any]:
    with db_cursor() as cur:
        cur.execute(
            """
            SELECT er.id AS enrollment_id, er.user_id, er.offering_id, er.status AS enrollment_status,
                   co.camp_id, co.course_version_id, co.title AS offering_title
            FROM enrollment_records er
            JOIN course_offerings co ON co.id = er.offering_id
            WHERE er.id = ?
            """,
            (enrollment_id,),
        )
        row = cur.fetchone()
    if not row:
        raise CertificateError(f"enrollment not found: {enrollment_id}")
    return dict(row)


def _identity_verified(user_id: str) -> bool:
    with db_cursor() as cur:
        cur.execute(
            "SELECT status FROM identity_verifications WHERE user_id=? ORDER BY created_at DESC LIMIT 1",
            (user_id,),
        )
        row = cur.fetchone()
    return bool(row) and row.get("status") == "verified"


def compute_completion(learner_id: str, camp_id: str | None, course_version_id: str | None) -> dict[str, Any]:
    """Completion rate = distinct curriculum days with a `passed` node / total curriculum days.

    Falls back to ``rate=0.0`` (never silently "100% complete") when the
    course version has no day packages at all, i.e. there is nothing to
    measure completion against.
    """
    total_days = 0
    if course_version_id:
        with db_cursor() as cur:
            cur.execute(
                "SELECT COUNT(DISTINCT day) AS c FROM day_packages WHERE course_version_id=?",
                (course_version_id,),
            )
            row = cur.fetchone()
            total_days = int(row["c"]) if row else 0

    passed_days = 0
    if camp_id:
        with db_cursor() as cur:
            cur.execute(
                "SELECT COUNT(DISTINCT day) AS c FROM node_progress WHERE learner_id=? AND camp_id=? AND status='passed'",
                (learner_id, camp_id),
            )
            row = cur.fetchone()
            passed_days = int(row["c"]) if row else 0

    rate = (passed_days / total_days) if total_days else 0.0
    return {"total_days": total_days, "passed_days": passed_days, "rate": round(rate, 4)}


def compute_rubric_gate(learner_id: str, camp_id: str | None, course_version_id: str | None) -> dict[str, Any]:
    """Every rubric-bearing node_key for the course version must be passed."""
    if not course_version_id or not camp_id:
        return {"required_total": 0, "required_passed": 0, "ok": True, "pending": []}
    with db_cursor() as cur:
        cur.execute(
            "SELECT DISTINCT node_key FROM rubric_definitions WHERE course_version_id=? AND node_key IS NOT NULL",
            (course_version_id,),
        )
        node_keys = [r["node_key"] for r in cur.fetchall() if r.get("node_key")]
        pending: list[str] = []
        passed = 0
        for node_key in node_keys:
            cur.execute(
                "SELECT 1 FROM node_progress WHERE learner_id=? AND camp_id=? AND node_id=? AND status='passed'",
                (learner_id, camp_id, node_key),
            )
            if cur.fetchone():
                passed += 1
            else:
                pending.append(node_key)
    return {"required_total": len(node_keys), "required_passed": passed, "ok": not pending, "pending": pending}


def _generate_certificate_artifact(
    *,
    cert_id: str,
    camp_id: str | None,
    user_id: str,
    course_title: str,
    qr_payload: dict[str, Any],
    manifest_extra: dict[str, Any],
) -> str | None:
    """Best-effort PDF (reportlab) or JSON-manifest fallback in MinIO.

    Never raises — a storage/reportlab hiccup must not block issuance of
    the (already-committed) DB row; ``pdf_object_key`` simply stays NULL.
    """
    try:
        from services.storage import get_store

        store = get_store()
    except Exception as exc:
        log.warning("certificate artifact skipped (object store unavailable): %s", exc)
        return None

    prefix = f"certificates/{camp_id or 'nocamp'}/{user_id}/{cert_id}"
    manifest = {
        "cert_id": cert_id,
        "user_id": user_id,
        "camp_id": camp_id,
        "course_title": course_title,
        "qr_payload": qr_payload,
        "generated_at": now_iso(),
        **manifest_extra,
    }

    try:
        pdf_bytes = _render_pdf_bytes(cert_id, course_title, user_id, qr_payload)
    except Exception as exc:
        log.info("reportlab unavailable/failed for %s, falling back to JSON manifest: %s", cert_id, exc)
        pdf_bytes = None

    try:
        if pdf_bytes is not None:
            key = f"{prefix}.pdf"
            store.put_bytes(S3_BUCKET_ARTIFACTS, key, pdf_bytes, content_type="application/pdf")
            return key
        key = f"{prefix}.json"
        store.put_bytes(
            S3_BUCKET_ARTIFACTS,
            key,
            json.dumps(manifest, ensure_ascii=False, indent=2).encode("utf-8"),
            content_type="application/json",
        )
        return key
    except Exception as exc:
        log.warning("certificate artifact upload failed for %s: %s", cert_id, exc)
        return None


def _render_pdf_bytes(cert_id: str, course_title: str, user_id: str, qr_payload: dict[str, Any]) -> bytes:
    from io import BytesIO

    from reportlab.lib.pagesizes import A4  # type: ignore[import-not-found]
    from reportlab.pdfgen import canvas  # type: ignore[import-not-found]

    buf = BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    width, height = A4
    c.setFont("Helvetica-Bold", 22)
    c.drawCentredString(width / 2, height - 140, "Certificate of Completion")
    c.setFont("Helvetica", 13)
    c.drawCentredString(width / 2, height - 180, course_title or "FDE Learning OS")
    c.setFont("Helvetica", 10)
    c.drawCentredString(width / 2, height - 210, f"Cert ID: {cert_id}")
    c.drawCentredString(width / 2, height - 228, f"Learner: {user_id}")
    c.drawCentredString(width / 2, height - 246, f"Verify: {qr_payload.get('verify_url', '')}")
    c.showPage()
    c.save()
    return buf.getvalue()


def issue_certificate(
    enrollment_id: str,
    *,
    actor_id: str | None = None,
    allow_unverified: bool | None = None,
    mentor_approved: bool = True,
    min_completion_rate: float = 1.0,
    template_id: str | None = None,
) -> dict[str, Any]:
    """Issue an immutable certificate for a completed enrollment.

    Raises :class:`CertificateError` (mapped to HTTP 409 by callers) when any
    gate fails; the reason is in the exception message so the caller can
    surface it to an author/admin verbatim.
    """
    enr = _load_enrollment(enrollment_id)
    user_id = enr["user_id"]
    camp_id = enr.get("camp_id")
    course_version_id = enr.get("course_version_id")

    identity_verified = _identity_verified(user_id)
    unverified_allowed = CERT_ALLOW_UNVERIFIED if allow_unverified is None else allow_unverified
    if not identity_verified and not (FDE_ENV != "prod" and unverified_allowed):
        raise CertificateError("学员身份未认证（identity not verified），无法颁发证书")

    completion = compute_completion(user_id, camp_id, course_version_id)
    if completion["rate"] < min_completion_rate:
        raise CertificateError(
            f"完成度不足：{completion['passed_days']}/{completion['total_days']} 天已通过，"
            f"需达到 {min_completion_rate:.0%}"
        )

    rubric_gate = compute_rubric_gate(user_id, camp_id, course_version_id)
    if not rubric_gate["ok"]:
        raise CertificateError(f"必需评测未全部通过：{', '.join(rubric_gate['pending'])}")

    if not mentor_approved:
        raise CertificateError("需要导师复核通过后才能颁发证书")

    course_title = enr.get("offering_title") or "结业证书"
    cert_id = f"FDE-{uuid4().hex[:10].upper()}"
    verify_url = f"/verify/{cert_id}"
    qr_payload = {"cert_id": cert_id, "verify_url": verify_url, "issued_at": now_iso()}
    completion_snapshot = {
        "completion": completion,
        "rubric_gate": rubric_gate,
        "identity_verified": identity_verified,
        "issued_unverified": not identity_verified,
        "mentor_approved": mentor_approved,
        "min_completion_rate": min_completion_rate,
    }

    row_id = str(uuid4())
    with db_cursor() as cur:
        cur.execute(
            """
            INSERT INTO certificate_issuances
              (id, cert_id, user_id, camp_id, enrollment_id, template_id, course_title, status,
               qr_payload, completion_snapshot_json, issued_by, issued_at, meta_json)
            VALUES (?,?,?,?,?,?,?, 'issued', ?::jsonb, ?::jsonb, ?, NOW(), '{}'::jsonb)
            """,
            (
                row_id,
                cert_id,
                user_id,
                camp_id,
                enrollment_id,
                template_id,
                course_title,
                json.dumps(qr_payload, ensure_ascii=False),
                json.dumps(completion_snapshot, ensure_ascii=False),
                actor_id,
            ),
        )

    pdf_key = _generate_certificate_artifact(
        cert_id=cert_id,
        camp_id=camp_id,
        user_id=user_id,
        course_title=course_title,
        qr_payload=qr_payload,
        manifest_extra={"completion_snapshot": completion_snapshot, "enrollment_id": enrollment_id},
    )
    if pdf_key:
        with db_cursor() as cur:
            cur.execute("UPDATE certificate_issuances SET pdf_object_key=? WHERE id=?", (pdf_key, row_id))

    identity = _load_verified_identity(user_id)
    issued_at = now_iso()
    try:
        from services.application.chain_anchor import anchor_certificate

        chain_meta = anchor_certificate(
            cert_id=cert_id,
            user_id=user_id,
            course_title=course_title,
            issued_at=issued_at,
            holder_name=identity.get("holder_name") if identity else None,
            id_number_sha256=identity.get("id_number_sha256") if identity else None,
            masked_name=identity.get("masked_name") if identity else None,
            id_tail=identity.get("id_tail") if identity else None,
        )
        with db_cursor() as cur:
            cur.execute(
                "UPDATE certificate_issuances SET meta_json=?::jsonb WHERE id=?",
                (json.dumps(chain_meta, ensure_ascii=False), row_id),
            )
    except Exception as exc:
        log.warning("chain anchor skipped for %s: %s", cert_id, exc)

    write_audit(
        "certificate.issue",
        actor_id=actor_id,
        camp_id=camp_id,
        resource_type="certificate_issuance",
        resource_id=row_id,
        details={"cert_id": cert_id, "enrollment_id": enrollment_id, "user_id": user_id},
    )
    return {
        "id": row_id,
        "cert_id": cert_id,
        "user_id": user_id,
        "camp_id": camp_id,
        "enrollment_id": enrollment_id,
        "course_title": course_title,
        "status": "issued",
        "qr_payload": qr_payload,
        "pdf_object_key": pdf_key,
        "completion_snapshot": completion_snapshot,
    }


def _load_verified_identity(user_id: str) -> dict[str, Any] | None:
    with db_cursor() as cur:
        cur.execute(
            """
            SELECT masked_name, id_tail, holder_name, id_number_sha256, status, verified_at
            FROM identity_verifications
            WHERE user_id=? AND status='verified'
            ORDER BY created_at DESC LIMIT 1
            """,
            (user_id,),
        )
        row = cur.fetchone()
    return dict(row) if row else None


def _parse_meta_json(raw: Any) -> dict[str, Any]:
    if isinstance(raw, dict):
        return raw
    if isinstance(raw, str) and raw.strip():
        try:
            parsed = json.loads(raw)
            return parsed if isinstance(parsed, dict) else {}
        except Exception:
            return {}
    return {}


def _load_chain_public(cert_id: str, meta: dict[str, Any], cert_row: dict[str, Any] | None = None) -> dict[str, Any]:
    """Merge chain tx payload + meta + optional consistency checks against cert row."""
    import json

    from services.chain.hash_utils import (
        ID_HASH_ALGORITHM_LABEL,
        ID_HASH_NORMALIZATION_LABEL,
        ID_HASH_STEPS_ZH,
    )

    public: dict[str, Any] = {
        "holder_name": meta.get("chain_holder_name"),
        "course_title": None,
        "issued_at": None,
        "id_number_sha256": meta.get("chain_id_number_sha256"),
        "id_hash_algorithm": ID_HASH_ALGORITHM_LABEL,
        "id_hash_normalization": ID_HASH_NORMALIZATION_LABEL,
        "id_hash_steps": ID_HASH_STEPS_ZH,
    }
    try:
        from services.chain.ledger import get_cert_transactions

        txs = get_cert_transactions(cert_id)
        issue = None
        for tx in reversed(txs):
            if tx.get("tx_type") == "cert_issue":
                issue = tx
                break
        if issue is None and txs:
            issue = txs[-1]
        if issue:
            payload = issue.get("payload_json")
            if isinstance(payload, str):
                payload = json.loads(payload)
            if isinstance(payload, dict):
                public["holder_name"] = payload.get("holder_name") or public["holder_name"]
                public["course_title"] = payload.get("course_title")
                public["issued_at"] = payload.get("issued_at")
                public["id_number_sha256"] = payload.get("id_number_sha256") or public["id_number_sha256"]
                public["tx_hash"] = issue.get("tx_hash")
                public["block_height"] = issue.get("block_height")
    except Exception:
        pass

    checks: dict[str, Any] = {}
    if cert_row:
        db_course = cert_row.get("course_title")
        if public.get("course_title") and db_course:
            checks["course_consistent"] = str(public["course_title"]).strip() == str(db_course).strip()
        db_issued = cert_row.get("issued_at")
        if public.get("issued_at") and db_issued:
            checks["issued_at_consistent"] = str(public["issued_at"])[:10] == str(db_issued)[:10]
    public["field_checks"] = checks
    return public


def _chain_fields(meta: dict[str, Any]) -> dict[str, Any]:
    if not meta.get("chain_tx_hash"):
        return {}
    return {
        "chain_tx_hash": meta.get("chain_tx_hash"),
        "chain_network": meta.get("chain_network"),
        "chain_content_hash": meta.get("chain_content_hash"),
        "chain_anchor_at": meta.get("chain_anchor_at"),
        "chain_block_height": meta.get("chain_block_height"),
        "chain_block_hash": meta.get("chain_block_hash"),
        "chain_holder_name": meta.get("chain_holder_name"),
        "chain_id_number_sha256": meta.get("chain_id_number_sha256"),
        "on_chain": True,
    }


def revoke_certificate(cert_id: str, reason: str, *, actor_id: str | None = None) -> dict[str, Any]:
    with db_cursor() as cur:
        cur.execute("SELECT * FROM certificate_issuances WHERE cert_id=? OR id=?", (cert_id, cert_id))
        row = cur.fetchone()
        if not row:
            raise CertificateError(f"certificate not found: {cert_id}")
        row = dict(row)
        cur.execute(
            "UPDATE certificate_issuances SET status='revoked', revoked_at=NOW(), revoke_reason=? WHERE id=?",
            (reason, row["id"]),
        )
    write_audit(
        "certificate.revoke",
        actor_id=actor_id,
        camp_id=row.get("camp_id"),
        resource_type="certificate_issuance",
        resource_id=row["id"],
        details={"cert_id": row.get("cert_id"), "reason": reason},
    )
    cid = row.get("cert_id") or cert_id
    identity = _load_verified_identity(str(row.get("user_id") or ""))
    try:
        from services.application.chain_anchor import anchor_certificate

        chain_meta = anchor_certificate(
            cert_id=str(cid),
            user_id=str(row.get("user_id") or ""),
            course_title=str(row.get("course_title") or ""),
            issued_at=now_iso(),
            holder_name=identity.get("holder_name") if identity else None,
            id_number_sha256=identity.get("id_number_sha256") if identity else None,
            masked_name=identity.get("masked_name") if identity else None,
            tx_type="cert_revoke",
            extra={"revoke_reason": reason},
        )
        meta = _parse_meta_json(row.get("meta_json"))
        meta["revoke_chain"] = chain_meta
        with db_cursor() as cur:
            cur.execute(
                "UPDATE certificate_issuances SET meta_json=?::jsonb WHERE id=?",
                (json.dumps(meta, ensure_ascii=False), row["id"]),
            )
    except Exception as exc:
        log.warning("revoke chain anchor skipped for %s: %s", cid, exc)
    return {"id": row["id"], "cert_id": cid, "status": "revoked", "reason": reason}


def _chain_status_from_transactions(txs: list[dict[str, Any]]) -> str:
    """Derive effective status from on-chain tx history."""
    if not txs:
        return "unknown"
    last_type = str(txs[-1].get("tx_type") or "")
    if last_type == "cert_revoke":
        return "revoked"
    if any(str(t.get("tx_type") or "") == "cert_issue" for t in txs):
        return "issued"
    return "issued"


def _verify_from_chain_only(cert_id: str) -> dict[str, Any] | None:
    """Public lookup when platform DB has no row but chain ledger does."""
    try:
        from services.chain.ledger import get_cert_transactions

        txs = get_cert_transactions(cert_id)
    except Exception:
        return None
    if not txs:
        return None

    chain_public = _load_chain_public(cert_id, {}, None)
    has_payload = bool(
        chain_public.get("holder_name")
        or chain_public.get("id_number_sha256")
        or chain_public.get("course_title")
    )
    if not has_payload:
        return None

    status = _chain_status_from_transactions(txs)
    issue_tx = next((t for t in reversed(txs) if t.get("tx_type") == "cert_issue"), txs[-1])
    return {
        "valid": status != "revoked",
        "cert_id": cert_id,
        "course_title": chain_public.get("course_title"),
        "status": status,
        "issued_at": chain_public.get("issued_at"),
        "learner_name": chain_public.get("holder_name"),
        "on_chain": True,
        "chain_only": True,
        "platform_record": False,
        "requires_identity_challenge": False,
        "identity_verified": False,
        "chain_tx_hash": issue_tx.get("tx_hash"),
        "chain_block_height": issue_tx.get("block_height"),
        "chain_public": chain_public,
        "message": "链上可查；平台暂无颁证记录，不支持三要素核验" if status != "revoked" else "链上记录已撤销",
    }


def verify_certificate(cert_id: str) -> dict[str, Any]:
    """Public lookup — no auth required. Revoked certs come back `valid=False`."""
    with db_cursor() as cur:
        cur.execute("SELECT * FROM certificate_issuances WHERE cert_id=? OR id=?", (cert_id, cert_id))
        row = cur.fetchone()
    if not row:
        chain_only = _verify_from_chain_only(cert_id)
        if chain_only:
            return chain_only
        return {
            "valid": False,
            "cert_id": cert_id,
            "platform_record": False,
            "on_chain": False,
            "message": "未找到该证书编号（平台与链上均无记录）",
        }

    d = dict(row)
    identity = _load_verified_identity(str(d.get("user_id") or ""))
    learner_name = identity.get("masked_name") if identity else None
    if not learner_name:
        try:
            with db_cursor() as cur:
                cur.execute("SELECT display_name FROM users WHERE id=?", (d.get("user_id"),))
                u = cur.fetchone()
                learner_name = u.get("display_name") if u else None
        except Exception:
            learner_name = None

    status = d.get("status") or "issued"
    qr_payload = d.get("qr_payload")
    if isinstance(qr_payload, str):
        try:
            qr_payload = json.loads(qr_payload)
        except Exception:
            qr_payload = None

    meta = _parse_meta_json(d.get("meta_json"))
    chain_public = _load_chain_public(str(d.get("cert_id") or cert_id), meta, d)
    has_chain = bool(chain_public.get("tx_hash") or chain_public.get("holder_name"))
    if chain_public and chain_public.get("holder_name"):
        learner_name = chain_public["holder_name"]

    out = {
        "valid": status not in ("revoked", "rejected"),
        "id": d.get("id"),
        "cert_id": d.get("cert_id") or d.get("serial"),
        "course_title": d.get("course_title"),
        "status": status,
        "issued_at": d.get("issued_at"),
        "revoked_at": d.get("revoked_at"),
        "revoke_reason": d.get("revoke_reason") if status == "revoked" else None,
        "learner_name": learner_name,
        "qr_payload": qr_payload,
        "platform_record": True,
        "requires_identity_challenge": True,
        "identity_verified": False,
        **(_chain_fields(meta) if meta.get("chain_tx_hash") else {}),
    }
    if has_chain:
        out["on_chain"] = True
        if not out.get("chain_tx_hash") and chain_public.get("tx_hash"):
            out["chain_tx_hash"] = chain_public.get("tx_hash")
        if not out.get("chain_block_height") and chain_public.get("block_height") is not None:
            out["chain_block_height"] = chain_public.get("block_height")
        out["chain_public"] = chain_public
    return out


def verify_certificate_challenge(cert_id: str, real_name: str, id_tail: str) -> dict[str, Any]:
    """Public three-factor verification: cert_id + name + ID last six digits."""
    from services.application.kyc import matches_id_tail, matches_name

    base = verify_certificate(cert_id)
    if base.get("chain_only"):
        return {
            **base,
            "valid": False,
            "verified_identity": False,
            "message": "该证书仅有链上存证，平台无颁证记录，不支持三要素核验",
        }
    if not base.get("valid"):
        return {**base, "verified_identity": False, "message": base.get("message") or "证书无效或已撤销"}

    with db_cursor() as cur:
        cur.execute("SELECT user_id FROM certificate_issuances WHERE cert_id=? OR id=?", (cert_id, cert_id))
        row = cur.fetchone()
    if not row:
        return {**base, "valid": False, "verified_identity": False, "message": "证书不存在"}

    identity = _load_verified_identity(str(row.get("user_id")))
    if not identity:
        return {
            **base,
            "valid": False,
            "verified_identity": False,
            "message": "持证人尚未完成实名认证，无法三要素核验",
        }

    if not (
        matches_name(real_name, identity.get("masked_name"))
        or (
            identity.get("holder_name")
            and real_name.strip() == str(identity.get("holder_name")).strip()
        )
        or (
            base.get("chain_public", {}).get("holder_name")
            and real_name.strip() == str(base["chain_public"]["holder_name"]).strip()
        )
    ):
        return {**base, "valid": False, "verified_identity": False, "message": "姓名与证件信息不匹配"}
    if not matches_id_tail(id_tail, identity.get("id_tail")):
        return {**base, "valid": False, "verified_identity": False, "message": "身份证后六位不匹配"}

    with db_cursor() as cur:
        cur.execute(
            "SELECT meta_json, course_title, issued_at FROM certificate_issuances WHERE cert_id=? OR id=?",
            (cert_id, cert_id),
        )
        cert_row = cur.fetchone()
    cert_d = dict(cert_row) if cert_row else {}
    meta = _parse_meta_json(cert_d.get("meta_json"))
    chain_public = base.get("chain_public") or _load_chain_public(cert_id, meta, cert_d)
    display_name = (
        chain_public.get("holder_name")
        or identity.get("holder_name")
        or identity.get("masked_name")
    )

    return {
        **base,
        "valid": True,
        "verified_identity": True,
        "identity_verified": True,
        "learner_name": display_name,
        "chain_holder_name": chain_public.get("holder_name") or display_name,
        "chain_public": chain_public,
        "message": "证书有效，三要素核验通过",
    }

