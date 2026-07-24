"""Author 学员中心 APIs — offerings / enrollments / submissions."""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any, Literal
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

_ROOT = Path(__file__).resolve().parents[2]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from services.author.pagination import offset_limit, page_meta, parse_page  # noqa: E402
from services.shared import db_cursor, write_audit  # noqa: E402
from services.shared.middleware import require_author, session_camp_id  # noqa: E402

router = APIRouter(tags=["author-learners"])

ENROLLMENT_STATUSES = frozenset({"active", "dropped", "completed"})


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _row(d: Any) -> dict[str, Any]:
    return dict(d) if d is not None else {}


def _parse_json_field(value: Any) -> Any:
    if isinstance(value, str):
        try:
            return json.loads(value)
        except json.JSONDecodeError:
            return value
    return value


def _progress_summary(
    cur,
    *,
    learner_id: str,
    camp_id: str | None,
    course_version_id: str | None,
    enrollment_id: str | None = None,
) -> dict[str, Any]:
    """Compact progress for list/detail cards."""
    total_days = 0
    if course_version_id:
        cur.execute(
            "SELECT COUNT(DISTINCT day) AS c FROM day_packages WHERE course_version_id=?",
            (course_version_id,),
        )
        total_days = int((cur.fetchone() or {}).get("c") or 0)

    passed_days = 0
    passed_nodes = 0
    total_nodes = 0
    last_progress_at = None
    if camp_id and learner_id:
        cur.execute(
            """
            SELECT
              COUNT(*) AS total_nodes,
              COUNT(*) FILTER (WHERE status='passed') AS passed_nodes,
              COUNT(DISTINCT day) FILTER (WHERE status='passed') AS passed_days,
              MAX(updated_at) AS last_progress_at
            FROM node_progress
            WHERE learner_id=? AND camp_id=?
            """,
            (learner_id, camp_id),
        )
        np = cur.fetchone() or {}
        total_nodes = int(np.get("total_nodes") or 0)
        passed_nodes = int(np.get("passed_nodes") or 0)
        passed_days = int(np.get("passed_days") or 0)
        last_progress_at = np.get("last_progress_at")

    last_submission_at = None
    submission_count = 0
    if learner_id and camp_id:
        cur.execute(
            """
            SELECT COUNT(*) AS c, MAX(created_at) AS last_at
            FROM submissions WHERE learner_id=? AND camp_id=?
            """,
            (learner_id, camp_id),
        )
        sub = cur.fetchone() or {}
        submission_count = int(sub.get("c") or 0)
        last_submission_at = sub.get("last_at")
    elif enrollment_id:
        cur.execute(
            """
            SELECT COUNT(*) AS c, MAX(created_at) AS last_at
            FROM submissions WHERE enrollment_id=?
            """,
            (enrollment_id,),
        )
        sub = cur.fetchone() or {}
        submission_count = int(sub.get("c") or 0)
        last_submission_at = sub.get("last_at")

    last_active_at = last_progress_at
    if last_submission_at and (not last_active_at or str(last_submission_at) > str(last_active_at)):
        last_active_at = last_submission_at

    rate = (passed_days / total_days) if total_days else 0.0
    return {
        "total_days": total_days,
        "passed_days": passed_days,
        "total_nodes": total_nodes,
        "passed_nodes": passed_nodes,
        "submission_count": submission_count,
        "rate": round(rate, 4),
        "last_active_at": last_active_at.isoformat() if hasattr(last_active_at, "isoformat") else last_active_at,
    }


