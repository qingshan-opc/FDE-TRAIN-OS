"""Author media library — media_assets CRUD with sha256 dedupe and soft-delete."""

from __future__ import annotations

import hashlib
import json
import logging
from pathlib import Path
from typing import Any
from uuid import uuid4

from fastapi import HTTPException, UploadFile

from services.author.pagination import offset_limit, page_meta, parse_page
from services.shared.config import DEFAULT_UPLOAD_MAX_BYTES, MEDIA_MAX_BYTES_BY_KIND
from services.shared import S3_BUCKET_DOCUMENTS, db_cursor
from services.storage import get_store

log = logging.getLogger("fde.author.media")

ALLOWED_KINDS = {"video", "audio", "poster", "image"}
KIND_EXT = {
    "video": ".mp4",
    "audio": ".mp3",
    "poster": ".jpg",
    "image": ".png",
}


def _max_bytes_for_kind(kind: str) -> int:
    return MEDIA_MAX_BYTES_BY_KIND.get(kind, DEFAULT_UPLOAD_MAX_BYTES)


def _table_exists(cur, name: str) -> bool:
    cur.execute("SELECT to_regclass(?) AS reg", (name,))
    row = cur.fetchone()
    return bool(row and row.get("reg"))


def _row_to_item(row: dict[str, Any]) -> dict[str, Any]:
    d = dict(row)
    tags = d.get("tags_json")
    if isinstance(tags, str):
        tags = json.loads(tags)
    d["tags_json"] = tags or []
    if d.get("object_key"):
        d["stream_url"] = f"/api/v1/media/stream?object_key={d['object_key']}"
    if d.get("poster_key"):
        d["poster_url"] = f"/api/v1/media/stream?object_key={d['poster_key']}"
    return d


def find_media_refs(object_key: str) -> list[dict[str, Any]]:
    """Locate references in day_packages / learning_resources / open_courses.

    Prefer exact JSON field matches over substring LIKE to avoid false positives.
    """
    key = (object_key or "").strip()
    if not key:
        return []
    refs: list[dict[str, Any]] = []
    with db_cursor() as cur:
        # Match capsule media object_key / poster_key and resource object_key exactly.
        cur.execute(
            """
            SELECT DISTINCT dp.course_version_id, dp.day, dp.title, cv.camp_id
            FROM day_packages dp
            LEFT JOIN course_versions cv ON cv.id = dp.course_version_id
            WHERE EXISTS (
              SELECT 1
              FROM jsonb_array_elements(COALESCE(dp.package_json #> '{learn,capsules}', '[]'::jsonb)) AS cap,
                   jsonb_array_elements(COALESCE(cap->'media', '[]'::jsonb)) AS m
              WHERE m->>'object_key' = ? OR m->>'poster_key' = ?
            )
            OR EXISTS (
              SELECT 1
              FROM jsonb_array_elements(COALESCE(dp.package_json->'resources', '[]'::jsonb)) AS r
              WHERE r->>'object_key' = ? OR r->>'url' = ?
            )
            ORDER BY dp.course_version_id, dp.day
            LIMIT 50
            """,
            (key, key, key, key),
        )
        for r in cur.fetchall():
            refs.append(
                {
                    "type": "day_package",
                    "course_version_id": r["course_version_id"],
                    "day": r["day"],
                    "title": r["title"],
                    "camp_id": r.get("camp_id"),
                }
            )
        if _table_exists(cur, "learning_resources"):
            cur.execute(
                """
                SELECT id, pack_id, course_version_id, day_index, title
                FROM learning_resources
                WHERE deleted_at IS NULL AND object_key=?
                LIMIT 50
                """,
                (key,),
            )
            for r in cur.fetchall():
                refs.append(
                    {
                        "type": "learning_resource",
                        "id": r["id"],
                        "pack_id": r.get("pack_id"),
                        "course_version_id": r.get("course_version_id"),
                        "day_index": r.get("day_index"),
                        "title": r["title"],
                    }
                )

    try:
        from services.learner.app import list_open_courses

        for c in list_open_courses(include_unpublished=True):
            if c.get("object_key") == key or c.get("poster_key") == key:
                refs.append({"type": "open_course", "id": c["id"], "title": c.get("title")})
    except Exception as exc:
        log.warning("open_courses ref check skipped: %s", exc)
    return refs


