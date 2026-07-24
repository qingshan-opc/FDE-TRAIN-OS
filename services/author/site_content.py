"""Author-side landing / site_pages / site_media helpers (004+005 dual schema)."""

from __future__ import annotations

import json
import logging
from typing import Any
from uuid import uuid4

from fastapi import HTTPException

from services.shared import db_cursor

log = logging.getLogger("fde.author.site")

LANDING_SLUG = "landing"
REQUIRED_TAB_IDS = ("enterprise", "open", "about", "contact")


def _table_exists(cur, name: str) -> bool:
    cur.execute("SELECT to_regclass(?) AS reg", (name,))
    row = cur.fetchone()
    return bool(row and row.get("reg"))


def _columns(cur, table: str) -> set[str]:
    cur.execute(
        """
        SELECT column_name FROM information_schema.columns
        WHERE table_schema='public' AND table_name=?
        """,
        (table,),
    )
    return {str(r["column_name"]) for r in cur.fetchall()}


def _first(d: dict[str, Any], *keys: str) -> Any:
    for k in keys:
        v = d.get(k)
        if v is not None:
            return v
    return None


def deep_merge(base: dict[str, Any], patch: dict[str, Any]) -> dict[str, Any]:
    """Recursively merge patch into a copy of base (dicts only; lists replace)."""
    out = dict(base)
    for key, val in patch.items():
        if key in out and isinstance(out[key], dict) and isinstance(val, dict):
            out[key] = deep_merge(out[key], val)
        else:
            out[key] = val
    return out


def _ensure_landing() -> None:
    from services.learner.app import _ensure_landing_row

    _ensure_landing_row()