def _enrich_enrollment(cur, enrollment_id: str) -> dict[str, Any] | None:
    cur.execute(
        """
        SELECT
          er.id, er.user_id, er.offering_id, er.status, er.created_at,
          u.display_name, u.email,
          co.title AS offering_title, co.camp_id, co.course_version_id, co.status AS offering_status,
          cv.version_tag, cv.title AS version_title,
          c.id AS course_id, c.title AS course_title, c.slug AS course_slug
        FROM enrollment_records er
        JOIN users u ON u.id = er.user_id
        JOIN course_offerings co ON co.id = er.offering_id
        LEFT JOIN course_versions cv ON cv.id = co.course_version_id
        LEFT JOIN courses c ON c.id = cv.course_id
        WHERE er.id=?
        """,
        (enrollment_id,),
    )
    row = cur.fetchone()
    if not row:
        return None
    item = _row(row)
    if item.get("created_at") is not None and hasattr(item["created_at"], "isoformat"):
        item["created_at"] = item["created_at"].isoformat()
    item["progress"] = _progress_summary(
        cur,
        learner_id=item["user_id"],
        camp_id=item.get("camp_id"),
        course_version_id=item.get("course_version_id"),
        enrollment_id=item["id"],
    )
    return item


def _attachment_count(cur, submission_id: str) -> int:
    cur.execute("SELECT COUNT(*) AS c FROM submission_attachments WHERE submission_id=?", (submission_id,))
    n = int((cur.fetchone() or {}).get("c") or 0)
    cur.execute("SELECT COUNT(*) AS c FROM lab_attachments WHERE submission_id=?", (submission_id,))
    n += int((cur.fetchone() or {}).get("c") or 0)
    cur.execute("SELECT COUNT(*) AS c FROM artifacts WHERE submission_id=?", (submission_id,))
    n += int((cur.fetchone() or {}).get("c") or 0)
    return n


def _enrollment_cert_identity(cur, user_id: str, enrollment_id: str) -> dict[str, Any]:
    identity_status = "unverified"
    cur.execute(
        "SELECT status FROM identity_verifications WHERE user_id=? ORDER BY created_at DESC LIMIT 1",
        (user_id,),
    )
    id_row = cur.fetchone()
    if id_row:
        identity_status = id_row.get("status") or "unverified"

    cert_id = None
    cert_status = None
    on_chain = False
    try:
        cur.execute(
            """
            SELECT cert_id, status, meta_json
            FROM certificate_issuances
            WHERE enrollment_id=?
            ORDER BY issued_at DESC NULLS LAST
            LIMIT 1
            """,
            (enrollment_id,),
        )
        cert = cur.fetchone()
        if cert:
            cert_id = cert.get("cert_id")
            cert_status = cert.get("status")
            meta = _parse_json_field(cert.get("meta_json"))
            if isinstance(meta, dict):
                on_chain = bool(meta.get("chain_tx_hash"))
    except Exception:
        pass

    return {
        "identity_status": identity_status,
        "cert_id": cert_id,
        "cert_status": cert_status,
        "on_chain": on_chain,
    }


# ---------------------------------------------------------------------------
# Offerings
# ---------------------------------------------------------------------------


@router.get("/api/v1/author/offerings")
def list_offerings(
    request: Request,
    camp_id: str | None = None,
    q: str | None = None,
    page: int | str | None = None,
    page_size: int | str | None = None,
) -> dict[str, Any]:
    require_author(request)
    camp = session_camp_id(request, camp_id)
    page_i, size_i = parse_page(page, page_size)
    off, lim = offset_limit(page_i, size_i)

    where = ["co.camp_id=?"]
    args: list[Any] = [camp]
    if q and q.strip():
        where.append("(co.title ILIKE ? OR c.title ILIKE ? OR cv.version_tag ILIKE ?)")
        like = f"%{q.strip()}%"
        args.extend([like, like, like])
    where_sql = " AND ".join(where)

    with db_cursor() as cur:
        cur.execute(
            f"""
            SELECT COUNT(*) AS c
            FROM course_offerings co
            LEFT JOIN course_versions cv ON cv.id = co.course_version_id
            LEFT JOIN courses c ON c.id = cv.course_id
            WHERE {where_sql}
            """,
            args,
        )
        total = int((cur.fetchone() or {}).get("c") or 0)
        cur.execute(
            f"""
            SELECT
              co.id, co.title, co.camp_id, co.course_version_id, co.status,
              co.starts_at, co.ends_at, co.teacher_id, co.created_at,
              cv.version_tag, cv.title AS version_title, cv.status AS version_status,
              c.id AS course_id, c.title AS course_title, c.slug AS course_slug,
              (SELECT COUNT(*) FROM enrollment_records er WHERE er.offering_id=co.id) AS enrollment_count
            FROM course_offerings co
            LEFT JOIN course_versions cv ON cv.id = co.course_version_id
            LEFT JOIN courses c ON c.id = cv.course_id
            WHERE {where_sql}
            ORDER BY co.created_at DESC
            OFFSET ? LIMIT ?
            """,
            (*args, off, lim),
        )
        items = []
        for r in cur.fetchall():
            d = _row(r)
            for key in ("starts_at", "ends_at", "created_at"):
                if d.get(key) is not None and hasattr(d[key], "isoformat"):
                    d[key] = d[key].isoformat()
            items.append(d)
    return page_meta(items, total, page_i, size_i)