def list_media_assets(
    *,
    camp_id: str,
    kind: str | None = None,
    q: str | None = None,
    page: int | None = None,
    page_size: int | None = None,
) -> dict[str, Any]:
    page_i, size_i = parse_page(page, page_size)
    off, lim = offset_limit(page_i, size_i)
    where = ["camp_id=?", "deleted_at IS NULL"]
    args: list[Any] = [camp_id]
    if kind and kind.strip():
        where.append("kind=?")
        args.append(kind.strip().lower())
    if q and q.strip():
        where.append("(title ILIKE ? OR tags_json::text ILIKE ?)")
        like = f"%{q.strip()}%"
        args.extend([like, like])
    where_sql = " AND ".join(where)
    with db_cursor() as cur:
        if not _table_exists(cur, "media_assets"):
            return page_meta([], 0, page_i, size_i)
        cur.execute(f"SELECT COUNT(*) AS c FROM media_assets WHERE {where_sql}", args)
        total = int(cur.fetchone()["c"] or 0)
        cur.execute(
            f"""
            SELECT * FROM media_assets
            WHERE {where_sql}
            ORDER BY created_at DESC
            OFFSET ? LIMIT ?
            """,
            (*args, off, lim),
        )
        items = [_row_to_item(dict(r)) for r in cur.fetchall()]
    for item in items:
        refs = find_media_refs(item.get("object_key") or "")
        item["ref_count"] = len(refs)
    return page_meta(items, total, page_i, size_i)


