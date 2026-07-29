"""Course media — same-origin stream + optional MinIO presign for capsule video/audio."""

from __future__ import annotations

import mimetypes
import re
import sys
from pathlib import Path
from typing import Any, Iterator
from urllib.parse import quote

from botocore.exceptions import ClientError
from fastapi import APIRouter, FastAPI, HTTPException, Query, Request, Response
from fastapi.responses import StreamingResponse

_ROOT = Path(__file__).resolve().parents[2]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from services.shared import S3_BUCKET_DOCUMENTS, user_enrolled, write_audit  # noqa: E402
from services.shared.config import S3_PRESIGN_GET_EXPIRES  # noqa: E402
from services.shared.middleware import require_user, session_camp_id  # noqa: E402
from services.storage import get_store  # noqa: E402

# Allow documents/ and explicit course-media under documents/
_ALLOWED_PREFIXES = ("documents/",)
_SAFE_KEY = re.compile(r"^[a-zA-Z0-9_./\-]+$")
_RANGE_RE = re.compile(r"bytes=(\d*)-(\d*)")

router = APIRouter(tags=["media"])
app = FastAPI(title="FDE Media", version="0.1.0")


def _validate_object_key(object_key: str) -> str:
    key = (object_key or "").strip().lstrip("/")
    if not key or ".." in key or key.startswith("/"):
        raise HTTPException(400, "invalid object_key")
    if not _SAFE_KEY.match(key):
        raise HTTPException(400, "object_key contains illegal characters")
    if not any(key.startswith(p) for p in _ALLOWED_PREFIXES):
        raise HTTPException(403, "object_key prefix not allowed")
    return key


def _authorize_media(request: Request, object_key: str, camp_id: str | None) -> tuple[Any, str, str]:
    user = require_user(request)
    camp = session_camp_id(request, camp_id)
    if user.role not in ("author", "admin") and not user_enrolled(user.id, camp):
        raise HTTPException(403, "无权访问该营期媒资")
    key = _validate_object_key(object_key)
    parts = key.split("/")
    if len(parts) >= 2 and parts[0] == "documents" and parts[1] not in (camp, "shared"):
        if user.role not in ("author", "admin"):
            raise HTTPException(403, "媒资不属于当前营期")
    return user, camp, key


def _guess_content_type(key: str) -> str:
    guessed, _ = mimetypes.guess_type(key)
    return guessed or "application/octet-stream"


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "media"}


@router.get("/api/v1/media/presign")
def presign_media(
    request: Request,
    object_key: str = Query(..., min_length=3),
    camp_id: str | None = None,
    expires: int = Query(default=S3_PRESIGN_GET_EXPIRES, ge=60, le=900),
) -> dict[str, Any]:
    """Return a same-origin stream URL.

    Direct MinIO/S3 presigned URLs break in the browser when the object store
    lacks CORS (common with local MinIO) or when the player issues HEAD/Range
    probes that don't match the signed GET. Streaming through the API keeps
    cookies, CORS, and Range handling under our control.
    """
    user, camp, key = _authorize_media(request, object_key, camp_id)
    q = f"object_key={quote(key, safe='')}"
    if camp:
        q += f"&camp_id={quote(camp, safe='')}"
    # Relative URL — browser resolves against the SPA origin (:8760).
    url = f"/api/v1/media/stream?{q}"
    write_audit(
        "media.presign",
        actor_id=user.id,
        camp_id=camp,
        resource_type="media",
        resource_id=key,
        details={"expires": expires, "via": "stream"},
    )
    return {
        "url": url,
        "expires_in": expires,
        "bucket": S3_BUCKET_DOCUMENTS,
        "object_key": key,
        "via": "stream",
    }


def stream_s3_object(request: Request, key: str, *, cache_control: str = "private, max-age=60") -> Response:
    """Byte-range stream of an object already validated by the caller."""
    store = get_store()
    client = store._client  # noqa: SLF001 — intentional low-level Range forward
    try:
        head = client.head_object(Bucket=S3_BUCKET_DOCUMENTS, Key=key)
    except ClientError as exc:
        code = (exc.response or {}).get("Error", {}).get("Code", "")
        if code in ("404", "NoSuchKey", "NotFound"):
            raise HTTPException(404, "媒资不存在") from exc
        raise HTTPException(502, f"媒资不可用: {code or exc}") from exc

    total = int(head.get("ContentLength") or 0)
    content_type = head.get("ContentType") or _guess_content_type(key)
    etag = head.get("ETag")
    range_header = request.headers.get("range") or request.headers.get("Range")

    start = 0
    end = total - 1 if total else 0
    status = 200
    extra_headers: dict[str, str] = {
        "Accept-Ranges": "bytes",
        "Cache-Control": cache_control,
        "Content-Disposition": f'inline; filename="{Path(key).name}"',
    }
    if etag:
        extra_headers["ETag"] = etag

    get_kwargs: dict[str, Any] = {"Bucket": S3_BUCKET_DOCUMENTS, "Key": key}
    if range_header and total > 0:
        m = _RANGE_RE.match(range_header.strip())
        if not m:
            raise HTTPException(416, "Invalid Range")
        raw_start, raw_end = m.group(1), m.group(2)
        start = int(raw_start) if raw_start else 0
        end = int(raw_end) if raw_end else total - 1
        if start >= total or end >= total or start > end:
            raise HTTPException(
                416,
                "Requested Range Not Satisfiable",
                headers={"Content-Range": f"bytes */{total}"},
            )
        get_kwargs["Range"] = f"bytes={start}-{end}"
        status = 206
        extra_headers["Content-Range"] = f"bytes {start}-{end}/{total}"

    try:
        obj = client.get_object(**get_kwargs)
    except ClientError as exc:
        code = (exc.response or {}).get("Error", {}).get("Code", "")
        raise HTTPException(502, f"媒资读取失败: {code or exc}") from exc

    body = obj["Body"]
    length = int(obj.get("ContentLength") or (end - start + 1))

    def _iter() -> Iterator[bytes]:
        try:
            while True:
                chunk = body.read(64 * 1024)
                if not chunk:
                    break
                yield chunk
        finally:
            try:
                body.close()
            except Exception:
                pass

    headers = {
        **extra_headers,
        "Content-Length": str(length),
        "Content-Type": content_type,
    }
    return StreamingResponse(_iter(), status_code=status, media_type=content_type, headers=headers)


@router.get("/api/v1/media/stream")
def stream_media(
    request: Request,
    object_key: str = Query(..., min_length=3),
    camp_id: str | None = None,
) -> Response:
    """Authenticated byte-range stream of a course media object."""
    _user, _camp, key = _authorize_media(request, object_key, camp_id)
    return stream_s3_object(request, key)


app.include_router(router)