# ---------------------------------------------------------------------------
# Enrollments
# ---------------------------------------------------------------------------


@router.get("/api/v1/author/enrollments")
def list_enrollments(
    request: Request,
    camp_id: str | None = None,
    offering_id: str | None = None,
    status: str | None = None,
    q: str | None = None,
    page: int | str | None = None,
    page_size: int | str | None = None,
) -> dict[str, Any]:
    require_author(request)
    camp = session_camp_id(request, camp_id)
    page_i, size_i = parse_page(page, page_size)
    off, lim = offset_limit(page_i, size_i)

    where = ["co.camp_id=?"]
    args: list[Any] = [camp]
    if offering_id and offering_id.strip():
        where.append("er.offering_id=?")
        args.append(offering_id.strip())
    if status and status.strip():
        where.append("er.status=?")
        args.append(status.strip())
    if q and q.strip():
        where.append("(u.display_name ILIKE ? OR u.email ILIKE ? OR c.title ILIKE ? OR co.title ILIKE ?)")
        like = f"%{q.strip()}%"
        args.extend([like, like, like, like])
    where_sql = " AND ".join(where)

    with db_cursor() as cur:
        cur.execute(
            f"""
            SELECT COUNT(*) AS c
            FROM enrollment_records er
            JOIN users u ON u.id = er.user_id
            JOIN course_offerings co ON co.id = er.offering_id
            LEFT JOIN course_versions cv ON cv.id = co.course_version_id
            LEFT JOIN courses c ON c.id = cv.course_id
            WHERE {where_sql}
            """,
            args,
        )
        total = int((cur.fetchone() or {}).get("c") or 0)
        cur.execute(
            f"""
            SELECT
              er.id, er.user_id, er.offering_id, er.status, er.created_at,
              u.display_name, u.email,
              co.title AS offering_title, co.camp_id, co.course_version_id,
              cv.version_tag,
              c.id AS course_id, c.title AS course_title
            FROM enrollment_records er
            JOIN users u ON u.id = er.user_id
            JOIN course_offerings co ON co.id = er.offering_id
            LEFT JOIN course_versions cv ON cv.id = co.course_version_id
            LEFT JOIN courses c ON c.id = cv.course_id
            WHERE {where_sql}
            ORDER BY er.created_at DESC
            OFFSET ? LIMIT ?
            """,
            (*args, off, lim),
        )
        rows = [_row(r) for r in cur.fetchall()]
        items = []
        for d in rows:
            if d.get("created_at") is not None and hasattr(d["created_at"], "isoformat"):
                d["created_at"] = d["created_at"].isoformat()
            d["progress"] = _progress_summary(
                cur,
                learner_id=d["user_id"],
                camp_id=d.get("camp_id"),
                course_version_id=d.get("course_version_id"),
                enrollment_id=d["id"],
            )
            d["progress_pct"] = round(float(d["progress"].get("rate") or 0) * 100)
            d.update(_enrollment_cert_identity(cur, d["user_id"], d["id"]))
            items.append(d)
    return page_meta(items, total, page_i, size_i)