def get_media_asset(asset_id: str, *, camp_id: str | None = None) -> dict[str, Any]:
    with db_cursor() as cur:
        cur.execute(
            "SELECT * FROM media_assets WHERE id=? AND deleted_at IS NULL",
            (asset_id,),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(404, "media asset not found")
        if camp_id and row["camp_id"] != camp_id:
            raise HTTPException(404, "media asset not found")
        item = _row_to_item(dict(row))
    item["refs"] = find_media_refs(item.get("object_key") or "")
    item["ref_count"] = len(item["refs"])
    return item


async def create_media_asset(
    *,
    camp_id: str,
    user_id: str | None,
    file: UploadFile,
    title: str | None = None,
    kind: str = "video",
    duration_sec: int | None = None,
    tags: list[str] | None = None,
    poster: UploadFile | None = None,
) -> dict[str, Any]:
    kind_l = (kind or "video").strip().lower()
    if kind_l not in ALLOWED_KINDS:
        raise HTTPException(400, f"kind must be one of {sorted(ALLOWED_KINDS)}")
    name = file.filename or f"media{KIND_EXT.get(kind_l, '.bin')}"
    data = await file.read()
    max_b = _max_bytes_for_kind(kind_l)
    if len(data) > max_b:
        raise HTTPException(413, f"{kind_l} too large")
    if not data:
        raise HTTPException(400, "empty file")
    sha = hashlib.sha256(data).hexdigest()
    ctype = file.content_type or "application/octet-stream"

    with db_cursor() as cur:
        if not _table_exists(cur, "media_assets"):
            raise HTTPException(500, "media_assets table missing; apply migration 012")
        cur.execute(
            """
            SELECT * FROM media_assets
            WHERE camp_id=? AND sha256=? AND deleted_at IS NULL
            ORDER BY created_at DESC LIMIT 1
            """,
            (camp_id, sha),
        )
        existing = cur.fetchone()
        if existing:
            item = _row_to_item(dict(existing))
            item["deduped"] = True
            return item

    ext = Path(name).suffix.lower() or KIND_EXT.get(kind_l, ".bin")
    asset_id = str(uuid4())
    key = f"documents/{camp_id}/media-library/{kind_l}/{sha[:16]}-{uuid4().hex[:8]}{ext}"
    store = get_store()
    store.put_bytes(S3_BUCKET_DOCUMENTS, key, data, content_type=ctype)

    poster_key = None
    if poster is not None and poster.filename:
        pdata = await poster.read()
        if len(pdata) > KIND_MAX_BYTES["poster"]:
            raise HTTPException(413, "poster too large")
        pext = Path(poster.filename).suffix.lower() or ".jpg"
        poster_key = f"documents/{camp_id}/media-library/poster/{sha[:16]}-{uuid4().hex[:8]}{pext}"
        store.put_bytes(
            S3_BUCKET_DOCUMENTS,
            poster_key,
            pdata,
            content_type=poster.content_type or "image/jpeg",
        )

    display_title = (title or "").strip() or Path(name).stem or asset_id
    tags_json = json.dumps(tags or [], ensure_ascii=False)
    with db_cursor() as cur:
        # Race: another insert with same sha256
        cur.execute(
            """
            SELECT * FROM media_assets
            WHERE camp_id=? AND sha256=? AND deleted_at IS NULL
            LIMIT 1
            """,
            (camp_id, sha),
        )
        raced = cur.fetchone()
        if raced:
            item = _row_to_item(dict(raced))
            item["deduped"] = True
            return item
        try:
            cur.execute(
                """
                INSERT INTO media_assets
                (id, camp_id, title, kind, object_key, poster_key, content_type, size_bytes,
                 duration_sec, sha256, tags_json, created_by, created_at, updated_at)
                VALUES (?,?,?,?,?,?,?,?,?,?,?::jsonb,?,NOW(),NOW())
                """,
                (
                    asset_id,
                    camp_id,
                    display_title,
                    kind_l,
                    key,
                    poster_key,
                    ctype,
                    len(data),
                    duration_sec,
                    sha,
                    tags_json,
                    user_id,
                ),
            )
        except Exception as exc:
            # object_key UNIQUE collision
            cur.execute(
                "SELECT * FROM media_assets WHERE object_key=? AND deleted_at IS NULL LIMIT 1",
                (key,),
            )
            hit = cur.fetchone()
            if hit:
                item = _row_to_item(dict(hit))
                item["deduped"] = True
                return item
            raise HTTPException(409, f"media asset conflict: {exc}") from exc
        cur.execute("SELECT * FROM media_assets WHERE id=?", (asset_id,))
        row = cur.fetchone()
    item = _row_to_item(dict(row))
    item["deduped"] = False
    return item


def patch_media_asset(
    asset_id: str,
    *,
    camp_id: str | None = None,
    title: str | None = None,
    tags: list[str] | None = None,
    poster_key: str | None = None,
    duration_sec: int | None = None,
) -> dict[str, Any]:
    with db_cursor() as cur:
        cur.execute("SELECT * FROM media_assets WHERE id=? AND deleted_at IS NULL", (asset_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(404, "media asset not found")
        if camp_id and row["camp_id"] != camp_id:
            raise HTTPException(404, "media asset not found")
        sets: list[str] = ["updated_at=NOW()"]
        args: list[Any] = []
        if title is not None:
            sets.append("title=?")
            args.append(str(title).strip() or row["title"])
        if tags is not None:
            sets.append("tags_json=?::jsonb")
            args.append(json.dumps(tags, ensure_ascii=False))
        if poster_key is not None:
            sets.append("poster_key=?")
            args.append(poster_key or None)
        if duration_sec is not None:
            sets.append("duration_sec=?")
            args.append(duration_sec)
        if len(args) == 0:
            return _row_to_item(dict(row))
        args.append(asset_id)
        cur.execute(f"UPDATE media_assets SET {', '.join(sets)} WHERE id=?", args)
        cur.execute("SELECT * FROM media_assets WHERE id=?", (asset_id,))
        updated = cur.fetchone()
    return _row_to_item(dict(updated))


def soft_delete_media_asset(asset_id: str, *, camp_id: str | None = None) -> dict[str, Any]:
    with db_cursor() as cur:
        cur.execute("SELECT * FROM media_assets WHERE id=? AND deleted_at IS NULL", (asset_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(404, "media asset not found")
        if camp_id and row["camp_id"] != camp_id:
            raise HTTPException(404, "media asset not found")
        refs = find_media_refs(row["object_key"])
        if refs:
            raise HTTPException(
                409,
                detail={"message": "media asset is referenced", "refs": refs},
            )
        cur.execute(
            "UPDATE media_assets SET deleted_at=NOW(), updated_at=NOW() WHERE id=?",
            (asset_id,),
        )
    return {"ok": True, "id": asset_id}
