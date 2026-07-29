"""Author APIs — documents (MinIO+ingest), course versions, submissions."""

from __future__ import annotations

import hashlib
import json
import logging
import sys
from pathlib import Path
from typing import Any
from uuid import uuid4

import yaml
from fastapi import APIRouter, FastAPI, File, Form, HTTPException, Request, UploadFile
from pydantic import BaseModel, Field

_ROOT = Path(__file__).resolve().parents[2]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from services.domain import jobs as queue  # noqa: E402
from services.shared import (  # noqa: E402
    CONTRACTS_UPLOAD_DIR,
    DOCUMENT_MAX_BYTES,
    S3_BUCKET_DOCUMENTS,
    db_cursor,
    ensure_dirs,
    init_schema,
    mask_secret,
    now_iso,
    write_audit,
)
from services.shared.config import (  # noqa: E402
    DEFAULT_UPLOAD_MAX_BYTES,
    MEDIA_MAX_BYTES_BY_KIND,
    S3_PRESIGN_GET_EXPIRES,
)
from services.shared.middleware import require_author, session_camp_id  # noqa: E402
from services.storage import (  # noqa: E402
    course_media_key,
    document_key,
    get_store,
    site_hero_key,
    site_mentor_avatar_key,
    open_course_key,
)
from services.application.curriculum_projection import (  # noqa: E402
    delete_projected_day,
    project_course_version,
    project_day_package,
)
from services.author.pagination import offset_limit, page_meta, parse_page  # noqa: E402
from services.author.enrollments import router as enrollments_router  # noqa: E402
from services.author.partners import router as partners_router  # noqa: E402
from services.author import media_library as media_lib  # noqa: E402
from services.author import site_content as site_content  # noqa: E402
from services.author.bootcamp_sync import (  # noqa: E402
    list_available_days,
    sync_bootcamp_days,
)

log = logging.getLogger("fde.author")

router = APIRouter(tags=["author"])
router.include_router(enrollments_router)
router.include_router(partners_router)
app = FastAPI(title="FDE Author", version="0.2.0")
init_schema()
ensure_dirs()


def _seed_rubrics(course_version_id: str) -> None:
    """Best-effort rubric registry sync — never blocks a publish."""
    try:
        from services.shared.seed_domain_v2 import seed_rubric_definitions

        seed_rubric_definitions(course_version_id)
    except Exception as exc:
        log.warning("rubric seed skipped for %s: %s", course_version_id, exc)

ALLOWED_DOC_EXT = {".docx", ".pdf", ".md", ".txt"}
ALLOWED_MIME = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword",
    "text/plain",
    "text/markdown",
    "application/octet-stream",
}


def _magic_ok(name: str, data: bytes) -> bool:
    lower = name.lower()
    if lower.endswith(".pdf"):
        return data[:5] == b"%PDF-"
    if lower.endswith(".docx"):
        return data[:2] == b"PK" and len(data) >= 4
    if lower.endswith((".md", ".txt")):
        return True
    return False


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "author"}


@router.post("/api/v1/author/contracts/upload")
async def upload_contract(request: Request, file: UploadFile = File(...)) -> dict[str, Any]:
    require_author(request)
    name = file.filename or "day-upload.yaml"
    if not name.endswith((".yaml", ".yml")):
        raise HTTPException(400, "only yaml allowed")
    if not name.startswith("day-"):
        raise HTTPException(400, "filename must start with day-")
    raw = await file.read()
    dest = CONTRACTS_UPLOAD_DIR / name
    dest.write_bytes(raw)
    write_audit("author.contract_upload", actor_id=request.state.user.id, resource_type="contract", resource_id=name)
    return {"ok": True, "path": str(dest), "name": name, "bytes": len(raw)}


@router.post("/api/v1/author/documents")
async def upload_document(
    request: Request,
    file: UploadFile = File(...),
    camp_id: str | None = Form(None),
    day: int | None = Form(None),
    capsule_id: str | None = Form(None),
) -> dict[str, Any]:
    user = require_author(request)
    camp = session_camp_id(request, camp_id)
    name = file.filename or "upload.bin"
    ext = Path(name).suffix.lower()
    if ext not in ALLOWED_DOC_EXT:
        raise HTTPException(400, f"only {sorted(ALLOWED_DOC_EXT)} allowed")
    data = await file.read()
    if len(data) > DOCUMENT_MAX_BYTES:
        raise HTTPException(413, "document too large")
    if not _magic_ok(name, data):
        raise HTTPException(400, "file magic mismatch")
    ctype = file.content_type or "application/octet-stream"
    if ctype not in ALLOWED_MIME:
        raise HTTPException(400, f"unsupported content-type {ctype}")
    sha = hashlib.sha256(data).hexdigest()
    doc_id = str(uuid4())
    key = document_key(camp, doc_id, sha, name)
    get_store().put_bytes(S3_BUCKET_DOCUMENTS, key, data, content_type=ctype)
    with db_cursor() as cur:
        cur.execute(
            """
            INSERT INTO documents
            (id, camp_id, uploaded_by, filename, content_type, size_bytes, sha256, object_key, status, scan_status, created_at, updated_at)
            VALUES (?,?,?,?,?,?,?,?, 'scanning', 'pending', NOW(), NOW())
            """,
            (doc_id, camp, user.id, name, ctype, len(data), sha, key),
        )
        if day is not None:
            bind_id = str(uuid4())
            cur.execute(
                """
                INSERT INTO document_bindings (id, document_id, day, capsule_id, created_at)
                VALUES (?,?,?,?,NOW())
                """,
                (bind_id, doc_id, day, capsule_id),
            )
    job_id = queue.enqueue_job(
        "document_ingest",
        {"document_id": doc_id, "camp_id": camp},
        camp_id=camp,
        learner_id=None,
    )
    with db_cursor() as cur:
        cur.execute(
            "INSERT INTO ingest_jobs (id, document_id, status, created_at, updated_at) VALUES (?,?, 'queued', NOW(), NOW())",
            (job_id, doc_id),
        )
        cur.execute("UPDATE documents SET status='queued', updated_at=NOW() WHERE id=?", (doc_id,))
    write_audit(
        "author.document_upload",
        actor_id=user.id,
        camp_id=camp,
        resource_type="document",
        resource_id=doc_id,
        details={"filename": name, "sha256": sha, "job_id": job_id},
    )
    return {
        "id": doc_id,
        "camp_id": camp,
        "filename": name,
        "size_bytes": len(data),
        "sha256": sha,
        "object_key": key,
        "status": "queued",
        "ingest_job_id": job_id,
    }


@router.get("/api/v1/author/documents")
def list_documents(
    request: Request,
    camp_id: str | None = None,
    q: str | None = None,
    status: str | None = None,
    bound: str | None = None,
    page: int | None = None,
    page_size: int | None = None,
) -> dict[str, Any]:
    require_author(request)
    camp = session_camp_id(request, camp_id)
    page_i, size_i = parse_page(page, page_size)
    off, lim = offset_limit(page_i, size_i)
    where = ["d.camp_id=?", "d.deleted_at IS NULL"]
    args: list[Any] = [camp]
    if q and q.strip():
        where.append("d.filename ILIKE ?")
        args.append(f"%{q.strip()}%")
    if status and status.strip():
        where.append("d.status=?")
        args.append(status.strip())
    if bound == "1" or bound == "true":
        where.append("EXISTS (SELECT 1 FROM document_bindings b WHERE b.document_id=d.id)")
    elif bound == "0" or bound == "false":
        where.append("NOT EXISTS (SELECT 1 FROM document_bindings b WHERE b.document_id=d.id)")
    where_sql = " AND ".join(where)
    with db_cursor() as cur:
        cur.execute(f"SELECT COUNT(*) AS c FROM documents d WHERE {where_sql}", args)
        total = int(cur.fetchone()["c"] or 0)
        cur.execute(
            f"""
            SELECT d.*, COALESCE(
              (SELECT json_agg(json_build_object(
                  'id', b.id, 'day', b.day, 'capsule_id', b.capsule_id,
                  'course_version_id', b.course_version_id
               ))
               FROM document_bindings b WHERE b.document_id=d.id), '[]'::json
            ) AS bindings
            FROM documents d
            WHERE {where_sql}
            ORDER BY d.created_at DESC
            OFFSET ? LIMIT ?
            """,
            (*args, off, lim),
        )
        items = []
        for r in cur.fetchall():
            d = dict(r)
            b = d.pop("bindings", [])
            if isinstance(b, str):
                b = json.loads(b)
            d["bindings"] = b or []
            items.append(d)
    return page_meta(items, total, page_i, size_i)