@router.get("/api/v1/author/enrollments/{enrollment_id}")
def get_enrollment(enrollment_id: str, request: Request) -> dict[str, Any]:
    require_author(request)
    with db_cursor() as cur:
        item = _enrich_enrollment(cur, enrollment_id)
        if not item:
            raise HTTPException(404, "enrollment not found")

        # Node progress for this learner/camp (prefer enrollment_id when set).
        cur.execute(
            """
            SELECT learner_id, camp_id, day, node_id, status, updated_at, enrollment_id
            FROM node_progress
            WHERE enrollment_id=?
               OR (learner_id=? AND camp_id=? AND enrollment_id IS NULL)
            ORDER BY day ASC, node_id ASC
            """,
            (enrollment_id, item["user_id"], item.get("camp_id")),
        )
        node_progress = []
        for r in cur.fetchall():
            d = _row(r)
            if d.get("updated_at") is not None and hasattr(d["updated_at"], "isoformat"):
                d["updated_at"] = d["updated_at"].isoformat()
            node_progress.append(d)

        cur.execute(
            "SELECT COUNT(*) AS c FROM submissions WHERE enrollment_id=? OR (learner_id=? AND camp_id=?)",
            (enrollment_id, item["user_id"], item.get("camp_id")),
        )
        submission_count = int((cur.fetchone() or {}).get("c") or 0)

        # Attachment counts across lab + submission_attachments + artifacts for this learner/camp.
        camp = item.get("camp_id")
        uid = item["user_id"]
        if camp:
            cur.execute(
                """
                SELECT
                  (SELECT COUNT(*) FROM lab_attachments la
                     WHERE la.learner_id=? AND la.camp_id=?) +
                  (SELECT COUNT(*) FROM submission_attachments sa
                     JOIN submissions s ON s.id = sa.submission_id
                     WHERE s.learner_id=? AND s.camp_id=?) +
                  (SELECT COUNT(*) FROM artifacts a
                     WHERE a.learner_id=? AND a.camp_id=?)
                  AS c
                """,
                (uid, camp, uid, camp, uid, camp),
            )
        else:
            cur.execute(
                """
                SELECT
                  (SELECT COUNT(*) FROM lab_attachments la WHERE la.learner_id=?) +
                  (SELECT COUNT(*) FROM submission_attachments sa
                     JOIN submissions s ON s.id = sa.submission_id
                     WHERE s.learner_id=?) +
                  (SELECT COUNT(*) FROM artifacts a WHERE a.learner_id=?)
                  AS c
                """,
                (uid, uid, uid),
            )
        attachment_count = int((cur.fetchone() or {}).get("c") or 0)

        cur.execute(
            """
            SELECT id, day, node_id, status, submission_id, created_at, resolved_at
            FROM mentor_reviews
            WHERE enrollment_id=? OR (learner_id=? AND camp_id=?)
            ORDER BY created_at DESC
            LIMIT 20
            """,
            (enrollment_id, uid, camp),
        )
        reviews = []
        for r in cur.fetchall():
            d = _row(r)
            for key in ("created_at", "resolved_at"):
                if d.get(key) is not None and hasattr(d[key], "isoformat"):
                    d[key] = d[key].isoformat()
            reviews.append(d)

    return {
        **item,
        "node_progress": node_progress,
        "submission_count": submission_count,
        "attachment_count": attachment_count,
        "mentor_reviews": reviews,
    }


class EnrollmentCreate(BaseModel):
    user_id: str
    offering_id: str


class EnrollmentPatch(BaseModel):
    status: Literal["active", "dropped", "completed"]