def _load_page_and_body() -> tuple[dict[str, Any], dict[str, Any]]:
    _ensure_landing()
    with db_cursor() as cur:
        if not _table_exists(cur, "site_pages"):
            raise HTTPException(500, "site_pages missing")
        cur.execute("SELECT * FROM site_pages WHERE slug=? LIMIT 1", (LANDING_SLUG,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(500, "landing page missing")
        page = dict(row)
        body: dict[str, Any] = {}
        raw = page.get("body_json")
        if raw:
            body = raw if isinstance(raw, dict) else json.loads(raw)
        return page, body


def _read_hero_media() -> dict[str, Any] | None:
    with db_cursor() as cur:
        if not _table_exists(cur, "site_media"):
            return None
        cols = _columns(cur, "site_media")
        row = None
        if "page_slug" in cols:
            cur.execute(
                """
                SELECT * FROM site_media
                WHERE page_slug=? AND kind IN ('hero_video', 'video')
                ORDER BY created_at DESC LIMIT 1
                """,
                (LANDING_SLUG,),
            )
            row = cur.fetchone()
        if not row and "page_id" in cols:
            cur.execute("SELECT id FROM site_pages WHERE slug=? LIMIT 1", (LANDING_SLUG,))
            page = cur.fetchone()
            page_id = page["id"] if page and page.get("id") else None
            if page_id:
                cur.execute(
                    """
                    SELECT * FROM site_media
                    WHERE page_id=? AND kind IN ('hero_video', 'video')
                    ORDER BY created_at DESC LIMIT 1
                    """,
                    (page_id,),
                )
                row = cur.fetchone()
        if not row:
            return None
        m = dict(row)
        meta = m.get("meta_json") or {}
        if isinstance(meta, str):
            meta = json.loads(meta)
        src = _first(m, "src_url", "object_key") or meta.get("src_url") or meta.get("object_key")
        poster = m.get("poster_url") or meta.get("poster_url") or meta.get("poster_key")
        captions = m.get("captions_url") or meta.get("captions_url") or meta.get("captions_key")
        out: dict[str, Any] = {
            "id": m.get("id"),
            "kind": m.get("kind") or "hero_video",
            "src_url": src,
            "object_key": _first(m, "object_key") or (src if src and not str(src).startswith("http") else None),
            "poster_url": poster,
            "poster_key": meta.get("poster_key") or poster,
            "captions_url": captions,
            "captions_key": meta.get("captions_key") or captions,
            "meta_json": meta,
        }
        if out.get("object_key"):
            out["stream_url"] = f"/api/v1/media/stream?object_key={out['object_key']}"
        return out


def get_landing_raw() -> dict[str, Any]:
    """Author editable landing payload merged with DEFAULT_LANDING + hero media."""
    from services.learner.app import DEFAULT_LANDING, list_open_courses

    page, body = _load_page_and_body()
    cta_raw = page.get("cta_json") or body.get("cta") or DEFAULT_LANDING["cta"]
    cta = cta_raw if isinstance(cta_raw, dict) else (json.loads(cta_raw) if cta_raw else DEFAULT_LANDING["cta"])

    payload: dict[str, Any] = {
        "title": page.get("title") or DEFAULT_LANDING["title"],
        "tagline": _first(page, "tagline") or body.get("tagline") or DEFAULT_LANDING["tagline"],
        "cta": cta,
        "brand": body.get("brand") or {"name": page.get("title") or DEFAULT_LANDING["title"], "footer": None},
        "hero": body.get("hero") or {},
        "tabs": body.get("tabs") or DEFAULT_LANDING["tabs"],
        "enterprise": body.get("enterprise") or DEFAULT_LANDING["enterprise"],
        "about": body.get("about") or DEFAULT_LANDING["about"],
        "contact": body.get("contact") or DEFAULT_LANDING["contact"],
        "open_courses": list_open_courses(include_unpublished=True),
        "hero_video": _read_hero_media(),
        "status": page.get("status"),
        "updated_at": page.get("updated_at"),
    }
    return payload


def _validate_tabs(tabs: list[Any]) -> list[dict[str, Any]]:
    cleaned: list[dict[str, Any]] = []
    for item in tabs:
        if not isinstance(item, dict):
            continue
        tid = str(item.get("id") or "").strip()
        label = str(item.get("label") or "").strip()
        if not tid or not label:
            continue
        cleaned.append({"id": tid, "label": label})
    ids = {t["id"] for t in cleaned}
    missing = [t for t in REQUIRED_TAB_IDS if t not in ids]
    if missing:
        raise HTTPException(422, f"tabs 缺少系统必需项: {', '.join(missing)}")
    return cleaned


def patch_landing(payload: dict[str, Any]) -> dict[str, Any]:
    """Deep-merge payload into site_pages.body_json; sync title/tagline/cta columns when present."""
    if not isinstance(payload, dict):
        raise HTTPException(400, "body must be an object")

    page, body = _load_page_and_body()
    patch = dict(payload)

    # open_courses has dedicated endpoints — ignore accidental full replace here
    patch.pop("open_courses", None)
    patch.pop("hero_video", None)
    patch.pop("status", None)
    patch.pop("updated_at", None)

    if "tabs" in patch and patch["tabs"] is not None:
        if not isinstance(patch["tabs"], list):
            raise HTTPException(422, "tabs must be a list")
        patch["tabs"] = _validate_tabs(patch["tabs"])

    title = patch.pop("title", None)
    tagline = patch.pop("tagline", None)
    cta_patch = patch.pop("cta", None)

    if cta_patch is not None:
        if not isinstance(cta_patch, dict):
            raise HTTPException(422, "cta must be an object")
        existing_cta = body.get("cta") if isinstance(body.get("cta"), dict) else {}
        body["cta"] = deep_merge(existing_cta, cta_patch)

    if tagline is not None:
        body["tagline"] = str(tagline)

    body = deep_merge(body, patch)

    with db_cursor() as cur:
        cols = _columns(cur, "site_pages")
        sets: list[str] = ["updated_at=NOW()"]
        args: list[Any] = []
        if "body_json" in cols:
            sets.append("body_json=?::jsonb")
            args.append(json.dumps(body, ensure_ascii=False))
        if title is not None and "title" in cols:
            sets.append("title=?")
            args.append(str(title))
        if tagline is not None and "tagline" in cols:
            sets.append("tagline=?")
            args.append(str(tagline))
        if cta_patch is not None and "cta_json" in cols:
            sets.append("cta_json=?::jsonb")
            args.append(json.dumps(body.get("cta") or {}, ensure_ascii=False))
        if "body_json" not in cols and title is None and tagline is None and cta_patch is None and not patch:
            raise HTTPException(500, "site_pages.body_json missing; cannot patch landing")
        args.append(LANDING_SLUG)
        cur.execute(f"UPDATE site_pages SET {', '.join(sets)} WHERE slug=?", args)

    return get_landing_raw()


def upsert_site_media(
    kind: str = "hero_video",
    *,
    src_url: str | None = None,
    object_key: str | None = None,
    poster_url: str | None = None,
    captions_url: str | None = None,
    meta: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Insert or replace one site_media row; compatible with page_slug (005) and page_id (004)."""
    _ensure_landing()
    kind_l = (kind or "hero_video").strip() or "hero_video"
    src = src_url or object_key
    if not src and not poster_url and not captions_url:
        raise HTTPException(400, "src/object_key or poster/captions required")

    media_id = str(uuid4())
    meta_json = dict(meta or {})
    if object_key:
        meta_json.setdefault("object_key", object_key)
    if poster_url:
        meta_json.setdefault("poster_key", poster_url)
    if captions_url:
        meta_json.setdefault("captions_key", captions_url)

    with db_cursor() as cur:
        if not _table_exists(cur, "site_media"):
            raise HTTPException(500, "site_media missing")
        cols = _columns(cur, "site_media")
        page_id: str | None = None
        if "page_id" in cols:
            cur.execute("SELECT id FROM site_pages WHERE slug=? LIMIT 1", (LANDING_SLUG,))
            prow = cur.fetchone()
            page_id = prow["id"] if prow and prow.get("id") else None
            if not page_id and "id" in _columns(cur, "site_pages"):
                # 004 seed uses fixed id; create if missing
                page_id = "site-page-landing"
                try:
                    cur.execute(
                        """
                        INSERT INTO site_pages (id, slug, title, status, body_json)
                        VALUES (?,?,?,?,?::jsonb)
                        ON CONFLICT (slug) DO NOTHING
                        """,
                        (page_id, LANDING_SLUG, "青山在", "published", "{}"),
                    )
                except Exception:
                    pass
                cur.execute("SELECT id FROM site_pages WHERE slug=? LIMIT 1", (LANDING_SLUG,))
                prow = cur.fetchone()
                page_id = prow["id"] if prow and prow.get("id") else page_id

        # Soft-replace existing hero rows for this page
        if "page_slug" in cols:
            cur.execute(
                "DELETE FROM site_media WHERE page_slug=? AND kind IN (?, 'video')",
                (LANDING_SLUG, kind_l),
            )
        if page_id and "page_id" in cols:
            cur.execute(
                "DELETE FROM site_media WHERE page_id=? AND kind IN (?, 'video', 'hero_video')",
                (page_id, kind_l),
            )

        if "page_slug" in cols and {"poster_url", "src_url", "captions_url"} <= cols:
            cur.execute(
                """
                INSERT INTO site_media (id, page_slug, kind, poster_url, src_url, captions_url, created_at)
                VALUES (?,?,?,?,?,?,NOW())
                """,
                (media_id, LANDING_SLUG, kind_l, poster_url, src, captions_url),
            )
        elif "page_id" in cols and "object_key" in cols:
            key = object_key or src or ""
            if not key:
                raise HTTPException(400, "object_key required for this schema")
            if "meta_json" in cols:
                cur.execute(
                    """
                    INSERT INTO site_media (id, page_id, kind, object_key, alt, meta_json, created_at)
                    VALUES (?,?,?,?,?,?::jsonb,NOW())
                    """,
                    (
                        media_id,
                        page_id,
                        kind_l,
                        key,
                        kind_l,
                        json.dumps(meta_json, ensure_ascii=False),
                    ),
                )
            else:
                cur.execute(
                    """
                    INSERT INTO site_media (id, page_id, kind, object_key, created_at)
                    VALUES (?,?,?,?,NOW())
                    """,
                    (media_id, page_id, kind_l, key),
                )
        elif "page_slug" in cols:
            # Minimal slug-only insert
            fields = ["id", "page_slug", "kind"]
            values: list[Any] = [media_id, LANDING_SLUG, kind_l]
            if "src_url" in cols:
                fields.append("src_url")
                values.append(src)
            if "poster_url" in cols:
                fields.append("poster_url")
                values.append(poster_url)
            if "captions_url" in cols:
                fields.append("captions_url")
                values.append(captions_url)
            if "object_key" in cols and (object_key or src):
                fields.append("object_key")
                values.append(object_key or src)
            placeholders = ",".join("?" for _ in fields)
            cur.execute(
                f"INSERT INTO site_media ({', '.join(fields)}, created_at) VALUES ({placeholders}, NOW())",
                values,
            )
        else:
            raise HTTPException(500, "unsupported site_media schema")

    return _read_hero_media() or {"id": media_id, "kind": kind_l, "src_url": src, "poster_url": poster_url}


def update_mentor_avatar_key(mentor_id: str, avatar_key: str) -> dict[str, Any]:
    """Set enterprise.mentors[].avatar_key for the given mentor id."""
    mid = (mentor_id or "").strip()
    if not mid:
        raise HTTPException(400, "mentor_id required")
    _, body = _load_page_and_body()
    enterprise = body.get("enterprise") if isinstance(body.get("enterprise"), dict) else {}
    mentors = enterprise.get("mentors") if isinstance(enterprise.get("mentors"), list) else []
    found = False
    new_mentors: list[Any] = []
    for m in mentors:
        if isinstance(m, dict) and str(m.get("id") or "") == mid:
            nm = dict(m)
            nm["avatar_key"] = avatar_key
            nm["avatar_url"] = f"/api/v1/media/stream?object_key={avatar_key}"
            new_mentors.append(nm)
            found = True
        else:
            new_mentors.append(m)
    if not found:
        raise HTTPException(404, f"mentor {mid} not found; PATCH landing.enterprise.mentors first")
    enterprise = dict(enterprise)
    enterprise["mentors"] = new_mentors
    return patch_landing({"enterprise": enterprise})