@router.get("/api/v1/author/documents/{document_id}")
def get_document(document_id: str, request: Request) -> dict[str, Any]:
    require_author(request)
    with db_cursor() as cur:
        cur.execute(
            """
            SELECT d.*, COALESCE(
              (SELECT json_agg(json_build_object(
                  'id', b.id, 'day', b.day, 'capsule_id', b.capsule_id,
                  'course_version_id', b.course_version_id
               ))
               FROM document_bindings b WHERE b.document_id=d.id), '[]'::json
            ) AS bindings
            FROM documents d WHERE d.id=? AND d.deleted_at IS NULL
            """,
            (document_id,),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(404, "document not found")
        d = dict(row)
        b = d.pop("bindings", [])
        if isinstance(b, str):
            b = json.loads(b)
        d["bindings"] = b or []
    return d


@router.delete("/api/v1/author/documents/{document_id}")
def delete_document(document_id: str, request: Request) -> dict[str, Any]:
    user = require_author(request)
    with db_cursor() as cur:
        cur.execute("SELECT id, camp_id, filename FROM documents WHERE id=? AND deleted_at IS NULL", (document_id,))
        doc = cur.fetchone()
        if not doc:
            raise HTTPException(404, "document not found")
        cur.execute("SELECT COUNT(*) AS c FROM document_bindings WHERE document_id=?", (document_id,))
        bind_count = int(cur.fetchone()["c"] or 0)
        cur.execute("UPDATE documents SET deleted_at=NOW(), updated_at=NOW() WHERE id=?", (document_id,))
    write_audit(
        "author.document_delete",
        actor_id=user.id,
        camp_id=doc["camp_id"],
        resource_type="document",
        resource_id=document_id,
        details={"filename": doc["filename"], "bindings": bind_count},
    )
    return {"ok": True, "id": document_id, "bindings_cleared": bind_count}


@router.delete("/api/v1/author/documents/{document_id}/bindings/{binding_id}")
def unbind_document(document_id: str, binding_id: str, request: Request) -> dict[str, Any]:
    user = require_author(request)
    with db_cursor() as cur:
        cur.execute("SELECT id, camp_id FROM documents WHERE id=? AND deleted_at IS NULL", (document_id,))
        doc = cur.fetchone()
        if not doc:
            raise HTTPException(404, "document not found")
        cur.execute(
            "DELETE FROM document_bindings WHERE id=? AND document_id=? RETURNING id",
            (binding_id, document_id),
        )
        deleted = cur.fetchone()
        if not deleted:
            raise HTTPException(404, "binding not found")
    write_audit(
        "author.document_unbind",
        actor_id=user.id,
        camp_id=doc["camp_id"],
        resource_type="document",
        resource_id=document_id,
        details={"binding_id": binding_id},
    )
    return {"ok": True, "binding_id": binding_id}


@router.post("/api/v1/author/documents/{document_id}/bind")
def bind_document(document_id: str, request: Request, body: dict[str, Any]) -> dict[str, Any]:
    require_author(request)
    day = body.get("day")
    capsule_id = body.get("capsule_id")
    course_version_id = body.get("course_version_id")
    if day is None:
        raise HTTPException(400, "day required")
    with db_cursor() as cur:
        cur.execute("SELECT id, camp_id FROM documents WHERE id=?", (document_id,))
        doc = cur.fetchone()
        if not doc:
            raise HTTPException(404, "document not found")
        bind_id = str(uuid4())
        cur.execute(
            """
            INSERT INTO document_bindings (id, document_id, course_version_id, day, capsule_id, created_at)
            VALUES (?,?,?,?,?,NOW())
            """,
            (bind_id, document_id, course_version_id, int(day), capsule_id),
        )
    write_audit(
        "author.document_bind",
        actor_id=request.state.user.id,
        camp_id=doc["camp_id"],
        resource_type="document",
        resource_id=document_id,
        details={"day": day, "capsule_id": capsule_id},
    )
    return {"ok": True, "binding_id": bind_id}


@router.post("/api/v1/author/documents/{document_id}/retry")
def retry_document(document_id: str, request: Request) -> dict[str, Any]:
    require_author(request)
    with db_cursor() as cur:
        cur.execute("SELECT * FROM documents WHERE id=?", (document_id,))
        doc = cur.fetchone()
        if not doc:
            raise HTTPException(404, "document not found")
        cur.execute("UPDATE documents SET status='queued', error_message=NULL, updated_at=NOW() WHERE id=?", (document_id,))
    job_id = queue.enqueue_job(
        "document_ingest",
        {"document_id": document_id, "camp_id": doc["camp_id"]},
        camp_id=doc["camp_id"],
    )
    write_audit("author.document_retry", actor_id=request.state.user.id, resource_id=document_id, camp_id=doc["camp_id"])
    return {"ok": True, "ingest_job_id": job_id}


@router.get("/api/v1/author/documents/{document_id}/download-url")
def document_download(document_id: str, request: Request) -> dict[str, Any]:
    require_author(request)
    with db_cursor() as cur:
        cur.execute("SELECT * FROM documents WHERE id=?", (document_id,))
        doc = cur.fetchone()
        if not doc:
            raise HTTPException(404, "document not found")
    url = get_store().presign_get(S3_BUCKET_DOCUMENTS, doc["object_key"])
    write_audit("author.document_download", actor_id=request.state.user.id, resource_id=document_id, camp_id=doc["camp_id"])
    return {"url": url, "expires_in": S3_PRESIGN_GET_EXPIRES}


@router.get("/api/v1/author/course-versions")
def list_course_versions(
    request: Request,
    camp_id: str | None = None,
    course_id: str | None = None,
    q: str | None = None,
    status: str | None = None,
    page: int | None = None,
    page_size: int | None = None,
) -> dict[str, Any]:
    require_author(request)
    camp = session_camp_id(request, camp_id)
    page_i, size_i = parse_page(page, page_size)
    off, lim = offset_limit(page_i, size_i)
    where = ["cv.camp_id=?"]
    args: list[Any] = [camp]
    if course_id and course_id.strip():
        where.append("cv.course_id=?")
        args.append(course_id.strip())
    if q and q.strip():
        where.append("(cv.version_tag ILIKE ? OR cv.title ILIKE ? OR c.title ILIKE ?)")
        like = f"%{q.strip()}%"
        args.extend([like, like, like])
    if status and status.strip():
        where.append("cv.status=?")
        args.append(status.strip())
    where_sql = " AND ".join(where)
    with db_cursor() as cur:
        cur.execute(
            f"""
            SELECT COUNT(*) AS c
            FROM course_versions cv
            LEFT JOIN courses c ON c.id = cv.course_id
            WHERE {where_sql}
            """,
            args,
        )
        total = int(cur.fetchone()["c"] or 0)
        cur.execute(
            f"""
            SELECT cv.id, cv.camp_id, cv.course_id, cv.version_tag, cv.title, cv.status,
                   cv.source, cv.published_at, cv.created_at, c.title AS course_title
            FROM course_versions cv
            LEFT JOIN courses c ON c.id = cv.course_id
            WHERE {where_sql}
            ORDER BY cv.created_at DESC
            OFFSET ? LIMIT ?
            """,
            (*args, off, lim),
        )
        items = [dict(r) for r in cur.fetchall()]
    return page_meta(items, total, page_i, size_i)


@router.post("/api/v1/author/course-versions/validate-yaml")
async def validate_course_yaml(request: Request, files: list[UploadFile] = File(default=[])) -> dict[str, Any]:
    """Parse day YAML uploads without writing to DB."""
    require_author(request)
    titles: list[str] = []
    errors: list[str] = []
    day_nos: set[int] = set()
    packages: list[dict[str, Any]] = []
    for f in files or []:
        name = f.filename or "upload.yaml"
        try:
            raw = await f.read()
            data = yaml.safe_load(raw.decode("utf-8"))
            if not isinstance(data, dict):
                errors.append(f"{name}: root must be mapping")
                continue
            day = int(data.get("day") or 0)
            if day < 1:
                errors.append(f"{name}: missing/invalid day")
                continue
            if day in day_nos:
                errors.append(f"{name}: duplicate day {day}")
            day_nos.add(day)
            if not data.get("nodes"):
                errors.append(f"{name}: nodes required")
            titles.append(str(data.get("title") or f"Day {day}"))
            packages.append(data)
        except Exception as exc:
            errors.append(f"{name}: {exc}")
    return {"ok": len(errors) == 0, "days": len(day_nos), "titles": titles, "errors": errors, "packages": packages}


class PublishBody(BaseModel):
    camp_id: str | None = None
    version_tag: str = Field(default="draft")
    title: str = Field(default="课程草稿")
    note: str = ""
    course_version_id: str | None = None


@router.post("/api/v1/author/course-versions/publish")
def publish_course(body: PublishBody, request: Request) -> dict[str, Any]:
    user = require_author(request)
    camp = session_camp_id(request, body.camp_id)
    with db_cursor() as cur:
        if body.course_version_id:
            cur.execute("SELECT id FROM course_versions WHERE id=? AND camp_id=?", (body.course_version_id, camp))
            row = cur.fetchone()
            if not row:
                raise HTTPException(404, "course version not found")
            vid = body.course_version_id
        else:
            vid = str(uuid4())
            tag = body.version_tag or f"v-{uuid4().hex[:8]}"
            cur.execute(
                """
                INSERT INTO course_versions (id, camp_id, version_tag, status, title, created_by, created_at)
                VALUES (?, ?, ?, 'draft', ?, ?, NOW())
                """,
                (vid, camp, tag, body.title, user.id),
            )
        cur.execute(
            "UPDATE course_versions SET status='published', published_at=NOW() WHERE id=?",
            (vid,),
        )
        cur.execute(
            "UPDATE course_versions SET status='archived' WHERE camp_id=? AND id<>? AND status='published'",
            (camp, vid),
        )
        eid = str(uuid4())
        cur.execute(
            "INSERT INTO publish_events (id, course_version_id, actor_id, action, note, created_at) VALUES (?,?,?,?,?,NOW())",
            (eid, vid, user.id, "publish", body.note),
        )
    _seed_rubrics(vid)
    write_audit("author.course_publish", actor_id=user.id, camp_id=camp, resource_type="course_version", resource_id=vid)
    return {"ok": True, "course_version_id": vid, "status": "published"}


@router.get("/api/v1/author/courses")
def list_courses(
    request: Request,
    q: str | None = None,
    status: str | None = None,
    page: int | None = None,
    page_size: int | None = None,
) -> dict[str, Any]:
    """Course catalog (the reusable ``courses`` row — distinct from a specific
    ``course_version``). See ``/api/v1/author/courses/{id}/versions`` for the
    version list of one course."""
    require_author(request)
    page_i, size_i = parse_page(page, page_size)
    off, lim = offset_limit(page_i, size_i)
    where = ["1=1"]
    args: list[Any] = []
    if q and q.strip():
        where.append("(c.title ILIKE ? OR c.slug ILIKE ?)")
        args.extend([f"%{q.strip()}%", f"%{q.strip()}%"])
    if status and status.strip():
        where.append("c.status=?")
        args.append(status.strip())
    where_sql = " AND ".join(where)
    with db_cursor() as cur:
        cur.execute(f"SELECT COUNT(*) AS c FROM courses c WHERE {where_sql}", args)
        total = int(cur.fetchone()["c"] or 0)
        cur.execute(
            f"""
            SELECT c.id, c.slug, c.title, c.description, c.status, c.created_at,
                   (SELECT COUNT(*) FROM course_versions cv WHERE cv.course_id=c.id) AS version_count
            FROM courses c
            WHERE {where_sql}
            ORDER BY c.created_at DESC
            OFFSET ? LIMIT ?
            """,
            (*args, off, lim),
        )
        items = [dict(r) for r in cur.fetchall()]
    return page_meta(items, total, page_i, size_i)


class CourseCreateBody(BaseModel):
    title: str
    slug: str
    description: str | None = None


class CoursePatchBody(BaseModel):
    title: str | None = None
    description: str | None = None
    status: str | None = None


@router.post("/api/v1/author/courses")
def create_course(body: CourseCreateBody, request: Request) -> dict[str, Any]:
    user = require_author(request)
    slug = (body.slug or "").strip().lower()
    title = (body.title or "").strip()
    if not slug or not title:
        raise HTTPException(422, "title and slug required")
    cid = str(uuid4())
    with db_cursor() as cur:
        cur.execute("SELECT id FROM courses WHERE slug=?", (slug,))
        if cur.fetchone():
            raise HTTPException(409, "slug already exists")
        cur.execute(
            """
            INSERT INTO courses (id, slug, title, description, status, created_at)
            VALUES (?,?,?,?, 'active', NOW())
            """,
            (cid, slug, title, body.description or ""),
        )
    write_audit("author.course_create", actor_id=user.id, resource_type="course", resource_id=cid)
    return {"ok": True, "id": cid}


@router.patch("/api/v1/author/courses/{course_id}")
def patch_course(course_id: str, body: CoursePatchBody, request: Request) -> dict[str, Any]:
    user = require_author(request)
    sets: list[str] = []
    args: list[Any] = []
    if body.title is not None:
        sets.append("title=?")
        args.append(body.title.strip())
    if body.description is not None:
        sets.append("description=?")
        args.append(body.description)
    if body.status is not None:
        if body.status not in {"active", "archived"}:
            raise HTTPException(422, "status must be active|archived")
        sets.append("status=?")
        args.append(body.status)
    if not sets:
        raise HTTPException(400, "no fields to update")
    args.append(course_id)
    with db_cursor() as cur:
        cur.execute(f"UPDATE courses SET {', '.join(sets)} WHERE id=?", args)
        if cur.rowcount == 0:
            raise HTTPException(404, "course not found")
    write_audit("author.course_patch", actor_id=user.id, resource_type="course", resource_id=course_id)
    return {"ok": True}


@router.get("/api/v1/author/courses/{course_id}/versions")
def list_versions_for_course(course_id: str, request: Request) -> dict[str, Any]:
    require_author(request)
    with db_cursor() as cur:
        cur.execute("SELECT id FROM courses WHERE id=?", (course_id,))
        if not cur.fetchone():
            raise HTTPException(404, "course not found")
        cur.execute(
            """
            SELECT cv.id, cv.camp_id, cv.course_id, cv.version_tag, cv.status, cv.title, cv.source,
                   cv.published_at, cv.created_by, cv.created_at,
                   (SELECT COUNT(*) FROM day_packages dp WHERE dp.course_version_id=cv.id) AS day_count
            FROM course_versions cv WHERE cv.course_id=? ORDER BY cv.created_at DESC
            """,
            (course_id,),
        )
        items = [dict(r) for r in cur.fetchall()]
    return {"items": items}


@router.post("/api/v1/author/courses/{course_id}/versions")
async def create_course_version(
    course_id: str,
    request: Request,
    version_tag: str = Form(...),
    title: str = Form(""),
    clone_from_version_id: str | None = Form(None),
    camp_id: str | None = Form(None),
    files: list[UploadFile] = File(default=[]),
) -> dict[str, Any]:
    """Create a new draft ``course_version`` for an existing course, either by
    cloning an older version's day packages (``clone_from_version_id``) or by
    uploading one or more ``day-NN-*.yaml`` files, or both (files override
    same-day clones). An empty draft (no clone, no files) is also allowed —
    days can then be authored via the day-editor PUT endpoint."""
    user = require_author(request)
    vid = str(uuid4())
    day_count = 0
    with db_cursor() as cur:
        cur.execute("SELECT id, title AS course_title FROM courses WHERE id=?", (course_id,))
        course = cur.fetchone()
        if not course:
            raise HTTPException(404, "course not found")

        resolved_camp = camp_id
        clone_days: list[dict[str, Any]] = []
        if clone_from_version_id:
            cur.execute(
                "SELECT camp_id FROM course_versions WHERE id=? AND course_id=?",
                (clone_from_version_id, course_id),
            )
            src = cur.fetchone()
            if not src:
                raise HTTPException(404, "clone source version not found")
            resolved_camp = resolved_camp or src["camp_id"]
            cur.execute(
                "SELECT day, title, project, package_json FROM day_packages WHERE course_version_id=?",
                (clone_from_version_id,),
            )
            clone_days = [dict(r) for r in cur.fetchall()]
        if not resolved_camp:
            cur.execute(
                "SELECT camp_id FROM course_versions WHERE course_id=? AND camp_id IS NOT NULL ORDER BY created_at DESC LIMIT 1",
                (course_id,),
            )
            prev = cur.fetchone()
            resolved_camp = (prev and prev["camp_id"]) or session_camp_id(request, None)

        cur.execute(
            """
            INSERT INTO course_versions (id, camp_id, course_id, version_tag, status, title, source, created_by, created_at)
            VALUES (?,?,?,?, 'draft', ?, 'author-ui', ?, NOW())
            """,
            (vid, resolved_camp, course_id, version_tag, title or course["course_title"], user.id),
        )

        for d in clone_days:
            pkg = d["package_json"]
            if isinstance(pkg, str):
                pkg = json.loads(pkg)
            cur.execute(
                "INSERT INTO day_packages (id, course_version_id, day, title, project, package_json) VALUES (?,?,?,?,?,?::jsonb)",
                (str(uuid4()), vid, d["day"], d["title"], d.get("project"), json.dumps(pkg, ensure_ascii=False)),
            )
            day_count += 1

        for f in files:
            name = f.filename or ""
            if not name.endswith((".yaml", ".yml")):
                continue
            raw = await f.read()
            try:
                data = yaml.safe_load(raw.decode("utf-8")) or {}
            except Exception as exc:
                raise HTTPException(400, f"{name}: invalid yaml ({exc})") from exc
            if not isinstance(data, dict) or data.get("day") is None:
                raise HTTPException(400, f"{name}: missing 'day' field")
            day_no = int(data["day"])
            cur.execute(
                """
                INSERT INTO day_packages (id, course_version_id, day, title, project, package_json)
                VALUES (?,?,?,?,?,?::jsonb)
                ON CONFLICT (course_version_id, day) DO UPDATE
                  SET title=EXCLUDED.title, project=EXCLUDED.project, package_json=EXCLUDED.package_json
                """,
                (
                    str(uuid4()),
                    vid,
                    day_no,
                    str(data.get("title") or f"Day {day_no}"),
                    data.get("project"),
                    json.dumps(data, ensure_ascii=False),
                ),
            )
            day_count += 1

    write_audit(
        "author.course_version_create",
        actor_id=user.id,
        camp_id=resolved_camp,
        resource_type="course_version",
        resource_id=vid,
        details={"course_id": course_id, "version_tag": version_tag, "cloned_from": clone_from_version_id, "days": day_count},
    )
    return {"ok": True, "course_version_id": vid, "status": "draft", "days": day_count}


@router.get("/api/v1/author/course-versions/{version_id}/days")
def list_course_version_days(version_id: str, request: Request) -> dict[str, Any]:
    require_author(request)
    with db_cursor() as cur:
        cur.execute("SELECT id FROM course_versions WHERE id=?", (version_id,))
        if not cur.fetchone():
            raise HTTPException(404, "course version not found")
        cur.execute(
            "SELECT day, title, project FROM day_packages WHERE course_version_id=? ORDER BY day",
            (version_id,),
        )
        items = [dict(r) for r in cur.fetchall()]
    return {"items": items}


@router.get("/api/v1/author/course-versions/{version_id}/days/{day}")
def get_course_version_day(version_id: str, day: int, request: Request) -> dict[str, Any]:
    require_author(request)
    with db_cursor() as cur:
        cur.execute(
            "SELECT day, title, project, package_json FROM day_packages WHERE course_version_id=? AND day=?",
            (version_id, day),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(404, "day package not found")
        d = dict(row)
        if isinstance(d.get("package_json"), str):
            d["package_json"] = json.loads(d["package_json"])
    return d


class DayPackageUpdate(BaseModel):
    package_json: dict[str, Any]
    title: str | None = None
    project: str | None = None


def _validate_day_package_payload(pkg: dict[str, Any]) -> None:
    """Mirror frontend dayPackage.validateDayPackage — raise 422 on structural errors."""
    errors: list[str] = []
    title = str(pkg.get("title") or "").strip()
    if not title:
        errors.append("课次标题不能为空")
    day = pkg.get("day")
    try:
        if int(day) < 1:
            errors.append("课次编号无效")
    except Exception:
        errors.append("课次编号无效")
    nodes = pkg.get("nodes") or []
    if not nodes:
        errors.append("至少需要一个学习流程节点")
    types = [str(n.get("type") or n.get("kind") or "") for n in nodes if isinstance(n, dict)]
    types = [t for t in types if t and t != "unlock"]
    if len(types) != len(set(types)):
        errors.append("学习流程节点类型不可重复")
    capsules = ((pkg.get("learn") or {}).get("capsules") or []) if isinstance(pkg.get("learn"), dict) else []
    if "learn" in types and not capsules:
        errors.append("含学习节点时至少需要一课节")
    cap_ids: list[str] = []
    day_res_ids = {
        str(r.get("id") or "").strip()
        for r in (pkg.get("resources") or [])
        if isinstance(r, dict) and str(r.get("id") or "").strip()
    }
    for c in capsules:
        if not isinstance(c, dict):
            continue
        cid = str(c.get("id") or "").strip()
        if not cid:
            errors.append("存在未设置 id 的课节")
        else:
            cap_ids.append(cid)
        for rid in c.get("resource_ids") or []:
            rid_s = str(rid).strip()
            if rid_s and rid_s not in day_res_ids:
                errors.append(f"课节 {cid or '?'} 引用了不存在的资源 id：{rid_s}")
        inline_ids = [
            str(r.get("id") or "").strip()
            for r in (c.get("resources") or [])
            if isinstance(r, dict) and str(r.get("id") or "").strip()
        ]
        if len(inline_ids) != len(set(inline_ids)):
            errors.append(f"课节 {cid or '?'} 内联资源 id 不可重复")
        for m in c.get("media") or []:
            if not isinstance(m, dict):
                continue
            key = str(m.get("object_key") or "").strip()
            if not key:
                errors.append(f"课节 {cid or '?'} 存在缺少 object_key 的媒体条目")
            elif not key.startswith("documents/"):
                errors.append(f"课节 {cid or '?'} 媒体 object_key 应以 documents/ 开头")
        cap_quiz = c.get("quiz") if isinstance(c.get("quiz"), dict) else {}
        for i, q in enumerate(cap_quiz.get("questions") or []):
            if not isinstance(q, dict):
                continue
            if not str(q.get("q") or "").strip():
                errors.append(f"课节 {cid} 节测验第 {i + 1} 题题干为空")
            if not q.get("options"):
                errors.append(f"课节 {cid} 节测验第 {i + 1} 题缺少选项")
    if len(cap_ids) != len(set(cap_ids)):
        errors.append("课节 id 不可重复")
    res_ids = list(day_res_ids)
    if len(res_ids) != len(set(res_ids)):
        errors.append("本课资源 id 不可重复")
    lab = pkg.get("lab") if isinstance(pkg.get("lab"), dict) else {}
    if lab:
        runner = str(lab.get("runner") or "agent")
        sim_kind = lab.get("sim_kind")
        if runner == "sim" and not sim_kind:
            errors.append("Lab runner=sim 时必须设置 sim_kind")
    if errors:
        raise HTTPException(422, "; ".join(errors))


@router.put("/api/v1/author/course-versions/{version_id}/days/{day}")
def update_course_version_day(version_id: str, day: int, body: DayPackageUpdate, request: Request) -> dict[str, Any]:
    """Author-edit one day's package on a draft version. Refuses edits on a
    published version — publishing freezes it (immutability); create a new
    draft (clone or rollback) to make further changes."""
    user = require_author(request)
    with db_cursor() as cur:
        cur.execute("SELECT status FROM course_versions WHERE id=?", (version_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(404, "course version not found")
        if row["status"] == "published":
            raise HTTPException(409, "已发布版本不可修改；请创建新草稿（克隆或回滚）后再编辑")
        title = body.title or str(body.package_json.get("title") or f"Day {day}")
        project = body.project if body.project is not None else body.package_json.get("project")
        # Keep package day field consistent with path
        pkg = dict(body.package_json)
        pkg["day"] = int(day)
        if not pkg.get("title"):
            pkg["title"] = title
        _validate_day_package_payload(pkg)
        cur.execute(
            """
            INSERT INTO day_packages (id, course_version_id, day, title, project, package_json)
            VALUES (?,?,?,?,?,?::jsonb)
            ON CONFLICT (course_version_id, day) DO UPDATE
              SET title=EXCLUDED.title, project=EXCLUDED.project, package_json=EXCLUDED.package_json
            """,
            (str(uuid4()), version_id, day, title, project, json.dumps(pkg, ensure_ascii=False)),
        )
    try:
        project_day_package(version_id, int(day), pkg)
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    except Exception as exc:
        log.warning("curriculum projection failed for %s day %s: %s", version_id, day, exc)
    write_audit(
        "author.day_package_update",
        actor_id=user.id,
        resource_type="day_package",
        resource_id=f"{version_id}:{day}",
    )
    return {"ok": True, "course_version_id": version_id, "day": day}


class BootcampSyncBody(BaseModel):
    days: list[int] | None = None
    dry_run: bool = False
    merge_mode: str = "full"  # full | media_fields


@router.get("/api/v1/author/bootcamp/days")
def list_bootcamp_days(request: Request) -> dict[str, Any]:
    require_author(request)
    return {"items": list_available_days()}


@router.get("/api/v1/author/bootcamp/days/{day}/capsules/{capsule_id}/media")
def get_bootcamp_capsule_media_route(day: int, capsule_id: str, request: Request) -> dict[str, Any]:
    require_author(request)
    from services.author.bootcamp_sync import get_bootcamp_capsule_media

    try:
        media = get_bootcamp_capsule_media(day, capsule_id)
    except ValueError as exc:
        raise HTTPException(404, str(exc)) from exc
    return {"day": day, "capsule_id": capsule_id, "items": media}


@router.post("/api/v1/author/course-versions/{version_id}/sync-bootcamp")
def sync_bootcamp_to_version(version_id: str, body: BootcampSyncBody, request: Request) -> dict[str, Any]:
    """Import day packages from class/bootcamp into a draft course version."""
    user = require_author(request)
    merge_mode = body.merge_mode if body.merge_mode in ("full", "media_fields") else "full"
    available = list_available_days()
    if not available:
        raise HTTPException(404, "class/bootcamp 下没有可同步的 day.yaml")

    target_days = body.days if body.days else available
    invalid = [d for d in target_days if d not in available]
    if invalid:
        raise HTTPException(400, f"bootcamp 不存在这些课次: {invalid}")

    with db_cursor() as cur:
        cur.execute("SELECT status FROM course_versions WHERE id=?", (version_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(404, "course version not found")
        if row["status"] == "published" and not body.dry_run:
            raise HTTPException(409, "已发布版本不可修改；请创建新草稿后再同步")

        existing_by_day: dict[int, dict[str, Any] | None] = {}
        for day in target_days:
            cur.execute(
                "SELECT package_json FROM day_packages WHERE course_version_id=? AND day=?",
                (version_id, day),
            )
            r = cur.fetchone()
            if r:
                pkg = r["package_json"]
                if isinstance(pkg, str):
                    pkg = json.loads(pkg)
                existing_by_day[day] = pkg if isinstance(pkg, dict) else None
            else:
                existing_by_day[day] = None

    previews, errors = sync_bootcamp_days(existing_by_day, target_days, merge_mode)  # type: ignore[arg-type]

    if body.dry_run:
        return {
            "dry_run": True,
            "merge_mode": merge_mode,
            "days": [
                {
                    "day": p["day"],
                    "title": p["title"],
                    "capsule_count": p["capsule_count"],
                    "capsules": p["capsules"],
                    "changes": p["changes"],
                }
                for p in previews
            ],
            "errors": errors,
        }

    updated: list[int] = []
    with db_cursor() as cur:
        cur.execute("SELECT status FROM course_versions WHERE id=?", (version_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(404, "course version not found")
        if row["status"] == "published":
            raise HTTPException(409, "已发布版本不可修改")

        for preview in previews:
            day = int(preview["day"])
            pkg = preview["package_json"]
            title = str(pkg.get("title") or f"Day {day}")
            project = pkg.get("project")
            _validate_day_package_payload(pkg)
            cur.execute(
                """
                INSERT INTO day_packages (id, course_version_id, day, title, project, package_json)
                VALUES (?,?,?,?,?,?::jsonb)
                ON CONFLICT (course_version_id, day) DO UPDATE
                  SET title=EXCLUDED.title, project=EXCLUDED.project, package_json=EXCLUDED.package_json
                """,
                (str(uuid4()), version_id, day, title, project, json.dumps(pkg, ensure_ascii=False)),
            )
            try:
                project_day_package(version_id, day, pkg)
            except Exception as exc:
                log.warning("curriculum projection failed for bootcamp sync %s day %s: %s", version_id, day, exc)
            updated.append(day)

    write_audit(
        "author.bootcamp_sync",
        actor_id=user.id,
        resource_type="course_version",
        resource_id=version_id,
        details={"days": updated, "merge_mode": merge_mode},
    )
    return {"dry_run": False, "merge_mode": merge_mode, "updated": updated, "errors": errors}


class DayCreateBody(BaseModel):
    day: int | None = None
    title: str | None = None
    week: int | None = None
    clone_from_day: int | None = None


def _empty_day_template(day: int, title: str, week: int) -> dict[str, Any]:
    return {
        "camp_version": "v0.3",
        "day": day,
        "title": title,
        "week": week,
        "project": "",
        "project_brief": "",
        "review_checklist": ["完成当日主路径节点", "产物可预览 / 可验收"],
        "resources": [],
        "learn": {
            "require_capsules": True,
            "estimated_minutes": 60,
            "lingzhi_tags": [f"day:{day}"],
            "capsules": [
                {
                    "id": "c1",
                    "title": "第一节",
                    "minutes": 15,
                    "content": "在此编写学习正文…",
                    "practice": "用一句话写下本节要点。",
                }
            ],
            "steps": [],
        },
        "quiz": {
            "pass_rate": 0.8,
            "questions": [
                {
                    "q": "示例题：本节最重要的结论是？",
                    "options": ["选项 A", "选项 B", "选项 C"],
                    "answer": 0,
                    "explain": "请按课纲改写本题。",
                }
            ],
        },
        "lab": {
            "runner": "agent",
            "workspace_mode": "cumulative",
            "primary_files": ["index.html"],
            "agent": {"prompt_template": "请根据本节目标生成可验收的产物。"},
            "rubric": [{"check": "file_exists", "args": {"path": "index.html"}}],
            "coach": {"help_mode": "explain", "max_help_level": 2},
        },
        "nodes": [
            {"type": "learn", "title": "学习"},
            {"type": "quiz", "title": "小测"},
            {"type": "lab", "title": "实训"},
            {"type": "project", "title": "企业任务"},
            {"type": "review", "title": "自检"},
        ],
    }


@router.post("/api/v1/author/course-versions/{version_id}/days")
def create_course_version_day(version_id: str, body: DayCreateBody, request: Request) -> dict[str, Any]:
    """Create a new Day package on a draft version (empty template or clone)."""
    user = require_author(request)
    with db_cursor() as cur:
        cur.execute(
            "SELECT id, status, course_id, title FROM course_versions WHERE id=?",
            (version_id,),
        )
        ver = cur.fetchone()
        if not ver:
            raise HTTPException(404, "course version not found")
        if ver["status"] == "published":
            raise HTTPException(409, "已发布版本不可新增课次")

        cur.execute(
            "SELECT COALESCE(MAX(day), 0) AS m FROM day_packages WHERE course_version_id=?",
            (version_id,),
        )
        max_day = int(cur.fetchone()["m"] or 0)
        day_no = int(body.day) if body.day is not None else max_day + 1
        if day_no < 1 or day_no > 31:
            raise HTTPException(400, "day must be 1–31")
        cur.execute(
            "SELECT 1 FROM day_packages WHERE course_version_id=? AND day=?",
            (version_id, day_no),
        )
        if cur.fetchone():
            raise HTTPException(409, f"Day {day_no} 已存在")

        pkg: dict[str, Any]
        if body.clone_from_day is not None:
            cur.execute(
                "SELECT title, project, package_json FROM day_packages WHERE course_version_id=? AND day=?",
                (version_id, int(body.clone_from_day)),
            )
            src = cur.fetchone()
            if not src:
                raise HTTPException(404, "clone source day not found")
            raw = src["package_json"]
            pkg = json.loads(raw) if isinstance(raw, str) else dict(raw or {})
            pkg["day"] = day_no
            pkg["title"] = body.title or f"{src['title']}（副本）"
        else:
            week = body.week if body.week is not None else (1 if day_no <= 5 else 2)
            title = (body.title or "").strip() or f"第 {day_no} 课"
            pkg = _empty_day_template(day_no, title, week)

        title = str(pkg.get("title") or f"Day {day_no}")
        project = pkg.get("project")
        cur.execute(
            """
            INSERT INTO day_packages (id, course_version_id, day, title, project, package_json)
            VALUES (?,?,?,?,?,?::jsonb)
            """,
            (str(uuid4()), version_id, day_no, title, project, json.dumps(pkg, ensure_ascii=False)),
        )
    try:
        project_day_package(version_id, day_no, pkg)
    except Exception as exc:
        log.warning("curriculum projection failed for new day %s/%s: %s", version_id, day_no, exc)
    write_audit(
        "author.day_package_create",
        actor_id=user.id,
        resource_type="day_package",
        resource_id=f"{version_id}:{day_no}",
    )
    return {"ok": True, "course_version_id": version_id, "day": day_no, "title": title, "package_json": pkg}


@router.delete("/api/v1/author/course-versions/{version_id}/days/{day}")
def delete_course_version_day(version_id: str, day: int, request: Request) -> dict[str, Any]:
    user = require_author(request)
    with db_cursor() as cur:
        cur.execute("SELECT status FROM course_versions WHERE id=?", (version_id,))
        ver = cur.fetchone()
        if not ver:
            raise HTTPException(404, "course version not found")
        if ver["status"] == "published":
            raise HTTPException(409, "已发布版本不可删除课次")
        cur.execute(
            "DELETE FROM day_packages WHERE course_version_id=? AND day=? RETURNING day",
            (version_id, day),
        )
        deleted = cur.fetchone()
        if not deleted:
            raise HTTPException(404, "day package not found")
    try:
        delete_projected_day(version_id, int(day))
    except Exception as exc:
        log.warning("curriculum projection delete failed for %s day %s: %s", version_id, day, exc)
    write_audit(
        "author.day_package_delete",
        actor_id=user.id,
        resource_type="day_package",
        resource_id=f"{version_id}:{day}",
    )
    return {"ok": True, "course_version_id": version_id, "day": day}


@router.get("/api/v1/author/course-versions/{version_id}")
def get_course_version(version_id: str, request: Request) -> dict[str, Any]:
    require_author(request)
    with db_cursor() as cur:
        cur.execute(
            """
            SELECT v.id, v.camp_id, v.course_id, v.version_tag, v.status, v.title, v.source,
                   v.published_at, v.created_at, c.title AS course_title, c.slug AS course_slug
            FROM course_versions v
            LEFT JOIN courses c ON c.id = v.course_id
            WHERE v.id=?
            """,
            (version_id,),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(404, "course version not found")
        cur.execute(
            "SELECT COUNT(*) AS c FROM day_packages WHERE course_version_id=?",
            (version_id,),
        )
        day_count = int(cur.fetchone()["c"] or 0)
    d = dict(row)
    d["day_count"] = day_count
    return d


@router.post("/api/v1/author/course-versions/{version_id}/media")
async def upload_course_media(
    version_id: str,
    request: Request,
    file: UploadFile = File(...),
    day: int = Form(...),
    capsule_id: str = Form("c1"),
    kind: str = Form("video"),
) -> dict[str, Any]:
    """Upload capsule video/audio/poster into MinIO under course-media prefix."""
    user = require_author(request)
    kind_l = (kind or "video").strip().lower()
    if kind_l not in {"video", "audio", "poster", "image"}:
        raise HTTPException(400, "kind must be video|audio|poster|image")
    with db_cursor() as cur:
        cur.execute("SELECT id, camp_id, status FROM course_versions WHERE id=?", (version_id,))
        ver = cur.fetchone()
        if not ver:
            raise HTTPException(404, "course version not found")
        if ver["status"] == "published":
            raise HTTPException(409, "已发布版本不可上传媒体")
        camp = ver["camp_id"] or session_camp_id(request, None)

    name = file.filename or f"media-{kind_l}.bin"
    ext = Path(name).suffix.lower() or {
        "video": ".mp4",
        "audio": ".mp3",
        "poster": ".jpg",
        "image": ".png",
    }.get(kind_l, ".bin")
    data = await file.read()
    max_bytes = MEDIA_MAX_BYTES_BY_KIND.get(kind_l, DEFAULT_UPLOAD_MAX_BYTES)
    if len(data) > max_bytes:
        raise HTTPException(413, f"{kind_l} too large")
    ctype = file.content_type or "application/octet-stream"
    safe_cap = "".join(ch for ch in (capsule_id or "c1") if ch.isalnum() or ch in "-_") or "c1"
    key = course_media_key(f"day{int(day):02d}-{safe_cap}-{uuid4().hex[:10]}{ext}", camp_id=camp)
    get_store().put_bytes(S3_BUCKET_DOCUMENTS, key, data, content_type=ctype)
    write_audit(
        "author.course_media_upload",
        actor_id=user.id,
        camp_id=camp,
        resource_type="course_media",
        resource_id=key,
        details={"version_id": version_id, "day": day, "capsule_id": capsule_id, "kind": kind_l},
    )
    return {
        "ok": True,
        "object_key": key,
        "kind": kind_l,
        "content_type": ctype,
        "size_bytes": len(data),
        "filename": name,
        "stream_url": f"/api/v1/media/stream?object_key={key}",
    }


class PublishNote(BaseModel):
    note: str = ""


@router.post("/api/v1/author/course-versions/{version_id}/publish")
def publish_course_version(version_id: str, request: Request, body: PublishNote = PublishNote()) -> dict[str, Any]:
    """Publish a draft version. Immutability: a version that is already
    ``published`` cannot be published again or edited further — create a new
    draft (clone / rollback) to ship a change. Publishing one version
    archives any other currently-published version in the same camp."""
    user = require_author(request)
    note = body.note or ""
    with db_cursor() as cur:
        cur.execute("SELECT id, camp_id, course_id, status FROM course_versions WHERE id=?", (version_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(404, "course version not found")
        if row["status"] == "published":
            raise HTTPException(409, "该版本已发布，发布版本不可变；请创建新草稿后再发布")
        cur.execute("SELECT COUNT(*) AS c FROM day_packages WHERE course_version_id=?", (version_id,))
        if int(cur.fetchone()["c"]) == 0:
            raise HTTPException(400, "草稿没有任何 Day 内容，无法发布")
        cur.execute(
            "UPDATE course_versions SET status='published', published_at=NOW() WHERE id=?",
            (version_id,),
        )
        if row["camp_id"]:
            cur.execute(
                "UPDATE course_versions SET status='archived' WHERE camp_id=? AND id<>? AND status='published'",
                (row["camp_id"], version_id),
            )
        eid = str(uuid4())
        cur.execute(
            "INSERT INTO publish_events (id, course_version_id, actor_id, action, note, created_at) VALUES (?,?,?,?,?,NOW())",
            (eid, version_id, user.id, "publish", note),
        )
    _seed_rubrics(version_id)
    try:
        project_course_version(version_id)
    except Exception as exc:
        log.warning("curriculum full projection failed on publish %s: %s", version_id, exc)
    write_audit(
        "author.course_publish",
        actor_id=user.id,
        camp_id=row["camp_id"],
        resource_type="course_version",
        resource_id=version_id,
    )
    return {"ok": True, "course_version_id": version_id, "status": "published"}


@router.post("/api/v1/author/course-versions/{version_id}/rollback")
def rollback_course_version(version_id: str, request: Request) -> dict[str, Any]:
    """Roll back to an older *published* version by creating a brand-new
    draft that clones its day packages. The rollback draft itself must still
    be explicitly published to go live — this never mutates history."""
    user = require_author(request)
    with db_cursor() as cur:
        cur.execute(
            "SELECT id, camp_id, course_id, version_tag, title, status FROM course_versions WHERE id=?",
            (version_id,),
        )
        src = cur.fetchone()
        if not src:
            raise HTTPException(404, "course version not found")
        if src["status"] != "published":
            raise HTTPException(400, "只能从已发布版本回滚生成新草稿")

        new_id = str(uuid4())
        new_tag = f"{src['version_tag']}-rollback-{uuid4().hex[:6]}"
        cur.execute(
            """
            INSERT INTO course_versions (id, camp_id, course_id, version_tag, status, title, source, created_by, created_at)
            VALUES (?,?,?,?, 'draft', ?, 'rollback', ?, NOW())
            """,
            (new_id, src["camp_id"], src["course_id"], new_tag, f"{src['title']}（回滚草稿）", user.id),
        )
        cur.execute(
            "SELECT day, title, project, package_json FROM day_packages WHERE course_version_id=?",
            (version_id,),
        )
        days = cur.fetchall()
        for d in days:
            pkg = d["package_json"]
            if isinstance(pkg, str):
                pkg = json.loads(pkg)
            cur.execute(
                "INSERT INTO day_packages (id, course_version_id, day, title, project, package_json) VALUES (?,?,?,?,?,?::jsonb)",
                (str(uuid4()), new_id, d["day"], d["title"], d.get("project"), json.dumps(pkg, ensure_ascii=False)),
            )
    try:
        project_course_version(new_id)
    except Exception as exc:
        log.warning("curriculum projection after rollback %s failed: %s", new_id, exc)
    write_audit(
        "author.course_version_rollback",
        actor_id=user.id,
        camp_id=src["camp_id"],
        resource_type="course_version",
        resource_id=new_id,
        details={"rolled_back_from": version_id, "days": len(days)},
    )
    return {"ok": True, "course_version_id": new_id, "status": "draft", "rolled_back_from": version_id, "days": len(days)}


@router.get("/api/v1/author/evidence")
def author_evidence(request: Request, learner_id: str | None = None, limit: int = 50) -> dict[str, Any]:
    require_author(request)
    with db_cursor() as cur:
        if learner_id:
            cur.execute(
                "SELECT id, ts, learner_id, day, node_id, kind, capability_tags FROM evidence WHERE learner_id=? ORDER BY ts DESC LIMIT ?",
                (learner_id, limit),
            )
        else:
            cur.execute(
                "SELECT id, ts, learner_id, day, node_id, kind, capability_tags FROM evidence ORDER BY ts DESC LIMIT ?",
                (limit,),
            )
        return {"items": [dict(r) for r in cur.fetchall()]}


@router.get("/api/v1/author/jobs")
def author_jobs(request: Request, learner_id: str | None = None, limit: int = 50) -> dict[str, Any]:
    require_author(request)
    with db_cursor() as cur:
        if learner_id:
            cur.execute(
                "SELECT id, kind, learner_id, camp_id, status, created_at FROM jobs WHERE learner_id=? ORDER BY created_at DESC LIMIT ?",
                (learner_id, limit),
            )
        else:
            cur.execute(
                "SELECT id, kind, learner_id, camp_id, status, created_at FROM jobs ORDER BY created_at DESC LIMIT ?",
                (limit,),
            )
        return {"items": [dict(r) for r in cur.fetchall()]}


# ---------------------------------------------------------------------------
# M5: mentor review handoff — learner-initiated "申请导师复核" requests
# (created by POST /api/v1/coach/handoff) queued here for an author/admin to
# resolve. Feedback submitted here also lands on the linked submission's
# feedback/score when one exists, so `Submissions` stays the single source of
# truth for a learner's grade.
# ---------------------------------------------------------------------------


@router.get("/api/v1/author/reviews")
def list_mentor_reviews(
    request: Request,
    status: str | None = "pending",
    camp_id: str | None = None,
    limit: int = 50,
) -> dict[str, Any]:
    require_author(request)
    clauses: list[str] = []
    params: list[Any] = []
    if status:
        clauses.append("status=?")
        params.append(status)
    if camp_id:
        clauses.append("camp_id=?")
        params.append(camp_id)
    where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    params.append(limit)
    with db_cursor() as cur:
        cur.execute(
            f"""
            SELECT id, learner_id, camp_id, enrollment_id, day, node_id, submission_id, coach_turn_id,
                   reason, diagnostics_json, status, mentor_id, mentor_feedback, mentor_score,
                   created_at, resolved_at
            FROM mentor_reviews {where}
            ORDER BY created_at DESC LIMIT ?
            """,
            params,
        )
        items = []
        for r in cur.fetchall():
            d = dict(r)
            dj = d.get("diagnostics_json")
            d["diagnostics_json"] = json.loads(dj) if isinstance(dj, str) else (dj or {})
            items.append(d)
    return {"items": items}


class MentorReviewFeedback(BaseModel):
    feedback: str
    score: float | None = None
    status: str = "resolved"


@router.post("/api/v1/author/reviews/{review_id}/feedback")
def submit_mentor_review_feedback(review_id: str, body: MentorReviewFeedback, request: Request) -> dict[str, Any]:
    user = require_author(request)
    with db_cursor() as cur:
        cur.execute("SELECT id, submission_id FROM mentor_reviews WHERE id=?", (review_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(404, "mentor review not found")
        cur.execute(
            """
            UPDATE mentor_reviews
            SET mentor_feedback=?, mentor_score=?, status=?, mentor_id=?, resolved_at=NOW()
            WHERE id=?
            """,
            (body.feedback, body.score, body.status, user.id, review_id),
        )
        if row["submission_id"]:
            # Extend the existing submissions feedback/score — keep them in sync
            # instead of introducing a second, competing source of truth.
            cur.execute(
                "UPDATE submissions SET feedback=?, score=COALESCE(?, score) WHERE id=?",
                (body.feedback, body.score, row["submission_id"]),
            )
    write_audit(
        "author.mentor_review_feedback",
        actor_id=user.id,
        resource_type="mentor_review",
        resource_id=review_id,
        details={"submission_id": row["submission_id"], "status": body.status},
    )
    return {"ok": True, "id": review_id, "status": body.status, "submission_id": row["submission_id"]}


class KeyBody(BaseModel):
    lingzhi_api_key: str = ""


@router.put("/api/v1/author/camps/{camp_id}/key")
def set_key(camp_id: str, body: KeyBody, request: Request) -> dict[str, Any]:
    require_author(request)
    with db_cursor() as cur:
        cur.execute("UPDATE camps SET lingzhi_api_key=? WHERE id=?", (body.lingzhi_api_key or None, camp_id))
        cur.execute("SELECT id FROM camps WHERE id=?", (camp_id,))
        if not cur.fetchone():
            raise HTTPException(404, "camp not found")
    return {"ok": True, "camp_id": camp_id, "masked": mask_secret(body.lingzhi_api_key)}


# ---------------------------------------------------------------------------
# M4: resource packs — link previously-uploaded object keys (documents,
# media, or any other MinIO object) to a course_version/day/node so lab
# nodes can offer downloadable datasets/templates. `learning_resources`
# already carries `course_version_id`/`day_index`; `node_id` (no dedicated
# column) rides along in `meta_json`.
# ---------------------------------------------------------------------------


class ResourcePackCreate(BaseModel):
    name: str
    description: str = ""
    course_version_id: str | None = None


class ResourcePackPatch(BaseModel):
    name: str | None = None
    description: str | None = None
    course_version_id: str | None = None


class ResourceLink(BaseModel):
    course_version_id: str | None = None
    day_index: int | None = None
    node_id: str | None = None
    kind: str = "dataset"  # doc|video|link|dataset|template
    title: str
    object_key: str | None = None
    url: str | None = None
    meta: dict[str, Any] = Field(default_factory=dict)


def _pack_row(row: Any) -> dict[str, Any]:
    return dict(row)


@router.post("/api/v1/author/resource-packs")
def create_resource_pack(body: ResourcePackCreate, request: Request) -> dict[str, Any]:
    user = require_author(request)
    pack_id = str(uuid4())
    with db_cursor() as cur:
        cur.execute(
            """
            INSERT INTO resource_packs (id, course_version_id, name, description, created_at, updated_at)
            VALUES (?,?,?,?,NOW(),NOW())
            """,
            (pack_id, body.course_version_id, body.name, body.description),
        )
    write_audit("author.resource_pack_create", actor_id=user.id, resource_type="resource_pack", resource_id=pack_id)
    return {"id": pack_id, "name": body.name, "description": body.description, "course_version_id": body.course_version_id}


@router.get("/api/v1/author/resource-packs")
def list_resource_packs(
    request: Request,
    course_version_id: str | None = None,
    q: str | None = None,
    page: int | None = None,
    page_size: int | None = None,
) -> dict[str, Any]:
    require_author(request)
    page_i, size_i = parse_page(page, page_size)
    off, lim = offset_limit(page_i, size_i)
    where = ["deleted_at IS NULL"]
    args: list[Any] = []
    if course_version_id:
        where.append("course_version_id=?")
        args.append(course_version_id)
    if q and q.strip():
        where.append("(name ILIKE ? OR COALESCE(description,'') ILIKE ?)")
        like = f"%{q.strip()}%"
        args.extend([like, like])
    where_sql = " AND ".join(where)
    with db_cursor() as cur:
        cur.execute(f"SELECT COUNT(*) AS c FROM resource_packs WHERE {where_sql}", args)
        total = int(cur.fetchone()["c"] or 0)
        cur.execute(
            f"""
            SELECT * FROM resource_packs
            WHERE {where_sql}
            ORDER BY created_at DESC
            OFFSET ? LIMIT ?
            """,
            (*args, off, lim),
        )
        packs = [_pack_row(r) for r in cur.fetchall()]
    return page_meta(packs, total, page_i, size_i)


@router.get("/api/v1/author/resource-packs/{pack_id}")
def get_resource_pack(pack_id: str, request: Request) -> dict[str, Any]:
    require_author(request)
    with db_cursor() as cur:
        cur.execute(
            "SELECT * FROM resource_packs WHERE id=? AND deleted_at IS NULL",
            (pack_id,),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(404, "resource pack not found")
        cur.execute(
            "SELECT COUNT(*) AS c FROM learning_resources WHERE pack_id=? AND deleted_at IS NULL",
            (pack_id,),
        )
        count = int(cur.fetchone()["c"] or 0)
    d = _pack_row(row)
    d["resource_count"] = count
    return d


@router.patch("/api/v1/author/resource-packs/{pack_id}")
def patch_resource_pack(pack_id: str, body: ResourcePackPatch, request: Request) -> dict[str, Any]:
    user = require_author(request)
    with db_cursor() as cur:
        cur.execute("SELECT * FROM resource_packs WHERE id=? AND deleted_at IS NULL", (pack_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(404, "resource pack not found")
        sets: list[str] = ["updated_at=NOW()"]
        args: list[Any] = []
        if body.name is not None:
            sets.append("name=?")
            args.append(body.name.strip() or row["name"])
        if body.description is not None:
            sets.append("description=?")
            args.append(body.description)
        if body.course_version_id is not None:
            sets.append("course_version_id=?")
            args.append(body.course_version_id or None)
        if len(args) == 0:
            return _pack_row(row)
        args.append(pack_id)
        cur.execute(f"UPDATE resource_packs SET {', '.join(sets)} WHERE id=?", args)
        cur.execute("SELECT * FROM resource_packs WHERE id=?", (pack_id,))
        updated = cur.fetchone()
    write_audit("author.resource_pack_patch", actor_id=user.id, resource_type="resource_pack", resource_id=pack_id)
    return _pack_row(updated)


@router.delete("/api/v1/author/resource-packs/{pack_id}")
def delete_resource_pack(pack_id: str, request: Request) -> dict[str, Any]:
    user = require_author(request)
    with db_cursor() as cur:
        cur.execute("SELECT id FROM resource_packs WHERE id=? AND deleted_at IS NULL", (pack_id,))
        if not cur.fetchone():
            raise HTTPException(404, "resource pack not found")
        cur.execute(
            "UPDATE resource_packs SET deleted_at=NOW(), updated_at=NOW() WHERE id=?",
            (pack_id,),
        )
        cur.execute(
            "UPDATE learning_resources SET deleted_at=NOW(), updated_at=NOW() WHERE pack_id=? AND deleted_at IS NULL",
            (pack_id,),
        )
    write_audit("author.resource_pack_delete", actor_id=user.id, resource_type="resource_pack", resource_id=pack_id)
    return {"ok": True, "id": pack_id}


@router.post("/api/v1/author/resource-packs/{pack_id}/resources")
def link_resource(pack_id: str, body: ResourceLink, request: Request) -> dict[str, Any]:
    """Link an object key (or external URL) already stored in MinIO to a
    course_version/day/node — does not upload; upload first via
    `/api/v1/author/documents` or the media pipeline, then link the
    resulting `object_key` here."""
    user = require_author(request)
    with db_cursor() as cur:
        cur.execute("SELECT id FROM resource_packs WHERE id=? AND deleted_at IS NULL", (pack_id,))
        if not cur.fetchone():
            raise HTTPException(404, "resource pack not found")
        if not body.object_key and not body.url:
            raise HTTPException(400, "object_key or url required")
        rid = str(uuid4())
        meta = dict(body.meta)
        if body.node_id:
            meta["node_id"] = body.node_id
        cur.execute(
            """
            INSERT INTO learning_resources
            (id, pack_id, course_version_id, day_index, kind, title, object_key, url, meta_json, created_at, updated_at)
            VALUES (?,?,?,?,?,?,?,?,?::jsonb,NOW(),NOW())
            """,
            (rid, pack_id, body.course_version_id, body.day_index, body.kind, body.title, body.object_key, body.url, json.dumps(meta, ensure_ascii=False)),
        )
    write_audit(
        "author.resource_link",
        actor_id=user.id,
        resource_type="learning_resource",
        resource_id=rid,
        details={"pack_id": pack_id, "node_id": body.node_id, "object_key": body.object_key},
    )
    return {"id": rid, "pack_id": pack_id, "node_id": body.node_id, "object_key": body.object_key, "url": body.url}


@router.get("/api/v1/author/resource-packs/{pack_id}/resources")
def list_pack_resources(
    pack_id: str,
    request: Request,
    q: str | None = None,
    day_index: int | None = None,
    node_id: str | None = None,
    page: int | None = None,
    page_size: int | None = None,
) -> dict[str, Any]:
    require_author(request)
    page_i, size_i = parse_page(page, page_size)
    off, lim = offset_limit(page_i, size_i)
    with db_cursor() as cur:
        cur.execute("SELECT id FROM resource_packs WHERE id=? AND deleted_at IS NULL", (pack_id,))
        if not cur.fetchone():
            raise HTTPException(404, "resource pack not found")
        where = ["pack_id=?", "deleted_at IS NULL"]
        args: list[Any] = [pack_id]
        if q and q.strip():
            where.append("title ILIKE ?")
            args.append(f"%{q.strip()}%")
        if day_index is not None:
            where.append("day_index=?")
            args.append(int(day_index))
        if node_id and node_id.strip():
            where.append("meta_json->>'node_id'=?")
            args.append(node_id.strip())
        where_sql = " AND ".join(where)
        cur.execute(f"SELECT COUNT(*) AS c FROM learning_resources WHERE {where_sql}", args)
        total = int(cur.fetchone()["c"] or 0)
        cur.execute(
            f"""
            SELECT * FROM learning_resources
            WHERE {where_sql}
            ORDER BY created_at DESC
            OFFSET ? LIMIT ?
            """,
            (*args, off, lim),
        )
        items = []
        for r in cur.fetchall():
            d = dict(r)
            m = d.get("meta_json")
            d["meta_json"] = json.loads(m) if isinstance(m, str) else (m or {})
            items.append(d)
    return page_meta(items, total, page_i, size_i)


@router.delete("/api/v1/author/resource-packs/{pack_id}/resources/{resource_id}")
def delete_pack_resource(pack_id: str, resource_id: str, request: Request) -> dict[str, Any]:
    user = require_author(request)
    with db_cursor() as cur:
        cur.execute(
            """
            UPDATE learning_resources
            SET deleted_at=NOW(), updated_at=NOW()
            WHERE id=? AND pack_id=? AND deleted_at IS NULL
            RETURNING id
            """,
            (resource_id, pack_id),
        )
        deleted = cur.fetchone()
        if not deleted:
            raise HTTPException(404, "resource not found")
    write_audit(
        "author.resource_unlink",
        actor_id=user.id,
        resource_type="learning_resource",
        resource_id=resource_id,
        details={"pack_id": pack_id},
    )
    return {"ok": True, "id": resource_id, "pack_id": pack_id}


# ---------------------------------------------------------------------------
# M6: certificate issuance/revocation — author/admin only. Public verify
# lives at `GET /api/v1/certificates/{cert_id}/verify` (services.learner.app).
# ---------------------------------------------------------------------------


class CertificateIssueBody(BaseModel):
    enrollment_id: str
    allow_unverified: bool | None = None
    mentor_approved: bool = True
    min_completion_rate: float = 1.0
    template_id: str | None = None


@router.post("/api/v1/author/certificates/issue")
def issue_certificate_route(body: CertificateIssueBody, request: Request) -> dict[str, Any]:
    from services.application.certificates import CertificateError, issue_certificate

    user = require_author(request)
    try:
        result = issue_certificate(
            body.enrollment_id,
            actor_id=user.id,
            allow_unverified=body.allow_unverified,
            mentor_approved=body.mentor_approved,
            min_completion_rate=body.min_completion_rate,
            template_id=body.template_id,
        )
    except CertificateError as exc:
        raise HTTPException(409, str(exc)) from exc
    return result


class CertificateRevokeBody(BaseModel):
    reason: str


@router.post("/api/v1/author/certificates/{cert_id}/revoke")
def revoke_certificate_route(cert_id: str, body: CertificateRevokeBody, request: Request) -> dict[str, Any]:
    from services.application.certificates import CertificateError, revoke_certificate

    user = require_author(request)
    if not body.reason or not body.reason.strip():
        raise HTTPException(400, "revoke reason required")
    try:
        return revoke_certificate(cert_id, body.reason.strip(), actor_id=user.id)
    except CertificateError as exc:
        raise HTTPException(404, str(exc)) from exc


# --- Site maintenance (Landing) ---------------------------------------------

class LandingPatch(BaseModel):
    title: str | None = None
    tagline: str | None = None
    cta: dict[str, Any] | None = None
    brand: dict[str, Any] | None = None
    hero: dict[str, Any] | None = None
    seo: dict[str, Any] | None = None
    tabs: list[dict[str, Any]] | None = None
    enterprise: dict[str, Any] | None = None
    about: dict[str, Any] | None = None
    contact: dict[str, Any] | None = None


@router.get("/api/v1/author/site/landing")
def author_get_landing(request: Request) -> dict[str, Any]:
    require_author(request)
    return site_content.get_landing_raw()


@router.patch("/api/v1/author/site/landing")
def author_patch_landing(body: LandingPatch, request: Request) -> dict[str, Any]:
    user = require_author(request)
    payload = body.model_dump(exclude_unset=True)
    result = site_content.patch_landing(payload)
    write_audit("author.site_landing_patch", actor_id=user.id, resource_type="site_page", resource_id="landing")
    return result


@router.post("/api/v1/author/site/hero")
async def author_upload_hero(
    request: Request,
    video: UploadFile | None = File(None),
    poster: UploadFile | None = File(None),
    captions: UploadFile | None = File(None),
) -> dict[str, Any]:
    user = require_author(request)
    store = get_store()
    object_key = poster_key = captions_key = None

    if video is not None and video.filename:
        data = await video.read()
        if len(data) > MEDIA_MAX_BYTES_BY_KIND["video"]:
            raise HTTPException(413, "视频超过 200MB")
        if not data:
            raise HTTPException(400, "empty video")
        ext = Path(video.filename).suffix.lower() or ".mp4"
        object_key = site_hero_key("video", uuid4().hex[:12], ext)
        store.put_bytes(S3_BUCKET_DOCUMENTS, object_key, data, content_type=video.content_type or "video/mp4")

    if poster is not None and poster.filename:
        data = await poster.read()
        if len(data) > MEDIA_MAX_BYTES_BY_KIND["poster"]:
            raise HTTPException(413, "海报超过 8MB")
        ext = Path(poster.filename).suffix.lower() or ".jpg"
        poster_key = site_hero_key("poster", uuid4().hex[:12], ext)
        store.put_bytes(S3_BUCKET_DOCUMENTS, poster_key, data, content_type=poster.content_type or "image/jpeg")

    if captions is not None and captions.filename:
        data = await captions.read()
        if len(data) > 2 * 1024 * 1024:
            raise HTTPException(413, "字幕超过 2MB")
        ext = Path(captions.filename).suffix.lower() or ".vtt"
        captions_key = site_hero_key("captions", uuid4().hex[:12], ext)
        store.put_bytes(S3_BUCKET_DOCUMENTS, captions_key, data, content_type=captions.content_type or "text/vtt")

    if not object_key and not poster_key and not captions_key:
        raise HTTPException(400, "video、poster 或 captions 至少上传一个")

    # Merge onto existing hero so partial uploads don't wipe other assets
    existing = site_content.get_landing_raw().get("hero_video") or {}
    media = site_content.upsert_site_media(
        "hero_video",
        object_key=object_key or existing.get("object_key") or existing.get("src_url"),
        src_url=object_key or existing.get("src_url") or existing.get("object_key"),
        poster_url=poster_key or existing.get("poster_url") or existing.get("poster_key"),
        captions_url=captions_key or existing.get("captions_url") or existing.get("captions_key"),
    )
    write_audit("author.site_hero_upload", actor_id=user.id, resource_type="site_page", resource_id="landing")
    return {"ok": True, "hero_video": media}


@router.post("/api/v1/author/site/mentors/{mentor_id}/avatar")
async def author_mentor_avatar(
    mentor_id: str,
    request: Request,
    avatar: UploadFile = File(...),
) -> dict[str, Any]:
    user = require_author(request)
    if not avatar.filename:
        raise HTTPException(400, "avatar file required")
    data = await avatar.read()
    if len(data) > MEDIA_MAX_BYTES_BY_KIND["poster"]:
        raise HTTPException(413, "头像超过 8MB")
    ext = Path(avatar.filename).suffix.lower() or ".jpg"
    key = site_mentor_avatar_key(mentor_id, uuid4().hex[:10], ext)
    get_store().put_bytes(S3_BUCKET_DOCUMENTS, key, data, content_type=avatar.content_type or "image/jpeg")
    landing = site_content.update_mentor_avatar_key(mentor_id, key)
    write_audit(
        "author.site_mentor_avatar",
        actor_id=user.id,
        resource_type="site_page",
        resource_id=mentor_id,
        details={"avatar_key": key},
    )
    mentor = next(
        (m for m in (landing.get("enterprise") or {}).get("mentors") or [] if str(m.get("id")) == mentor_id),
        None,
    )
    return {"ok": True, "mentor_id": mentor_id, "avatar_key": key, "mentor": mentor, "landing": landing}


@router.get("/api/v1/author/site/contact-leads")
def author_list_contact_leads(
    request: Request,
    q: str | None = None,
    page: int | None = None,
    page_size: int | None = None,
) -> dict[str, Any]:
    require_author(request)
    page_i, size_i = parse_page(page, page_size)
    off, lim = offset_limit(page_i, size_i)
    where = ["1=1"]
    args: list[Any] = []
    if q and q.strip():
        where.append("(name ILIKE ? OR COALESCE(org,'') ILIKE ? OR COALESCE(email,'') ILIKE ?)")
        like = f"%{q.strip()}%"
        args.extend([like, like, like])
    where_sql = " AND ".join(where)
    with db_cursor() as cur:
        cur.execute("SELECT to_regclass(?) AS reg", ("contact_leads",))
        if not cur.fetchone().get("reg"):
            return page_meta([], 0, page_i, size_i)
        cur.execute(f"SELECT COUNT(*) AS c FROM contact_leads WHERE {where_sql}", args)
        total = int(cur.fetchone()["c"] or 0)
        cur.execute(
            f"""
            SELECT id, name, org, email, message, created_at
            FROM contact_leads
            WHERE {where_sql}
            ORDER BY created_at DESC
            OFFSET ? LIMIT ?
            """,
            (*args, off, lim),
        )
        items = [dict(r) for r in cur.fetchall()]
    return page_meta(items, total, page_i, size_i)


# --- Site open courses (Landing「免费公开课」) ---------------------------------

class OpenCourseIn(BaseModel):
    id: str | None = None
    title: str
    minutes: int | None = None
    level: str | None = None
    summary: str | None = None
    object_key: str | None = None
    poster_key: str | None = None
    duration_sec: int | None = None
    published: bool = True


@router.get("/api/v1/author/site/open-courses")
def author_list_open_courses(
    request: Request,
    q: str | None = None,
    published: str | None = None,
    page: int | None = None,
    page_size: int | None = None,
) -> dict[str, Any]:
    require_author(request)
    from services.learner.app import list_open_courses

    items = list_open_courses(include_unpublished=True)
    if q and q.strip():
        needle = q.strip().lower()
        items = [
            c
            for c in items
            if needle in str(c.get("title") or "").lower()
            or needle in str(c.get("summary") or "").lower()
            or needle in str(c.get("level") or "").lower()
            or needle in str(c.get("id") or "").lower()
        ]
    if published is not None and str(published).strip() != "":
        flag = str(published).strip().lower() in {"1", "true", "yes", "published"}
        items = [c for c in items if bool(c.get("published")) is flag]
    page_i, size_i = parse_page(page, page_size)
    total = len(items)
    off, lim = offset_limit(page_i, size_i)
    return page_meta(items[off : off + lim], total, page_i, size_i)


@router.put("/api/v1/author/site/open-courses")
def author_replace_open_courses(body: list[OpenCourseIn], request: Request) -> dict[str, Any]:
    """Replace the full open-courses list (metadata only; media via upload)."""
    user = require_author(request)
    from services.learner.app import save_open_courses

    items = save_open_courses([c.model_dump() for c in body])
    write_audit("author.open_courses.replace", actor_id=user.id, resource_type="site", resource_id="landing")
    return {"items": items}


@router.post("/api/v1/author/site/open-courses")
async def author_upsert_open_course(
    request: Request,
    title: str = Form(...),
    course_id: str | None = Form(None),
    minutes: int | None = Form(None),
    level: str | None = Form(None),
    summary: str | None = Form(None),
    published: bool = Form(True),
    video: UploadFile | None = File(None),
    poster: UploadFile | None = File(None),
) -> dict[str, Any]:
    """Create or update one open course; optional video/poster upload to MinIO."""
    user = require_author(request)
    from services.learner.app import list_open_courses, save_open_courses

    cid = (course_id or "").strip() or f"open-{uuid4().hex[:10]}"
    existing = {c["id"]: c for c in list_open_courses(include_unpublished=True)}
    course = dict(existing.get(cid) or {"id": cid})
    course.update(
        {
            "id": cid,
            "title": title.strip(),
            "minutes": minutes,
            "level": (level or "").strip() or None,
            "summary": (summary or "").strip() or None,
            "published": bool(published),
        }
    )

    store = get_store()
    if video is not None and video.filename:
        data = await video.read()
        if len(data) > MEDIA_MAX_BYTES_BY_KIND["video"]:
            raise HTTPException(400, "视频超过 200MB")
        key = open_course_key(cid, "video", Path(video.filename).suffix or ".mp4")
        ctype = video.content_type or "video/mp4"
        store.put_bytes(S3_BUCKET_DOCUMENTS, key, data, content_type=ctype)
        course["object_key"] = key
    if poster is not None and poster.filename:
        data = await poster.read()
        if len(data) > MEDIA_MAX_BYTES_BY_KIND["poster"]:
            raise HTTPException(400, "海报超过 8MB")
        key = open_course_key(cid, "poster", Path(poster.filename).suffix or ".jpg")
        ctype = poster.content_type or "image/jpeg"
        store.put_bytes(S3_BUCKET_DOCUMENTS, key, data, content_type=ctype)
        course["poster_key"] = key

    merged = list(existing.values())
    replaced = False
    for i, item in enumerate(merged):
        if item["id"] == cid:
            merged[i] = course
            replaced = True
            break
    if not replaced:
        merged.append(course)

    items = save_open_courses(merged)
    write_audit("author.open_courses.upsert", actor_id=user.id, resource_type="open_course", resource_id=cid)
    return {"item": next(c for c in items if c["id"] == cid), "items": items}


@router.delete("/api/v1/author/site/open-courses/{course_id}")
def author_delete_open_course(course_id: str, request: Request) -> dict[str, Any]:
    user = require_author(request)
    from services.learner.app import list_open_courses, save_open_courses

    remaining = [c for c in list_open_courses(include_unpublished=True) if c["id"] != course_id]
    items = save_open_courses(remaining)
    write_audit("author.open_courses.delete", actor_id=user.id, resource_type="open_course", resource_id=course_id)
    return {"items": items}


# --- Media library ----------------------------------------------------------

class MediaAssetPatch(BaseModel):
    title: str | None = None
    tags: list[str] | None = None
    poster_key: str | None = None
    duration_sec: int | None = None


@router.get("/api/v1/author/media-assets")
def author_list_media_assets(
    request: Request,
    camp_id: str | None = None,
    kind: str | None = None,
    q: str | None = None,
    page: int | None = None,
    page_size: int | None = None,
) -> dict[str, Any]:
    require_author(request)
    camp = session_camp_id(request, camp_id)
    return media_lib.list_media_assets(camp_id=camp, kind=kind, q=q, page=page, page_size=page_size)


@router.post("/api/v1/author/media-assets")
async def author_create_media_asset(
    request: Request,
    file: UploadFile = File(...),
    camp_id: str | None = Form(None),
    title: str | None = Form(None),
    kind: str = Form("video"),
    duration_sec: int | None = Form(None),
    tags: str | None = Form(None),
    poster: UploadFile | None = File(None),
) -> dict[str, Any]:
    user = require_author(request)
    camp = session_camp_id(request, camp_id)
    tag_list: list[str] = []
    if tags and tags.strip():
        try:
            parsed = json.loads(tags)
            if isinstance(parsed, list):
                tag_list = [str(t) for t in parsed]
            else:
                tag_list = [t.strip() for t in tags.split(",") if t.strip()]
        except json.JSONDecodeError:
            tag_list = [t.strip() for t in tags.split(",") if t.strip()]
    item = await media_lib.create_media_asset(
        camp_id=camp,
        user_id=user.id,
        file=file,
        title=title,
        kind=kind,
        duration_sec=duration_sec,
        tags=tag_list,
        poster=poster,
    )
    write_audit(
        "author.media_asset_create",
        actor_id=user.id,
        camp_id=camp,
        resource_type="media_asset",
        resource_id=item["id"],
        details={"deduped": item.get("deduped"), "kind": item.get("kind")},
    )
    return item


@router.patch("/api/v1/author/media-assets/{asset_id}")
def author_patch_media_asset(asset_id: str, body: MediaAssetPatch, request: Request) -> dict[str, Any]:
    user = require_author(request)
    camp = session_camp_id(request, None)
    item = media_lib.patch_media_asset(
        asset_id,
        camp_id=camp,
        title=body.title,
        tags=body.tags,
        poster_key=body.poster_key,
        duration_sec=body.duration_sec,
    )
    write_audit(
        "author.media_asset_patch",
        actor_id=user.id,
        camp_id=camp,
        resource_type="media_asset",
        resource_id=asset_id,
    )
    return item


@router.delete("/api/v1/author/media-assets/{asset_id}")
def author_delete_media_asset(asset_id: str, request: Request) -> dict[str, Any]:
    user = require_author(request)
    camp = session_camp_id(request, None)
    result = media_lib.soft_delete_media_asset(asset_id, camp_id=camp)
    write_audit(
        "author.media_asset_delete",
        actor_id=user.id,
        camp_id=camp,
        resource_type="media_asset",
        resource_id=asset_id,
    )
    return result


# --- Overview ---------------------------------------------------------------

# 课节打开 → 估算学习时长（分钟）。无精确心跳时的运维近似值。
_MINUTES_PER_CAPSULE_OPEN = 8


def _last_n_date_strings(n: int = 7) -> list[str]:
    from datetime import date, timedelta

    today = date.today()
    return [(today - timedelta(days=n - 1 - i)).isoformat() for i in range(n)]


def _series_fill(dates: list[str], rows: dict[str, dict[str, int]], keys: list[str]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for d in dates:
        item: dict[str, Any] = {"date": d}
        src = rows.get(d) or {}
        for k in keys:
            item[k] = int(src.get(k) or 0)
        out.append(item)
    return out


@router.get("/api/v1/author/overview")
def author_overview(request: Request, camp_id: str | None = None) -> dict[str, Any]:
    require_author(request)
    camp = session_camp_id(request, camp_id)
    dates = _last_n_date_strings(7)
    stats: dict[str, Any] = {
        "camp_id": camp,
        "courses": 0,
        "draft_versions": 0,
        "pending_submissions": 0,
        "documents": 0,
        "videos": 0,
        "videos_library": 0,
        "videos_open_courses": 0,
        "videos_site": 0,
        "learners": 0,
        "contact_leads": 0,
        "open_courses": 0,
        "pending_reviews": 0,
        "submission_trend_7d": [],
        "learn_active_users_7d": [],
        "learn_duration_minutes_7d": [],
        "open_course_clicks_7d": [],
        "capsule_opens_7d": [],
        "recent_actions": [],
        "metrics_note": {
            "learn_duration": f"按课节打开次数×{_MINUTES_PER_CAPSULE_OPEN} 分钟估算",
            "open_course_clicks": "公开课视频播放次数（含历史 media.presign 中匹配公开课 object_key）",
            "videos": "视频库未删除条目 + 已配置视频的公开课 + 站点 Hero 视频",
        },
    }
    open_course_keys: set[str] = set()
    try:
        from services.learner.app import list_open_courses

        ocs = list_open_courses(include_unpublished=True)
        stats["open_courses"] = len(ocs)
        for c in ocs:
            key = str(c.get("object_key") or "").strip()
            if key:
                open_course_keys.add(key)
                stats["videos_open_courses"] = int(stats["videos_open_courses"]) + 1
    except Exception:
        pass

    with db_cursor() as cur:
        cur.execute("SELECT COUNT(*) AS c FROM courses WHERE COALESCE(status,'active') <> 'archived'")
        stats["courses"] = int(cur.fetchone()["c"] or 0)
        cur.execute(
            "SELECT COUNT(*) AS c FROM course_versions WHERE status='draft' AND (camp_id=? OR camp_id IS NULL)",
            (camp,),
        )
        stats["draft_versions"] = int(cur.fetchone()["c"] or 0)
        cur.execute(
            """
            SELECT COUNT(*) AS c FROM submissions
            WHERE camp_id=? AND (status IS NULL OR status IN ('submitted','pending','needs_review'))
            """,
            (camp,),
        )
        stats["pending_submissions"] = int(cur.fetchone()["c"] or 0)
        cur.execute(
            "SELECT COUNT(*) AS c FROM documents WHERE camp_id=? AND deleted_at IS NULL",
            (camp,),
        )
        stats["documents"] = int(cur.fetchone()["c"] or 0)

        # 视频：视频库（未删除）+ 公开课视频 + 站点 Hero
        cur.execute("SELECT to_regclass(?) AS reg", ("media_assets",))
        if cur.fetchone().get("reg"):
            cur.execute(
                "SELECT COUNT(*) AS c FROM media_assets WHERE camp_id=? AND deleted_at IS NULL AND kind='video'",
                (camp,),
            )
            stats["videos_library"] = int(cur.fetchone()["c"] or 0)
        cur.execute("SELECT to_regclass(?) AS reg", ("site_media",))
        if cur.fetchone().get("reg"):
            cur.execute(
                """
                SELECT COUNT(*) AS c FROM site_media
                WHERE kind IN ('hero_video', 'video')
                  AND (src_url IS NOT NULL OR poster_url IS NOT NULL)
                """
            )
            stats["videos_site"] = int(cur.fetchone()["c"] or 0)
        stats["videos"] = (
            int(stats["videos_library"]) + int(stats["videos_open_courses"]) + int(stats["videos_site"])
        )

        # learners
        cur.execute("SELECT to_regclass(?) AS reg", ("enrollment_records",))
        if cur.fetchone().get("reg"):
            cur.execute(
                """
                SELECT COUNT(DISTINCT er.user_id) AS c
                FROM enrollment_records er
                JOIN course_offerings o ON o.id = er.offering_id
                WHERE o.camp_id=? AND er.status='active'
                """,
                (camp,),
            )
            stats["learners"] = int(cur.fetchone()["c"] or 0)
        if not stats["learners"]:
            cur.execute("SELECT to_regclass(?) AS reg", ("enrollments",))
            if cur.fetchone().get("reg"):
                cur.execute("SELECT COUNT(*) AS c FROM enrollments WHERE camp_id=?", (camp,))
                stats["learners"] = int(cur.fetchone()["c"] or 0)
        cur.execute("SELECT to_regclass(?) AS reg", ("contact_leads",))
        if cur.fetchone().get("reg"):
            cur.execute("SELECT COUNT(*) AS c FROM contact_leads")
            stats["contact_leads"] = int(cur.fetchone()["c"] or 0)
        cur.execute("SELECT to_regclass(?) AS reg", ("mentor_reviews",))
        if cur.fetchone().get("reg"):
            cur.execute(
                "SELECT COUNT(*) AS c FROM mentor_reviews WHERE status='pending' AND (camp_id=? OR camp_id IS NULL)",
                (camp,),
            )
            stats["pending_reviews"] = int(cur.fetchone()["c"] or 0)

        # 提交趋势
        cur.execute(
            """
            SELECT date_trunc('day', created_at)::date AS d, COUNT(*) AS c
            FROM submissions
            WHERE camp_id=? AND created_at >= (CURRENT_DATE - INTERVAL '6 days')
            GROUP BY 1 ORDER BY 1
            """,
            (camp,),
        )
        sub_map = {str(r["d"]): {"count": int(r["c"] or 0)} for r in cur.fetchall()}
        stats["submission_trend_7d"] = _series_fill(dates, sub_map, ["count"])

        # 学习活跃 / 时长估算：capsule.open
        cur.execute(
            """
            SELECT date_trunc('day', created_at)::date AS d,
                   COUNT(*) AS opens,
                   COUNT(DISTINCT actor_id) AS users
            FROM audit_logs
            WHERE action='capsule.open'
              AND created_at >= (CURRENT_DATE - INTERVAL '6 days')
              AND (camp_id=? OR camp_id IS NULL)
            GROUP BY 1 ORDER BY 1
            """,
            (camp,),
        )
        learn_map: dict[str, dict[str, int]] = {}
        for r in cur.fetchall():
            d = str(r["d"])
            opens = int(r["opens"] or 0)
            learn_map[d] = {
                "users": int(r["users"] or 0),
                "opens": opens,
                "minutes": opens * _MINUTES_PER_CAPSULE_OPEN,
            }
        stats["learn_active_users_7d"] = _series_fill(dates, learn_map, ["users"])
        stats["learn_duration_minutes_7d"] = _series_fill(dates, learn_map, ["minutes"])
        stats["capsule_opens_7d"] = _series_fill(dates, learn_map, ["opens"])

        # 公开课点击人数：优先新埋点去重 actor；并合并历史 media.presign（按 actor 去重）
        # 用集合按日合并，避免两次查询简单相加导致重复
        click_actors: dict[str, set[str]] = {d: set() for d in dates}
        cur.execute(
            """
            SELECT date_trunc('day', created_at)::date AS d, actor_id
            FROM audit_logs
            WHERE action='site.open_course_play'
              AND created_at >= (CURRENT_DATE - INTERVAL '6 days')
              AND actor_id IS NOT NULL
            """
        )
        for r in cur.fetchall():
            d = str(r["d"])
            if d in click_actors and r.get("actor_id"):
                click_actors[d].add(str(r["actor_id"]))
        anon_clicks: dict[str, int] = {d: 0 for d in dates}
        cur.execute(
            """
            SELECT date_trunc('day', created_at)::date AS d, COUNT(*) AS c
            FROM audit_logs
            WHERE action='site.open_course_play'
              AND created_at >= (CURRENT_DATE - INTERVAL '6 days')
              AND actor_id IS NULL
            GROUP BY 1
            """
        )
        for r in cur.fetchall():
            d = str(r["d"])
            if d in anon_clicks:
                anon_clicks[d] = int(r["c"] or 0)
        if open_course_keys:
            keys = list(open_course_keys)
            placeholders = ",".join("?" for _ in keys)
            cur.execute(
                f"""
                SELECT date_trunc('day', created_at)::date AS d, actor_id
                FROM audit_logs
                WHERE action IN ('media.presign', 'media.stream')
                  AND created_at >= (CURRENT_DATE - INTERVAL '6 days')
                  AND resource_id IN ({placeholders})
                  AND actor_id IS NOT NULL
                """,
                keys,
            )
            for r in cur.fetchall():
                d = str(r["d"])
                if d in click_actors and r.get("actor_id"):
                    click_actors[d].add(str(r["actor_id"]))
        click_map = {
            d: {"count": len(click_actors[d]) + anon_clicks.get(d, 0)} for d in dates
        }
        stats["open_course_clicks_7d"] = _series_fill(dates, click_map, ["count"])
        stats["metrics_note"]["open_course_clicks"] = "公开课视频播放去重人数（登录用户按账号；匿名按次）"

        # 最近操作：暂不展示原始 audit（字段与前端 title/at 不匹配）；保持空列表
        stats["recent_actions"] = []

    return stats


app.include_router(router)