@router.post("/api/v1/author/enrollments")
def create_enrollment(body: EnrollmentCreate, request: Request) -> dict[str, Any]:
    user = require_author(request)
    with db_cursor() as cur:
        cur.execute("SELECT id FROM users WHERE id=?", (body.user_id,))
        if not cur.fetchone():
            raise HTTPException(404, "user not found")
        cur.execute(
            "SELECT id, camp_id, title FROM course_offerings WHERE id=?",
            (body.offering_id,),
        )
        offering = cur.fetchone()
        if not offering:
            raise HTTPException(404, "offering not found")

        cur.execute(
            "SELECT id FROM enrollment_records WHERE user_id=? AND offering_id=?",
            (body.user_id, body.offering_id),
        )
        existing = cur.fetchone()
        if existing:
            raise HTTPException(409, "enrollment already exists")

        eid = str(uuid4())
        cur.execute(
            """
            INSERT INTO enrollment_records (id, user_id, offering_id, status, created_at)
            VALUES (?, ?, ?, 'active', NOW())
            """,
            (eid, body.user_id, body.offering_id),
        )
        # Dual-write legacy enrollments when offering is camp-scoped.
        camp_id = offering["camp_id"]
        if camp_id:
            cur.execute(
                """
                INSERT INTO enrollments (user_id, camp_id, status, created_at)
                VALUES (?, ?, 'active', NOW())
                ON CONFLICT (user_id, camp_id) DO UPDATE SET status='active'
                """,
                (body.user_id, camp_id),
            )
            cur.execute(
                """
                UPDATE node_progress SET enrollment_id=?
                WHERE learner_id=? AND camp_id=? AND enrollment_id IS NULL
                """,
                (eid, body.user_id, camp_id),
            )

        item = _enrich_enrollment(cur, eid)

    write_audit(
        "author.enrollment_create",
        actor_id=user.id,
        camp_id=offering["camp_id"],
        resource_type="enrollment",
        resource_id=eid,
        details={"user_id": body.user_id, "offering_id": body.offering_id},
    )
    return {"ok": True, "item": item}


