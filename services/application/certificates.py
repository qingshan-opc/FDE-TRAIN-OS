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
            SELECT masked_name, id_tail, status, verified_at
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


def _chain_fields(meta: dict[str, Any]) -> dict[str, Any]:
    if not meta.get("chain_tx_hash"):
        return {}
    return {
        "chain_tx_hash": meta.get("chain_tx_hash"),
        "chain_network": meta.get("chain_network"),
        "chain_content_hash": meta.get("chain_content_hash"),
        "chain_anchor_at": meta.get("chain_anchor_at"),
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
    return {"id": row["id"], "cert_id": row.get("cert_id"), "status": "revoked", "reason": reason}


def verify_certificate(cert_id: str) -> dict[str, Any]:
    """Public lookup — no auth required. Revoked certs come back `valid=False`."""
    with db_cursor() as cur:
        cur.execute("SELECT * FROM certificate_issuances WHERE cert_id=? OR id=?", (cert_id, cert_id))
        row = cur.fetchone()
    if not row:
        return {"valid": False, "cert_id": cert_id, "message": "证书不存在或为遗留证书（暂不支持在线核验）"}

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

    return {
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
        "requires_identity_challenge": True,
        **_chain_fields(meta),
    }


def verify_certificate_challenge(cert_id: str, real_name: str, id_tail: str) -> dict[str, Any]:
    """Public three-factor verification: cert_id + name + ID last six digits."""
    from services.application.kyc import matches_id_tail, matches_name

    base = verify_certificate(cert_id)
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

    if not matches_name(real_name, identity.get("masked_name")):
        return {**base, "valid": False, "verified_identity": False, "message": "姓名与证件信息不匹配"}
    if not matches_id_tail(id_tail, identity.get("id_tail")):
        return {**base, "valid": False, "verified_identity": False, "message": "身份证后六位不匹配"}

    return {
        **base,
        "valid": True,
        "verified_identity": True,
        "learner_name": identity.get("masked_name"),
        "message": "证书有效，三要素核验通过",
    }

