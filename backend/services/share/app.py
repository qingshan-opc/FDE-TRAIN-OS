"""Share posters — upload once, public PNG URL for WeChat long-press save."""

from __future__ import annotations

import re
import sys
from pathlib import Path
from typing import Any
from uuid import uuid4

from botocore.exceptions import ClientError
from fastapi import APIRouter, File, HTTPException, Request, UploadFile
from fastapi.responses import Response

_PKG_ROOT = Path(__file__).resolve().parents[2]
if str(_PKG_ROOT) not in sys.path:
    sys.path.insert(0, str(_PKG_ROOT))

from services.shared import S3_BUCKET_DOCUMENTS, write_audit  # noqa: E402
from services.shared.config import FDE_PUBLIC_BASE_URL  # noqa: E402
from services.shared.middleware import require_user  # noqa: E402
from services.storage import get_store  # noqa: E402

router = APIRouter(tags=["share"])

_TOKEN_RE = re.compile(r"^[a-f0-9]{32}$")
_PREFIX = "documents/shared/share-posters/"
_MAX_BYTES = 4 * 1024 * 1024
_PNG_MAGIC = b"\x89PNG\r\n\x1a\n"


def _object_key(token: str) -> str:
    return f"{_PREFIX}{token}.png"


def _public_path(token: str) -> str:
    return f"/api/v1/share/posters/{token}.png"


@router.post("/api/v1/share/posters")
async def upload_share_poster(
    request: Request,
    file: UploadFile = File(...),
) -> dict[str, Any]:
    """Authenticated upload → public PNG URL (WeChat long-press can save)."""
    user = require_user(request)
    raw = await file.read()
    if not raw:
        raise HTTPException(400, "空文件")
    if len(raw) > _MAX_BYTES:
        raise HTTPException(413, "海报过大，请换短图风格后重试")
    if not raw.startswith(_PNG_MAGIC):
        raise HTTPException(400, "仅支持 PNG 海报")

    token = uuid4().hex
    key = _object_key(token)
    get_store().put_bytes(S3_BUCKET_DOCUMENTS, key, raw, content_type="image/png")
    path = _public_path(token)
    base = (FDE_PUBLIC_BASE_URL or "").rstrip("/")
    absolute = f"{base}{path}" if base else path
    write_audit(
        "share.poster_upload",
        actor_id=user.id,
        resource_type="share_poster",
        resource_id=token,
        details={"bytes": len(raw)},
    )
    return {"id": token, "url": path, "absolute_url": absolute}


@router.get("/api/v1/share/posters/{token}.png")
def get_share_poster(token: str) -> Response:
    """Public — no auth. Unguessable token; used by WeChat long-press save."""
    tok = (token or "").strip().lower()
    if not _TOKEN_RE.match(tok):
        raise HTTPException(400, "invalid token")
    key = _object_key(tok)
    store = get_store()
    client = store._client  # noqa: SLF001
    try:
        obj = client.get_object(Bucket=S3_BUCKET_DOCUMENTS, Key=key)
    except ClientError as exc:
        code = (exc.response or {}).get("Error", {}).get("Code", "")
        if code in ("404", "NoSuchKey", "NotFound"):
            raise HTTPException(404, "海报不存在或已过期") from exc
        raise HTTPException(502, f"读取失败: {code or exc}") from exc

    body = obj["Body"].read()
    return Response(
        content=body,
        media_type="image/png",
        headers={
            "Cache-Control": "public, max-age=86400",
            "Content-Disposition": f'inline; filename="fde-poster-{tok[:8]}.png"',
            "X-Content-Type-Options": "nosniff",
        },
    )