@router.patch("/api/v1/author/enrollments/{enrollment_id}")
def patch_enrollment(enrollment_id: str, body: EnrollmentPatch, request: Request) -> dict[str, Any]:
    user = require_author(request)
    if body.status not in ENROLLMENT_STATUSES:
        raise HTTPException(422, f"status must be one of {sorted(ENROLLMENT_STATUSES)}")

    with db_cursor() as cur:
        cur.execute(
            """
            SELECT er.id, er.user_id, er.status, co.camp_id
            FROM enrollment_records er
            JOIN course_offerings co ON co.id = er.offering_id
            WHERE er.id=?
            """,
            (enrollment_id,),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(404, "enrollment not found")

        prev = row["status"]
        cur.execute(
            "UPDATE enrollment_records SET status=? WHERE id=?",
            (body.status, enrollment_id),
        )
        # Mirror active/dropped onto legacy enrollments when camp-scoped.
        if row["camp_id"]:
            legacy_status = "active" if body.status == "active" else "dropped"
            if body.status == "completed":
                legacy_status = "active"  # keep camp access; completion is v2-only
            cur.execute(
                """
                INSERT INTO enrollments (user_id, camp_id, status, created_at)
                VALUES (?, ?, ?, NOW())
                ON CONFLICT (user_id, camp_id) DO UPDATE SET status=EXCLUDED.status
                """,
                (row["user_id"], row["camp_id"], legacy_status),
            )

        item = _enrich_enrollment(cur, enrollment_id)

    write_audit(
        "author.enrollment_patch",
        actor_id=user.id,
        camp_id=row["camp_id"],
        resource_type="enrollment",
        resource_id=enrollment_id,
        details={"from": prev, "to": body.status},
    )
    return {"ok": True, "item": item}


# ---------------------------------------------------------------------------
# Submissions (学员提交资料)
# ---------------------------------------------------------------------------


@router.get("/api/v1/author/submissions")
def list_submissions(
    request: Request,
    camp_id: str | None = None,
    q: str | None = None,
    day: int | None = None,
    status: str | None = None,
    learner_id: str | None = None,
    page: int | str | None = None,
    page_size: int | str | None = None,
) -> dict[str, Any]:
    require_author(request)
    camp = session_camp_id(request, camp_id)
    page_i, size_i = parse_page(page, page_size)
    off, lim = offset_limit(page_i, size_i)

    where = ["s.camp_id=?"]
    args: list[Any] = [camp]
    if day is not None:
        where.append("s.day=?")
        args.append(day)
    if status and status.strip():
        where.append("s.status=?")
        args.append(status.strip())
    if learner_id and learner_id.strip():
        where.append("s.learner_id=?")
        args.append(learner_id.strip())
    if q and q.strip():
        where.append(
            "(s.id ILIKE ? OR s.node_id ILIKE ? OR s.learner_id ILIKE ?"
            " OR u.display_name ILIKE ? OR u.email ILIKE ?)"
        )
        like = f"%{q.strip()}%"
        args.extend([like, like, like, like, like])
    where_sql = " AND ".join(where)

    with db_cursor() as cur:
        cur.execute(
            f"""
            SELECT COUNT(*) AS c
            FROM submissions s
            LEFT JOIN users u ON u.id = s.learner_id
            WHERE {where_sql}
            """,
            args,
        )
        total = int((cur.fetchone() or {}).get("c") or 0)
        cur.execute(
            f"""
            SELECT
              s.id, s.camp_id, s.learner_id, s.day, s.node_id, s.status,
              s.snapshot_id, s.artifact_id, s.enrollment_id, s.job_id,
              s.created_at, s.eval_json, s.feedback, s.score,
              u.display_name, u.email
            FROM submissions s
            LEFT JOIN users u ON u.id = s.learner_id
            WHERE {where_sql}
            ORDER BY s.created_at DESC
            OFFSET ? LIMIT ?
            """,
            (*args, off, lim),
        )
        items = []
        for r in cur.fetchall():
            d = _row(r)
            d["eval_json"] = _parse_json_field(d.get("eval_json")) or {}
            if d.get("created_at") is not None and hasattr(d["created_at"], "isoformat"):
                d["created_at"] = d["created_at"].isoformat()
            items.append(d)
    return page_meta(items, total, page_i, size_i)


@router.get("/api/v1/author/submissions/{submission_id}")
def get_submission(submission_id: str, request: Request) -> dict[str, Any]:
    require_author(request)
    with db_cursor() as cur:
        cur.execute(
            """
            SELECT
              s.*,
              u.display_name, u.email
            FROM submissions s
            LEFT JOIN users u ON u.id = s.learner_id
            WHERE s.id=?
            """,
            (submission_id,),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(404, "submission not found")
        item = _row(row)
        item["eval_json"] = _parse_json_field(item.get("eval_json")) or {}
        if item.get("created_at") is not None and hasattr(item["created_at"], "isoformat"):
            item["created_at"] = item["created_at"].isoformat()

        cur.execute(
            """
            SELECT id, learner_id, camp_id, enrollment_id, day, node_id, submission_id,
                   reason, status, mentor_id, mentor_feedback, mentor_score,
                   created_at, resolved_at
            FROM mentor_reviews
            WHERE submission_id=?
            ORDER BY created_at DESC
            """,
            (submission_id,),
        )
        reviews = []
        for r in cur.fetchall():
            d = _row(r)
            for key in ("created_at", "resolved_at"):
                if d.get(key) is not None and hasattr(d[key], "isoformat"):
                    d[key] = d[key].isoformat()
            reviews.append(d)

        attachment_count = _attachment_count(cur, submission_id)

    return {
        "item": item,
        "mentor_reviews": reviews,
        "attachment_count": attachment_count,
    }


@router.get("/api/v1/author/submissions/{submission_id}/attachments")
def list_submission_attachments(submission_id: str, request: Request) -> dict[str, Any]:
    require_author(request)
    with db_cursor() as cur:
        cur.execute("SELECT id, learner_id, camp_id FROM submissions WHERE id=?", (submission_id,))
        sub = cur.fetchone()
        if not sub:
            raise HTTPException(404, "submission not found")

        items: list[dict[str, Any]] = []

        cur.execute(
            """
            SELECT id, object_key, filename, content_type, size_bytes, created_at, scan_status
            FROM lab_attachments WHERE submission_id=?
            ORDER BY created_at DESC
            """,
            (submission_id,),
        )
        for r in cur.fetchall():
            d = _row(r)
            items.append(
                {
                    "kind": "lab_attachment",
                    "id": d["id"],
                    "name": d.get("filename") or d.get("object_key"),
                    "object_key": d["object_key"],
                    "content_type": d.get("content_type"),
                    "size": int(d.get("size_bytes") or 0),
                    "created_at": d["created_at"].isoformat()
                    if hasattr(d.get("created_at"), "isoformat")
                    else d.get("created_at"),
                    "scan_status": d.get("scan_status"),
                }
            )

        cur.execute(
            """
            SELECT id, object_key, filename, content_type, size_bytes, created_at
            FROM submission_attachments WHERE submission_id=?
            ORDER BY created_at DESC
            """,
            (submission_id,),
        )
        for r in cur.fetchall():
            d = _row(r)
            items.append(
                {
                    "kind": "submission_attachment",
                    "id": d["id"],
                    "name": d.get("filename") or d.get("object_key"),
                    "object_key": d["object_key"],
                    "content_type": d.get("content_type"),
                    "size": int(d.get("size_bytes") or 0),
                    "created_at": d["created_at"].isoformat()
                    if hasattr(d.get("created_at"), "isoformat")
                    else d.get("created_at"),
                }
            )

        cur.execute(
            """
            SELECT id, object_key, content_type, size_bytes, sha256, created_at
            FROM artifacts WHERE submission_id=?
            ORDER BY created_at DESC
            """,
            (submission_id,),
        )
        for r in cur.fetchall():
            d = _row(r)
            key = d.get("object_key") or ""
            name = key.rsplit("/", 1)[-1] if key else d["id"]
            items.append(
                {
                    "kind": "artifact",
                    "id": d["id"],
                    "name": name,
                    "object_key": key,
                    "content_type": d.get("content_type"),
                    "size": int(d.get("size_bytes") or 0),
                    "created_at": d["created_at"].isoformat()
                    if hasattr(d.get("created_at"), "isoformat")
                    else d.get("created_at"),
                    "sha256": d.get("sha256"),
                }
            )

    items.sort(key=lambda x: str(x.get("created_at") or ""), reverse=True)
    return {"submission_id": submission_id, "items": items}


class SubmissionReviewBody(BaseModel):
    feedback: str
    score: float | None = None
    status: Literal["resolved", "pending", "passed", "failed"] | None = "resolved"


@router.post("/api/v1/author/submissions/{submission_id}/review")
def review_submission(submission_id: str, body: SubmissionReviewBody, request: Request) -> dict[str, Any]:
    user = require_author(request)
    feedback = (body.feedback or "").strip()
    if not feedback:
        raise HTTPException(422, "feedback required")
    with db_cursor() as cur:
        cur.execute("SELECT id, camp_id, status FROM submissions WHERE id=?", (submission_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(404, "submission not found")
        next_status = body.status or "resolved"
        if next_status in {"resolved", "passed"}:
            sub_status = "passed"
        elif next_status == "failed":
            sub_status = "failed"
        else:
            sub_status = row["status"] or "submitted"
        cur.execute(
            """
            UPDATE submissions
            SET feedback=?, score=?, status=?
            WHERE id=?
            """,
            (feedback, body.score, sub_status, submission_id),
        )
        cur.execute(
            """
            UPDATE mentor_reviews
            SET status='resolved', mentor_feedback=?, mentor_score=?, mentor_id=?, resolved_at=NOW()
            WHERE submission_id=? AND status='pending'
            """,
            (feedback, body.score, user.id, submission_id),
        )
    write_audit(
        "author.submission_review",
        actor_id=user.id,
        camp_id=row["camp_id"],
        resource_type="submission_review",
        resource_id=submission_id,
        details={"status": sub_status, "score": body.score},
    )
    return {"ok": True, "id": submission_id, "status": sub_status}

