"""Public site content + learner profile / identity / certificates.

Kept separate from `auth` (session/camp) and `progress` (evidence/passport)
so the M2 "learner IA" surface (landing, profile, identity, certificates)
has one home. Wired into the modular monolith by `services/api/app.py`.

Schema note: `site_pages` / `site_media` / `user_profiles` /
`identity_verifications` / `certificate_templates` / `certificate_issuances`
are shared table names with the M1 domain migration (`004_domain_v2.sql`).
Migration `005_site_and_identity.sql` only `CREATE TABLE IF NOT EXISTS`
(so it never clobbers M1's columns if that migration ran first). Every query
here uses `SELECT *` + dict `.get()` with alias fallbacks — and identity
writes use a try/next-variant fallback — so this module works regardless of
which migration actually created these tables first.
"""

from __future__ import annotations

import hashlib
import json
import logging
import sys
from pathlib import Path
from typing import Any
from uuid import uuid4

from fastapi import APIRouter, Depends, FastAPI, File, Form, HTTPException, Query, Request, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel

_PKG_ROOT = Path(__file__).resolve().parents[2]
if str(_PKG_ROOT) not in sys.path:
    sys.path.insert(0, str(_PKG_ROOT))
from services.shared.config import ROOT as _ROOT  # noqa: E402

from services.shared import FDE_ENV, db_cursor, init_schema, user_camps, write_audit  # noqa: E402
from services.shared.config import (  # noqa: E402
    CLAMAV_ENABLED,
    COURSE_MEDIA_OPEN_PREFIX,
    COURSE_MEDIA_SHARED_PREFIX,
    COURSE_MEDIA_SITE_HERO_PREFIX,
    COURSE_MEDIA_SITE_MENTOR_PREFIX,
    DEFAULT_CAMP_ID,
    LAB_ATTACHMENT_MAX_BYTES,
    S3_BUCKET_ARTIFACTS,
)
from services.storage import course_media_key, legacy_camp_media_prefix, open_course_key  # noqa: E402
from services.shared.middleware import (  # noqa: E402
    require_camp_access,
    require_user,
    session_camp_id,
    session_learner_id,
)
from services.shared.rate_limit import rate_limit  # noqa: E402

log = logging.getLogger("fde.learner")

router = APIRouter(tags=["learner"])
app = FastAPI(title="FDE Learner", version="0.1.0")
init_schema()

DEFAULT_LANDING: dict[str, Any] = {
    "title": "青山在",
    "tagline": "为政府、高校与企业交付可验收的数字化人才训练",
    "hero_video": None,
    "brand": {"name": "青山在", "footer": "© 青山在 · FDE Learning OS"},
    "hero": {
        "eyebrow": "FDE LEARNING OS",
        "title_lines": ["让每一次学习", "都留下可验证的证据"],
        "title_em": "可验证",
        "empty_title": "课程宣传片筹备中",
        "cta_primary": "进入学习",
        "cta_secondary": "了解企业培训",
        "bg_image": "/landing/hero.png",
        "proof": [
            {"value": "21", "label": "天任务驱动训练"},
            {"value": "100%", "label": "交付全程留痕"},
            {"value": "3", "label": "类机构同行验证"},
        ],
    },
    "seo": {
        # 与 web/index.html、<title> 保持一致，前端不会再改成短标题以免页签闪烁
        "title": "青山在 · FDE Learning OS",
        "description": "为政府、高校与企业交付可验收的数字化人才训练。任务驱动课纲、Agent 实训环境、可核验结业证书。",
        "keywords": "青山在,FDE,数字化人才,企业培训,训练营,Agent实训,结业证书,可验收交付",
        "og_image": "/landing/hero.png",
    },
    "cta": {"login": "/login", "app": "/app/courses"},
    "tabs": [
        {"id": "home", "label": "首页"},
        {"id": "enterprise", "label": "企业培训"},
        {"id": "open", "label": "公开课"},
        {"id": "verify", "label": "证书核验"},
        {"id": "about", "label": "关于我们"},
    ],
    "enterprise": {
        "title": "企业与机构培训",
        "subtitle": "从课纲设计到结业验收，每一天都是可交付的真实工作任务",
        "facts": [],
        "mentors": [],  # empty -> Landing.tsx renders "导师讲课素材筹备中，可通过后台配置" placeholders
    },
    "open_course_categories": [
        {"id": "cat-intro", "name": "入门", "sort_order": 0, "published": True},
        {"id": "cat-practice", "name": "实操预告", "sort_order": 1, "published": True},
    ],
    "open_courses": [
        {
            "id": "fde-intro",
            "title": "FDE 是谁：懂业务的技术落地者",
            "minutes": 2,
            "level": "入门",
            "category_id": "cat-intro",
            "summary": "用两分钟看清 FDE 如何把老板语言翻译成可验收交付。",
            # 营期介绍片（非 Day1 课件）。源文件：.upload/course-intro/camp-intro.mp4
            "object_key": open_course_key("fde-intro", "video", ".mp4"),
            "poster_key": open_course_key("fde-intro", "poster", ".jpg"),
            "duration_sec": 119,
            "published": True,
        },
        {
            "id": "fde-prompt",
            "title": "Prompt 准星：写出可验收的指令",
            "minutes": 2,
            "level": "入门",
            "category_id": "cat-intro",
            "summary": "角色 + 背景 + 任务 + 约束——指挥 AI 的最小公式。",
            "object_key": course_media_key("day01-c3-agent-team.mp4"),
            "poster_key": course_media_key("day01-c3-agent-team-poster.jpg"),
            "duration_sec": 87,
            "published": True,
        },
        {
            "id": "fde-delivery",
            "title": "今日交付规格：库存列表页",
            "minutes": 2,
            "level": "实操预告",
            "category_id": "cat-practice",
            "summary": "看清 Week1 最小可用产物长什么样，再决定是否报名完整营期。",
            "object_key": course_media_key("day01-c6-ui-prototype-accept.mp4"),
            "poster_key": course_media_key("day01-c6-ui-prototype-accept-poster.jpg"),
            "duration_sec": 91,
            "published": True,
        },
    ],
    "about": {
        "title": "关于我们",
        "body": "青山在是新一代数字化人才训练品牌，由青山OPC & 灵栖智能运营。我们面向政府、高校与企业，交付可验收、可留痕、可核验的 FDE 训练营与机构培训项目。",
    },
    "contact": {
        "title": "联系我们",
        "subtitle": "企业、高校与政府组织培训咨询",
        "email": "admin@lingqicloud.com",
        "note": "请留下组织名称、培训规模与期望开课时间，我们会安排顾问对接。",
    },
}

# Static M2 site sections without dedicated DB tables yet (tabs/enterprise/
# about/contact) — served from DEFAULT_LANDING unless body_json overrides.
# open_courses / open_course_categories are DB-overridable via body_json.
_STATIC_LANDING_KEYS = (
    "tabs",
    "enterprise",
    "open_course_categories",
    "open_courses",
    "about",
    "contact",
    "brand",
    "hero",
    "seo",
)

_PUBLIC_OPEN_PREFIXES = (
    COURSE_MEDIA_OPEN_PREFIX,
    COURSE_MEDIA_SHARED_PREFIX,
    legacy_camp_media_prefix(DEFAULT_CAMP_ID),
)
_PUBLIC_SITE_HERO_PREFIX = COURSE_MEDIA_SITE_HERO_PREFIX
_PUBLIC_SITE_MENTOR_PREFIX = COURSE_MEDIA_SITE_MENTOR_PREFIX


def _merge_section(key: str, body: dict[str, Any]) -> Any:
    """Merge body_json section with defaults; empty dict falls back / deep-merges."""
    default = DEFAULT_LANDING.get(key)
    raw = body.get(key)
    if key == "open_courses":
        return list_open_courses(include_unpublished=False)
    if key == "open_course_categories":
        return list_open_course_categories(include_unpublished=False)
    if key == "enterprise":
        ent = raw if isinstance(raw, dict) else {}
        base = dict(DEFAULT_LANDING["enterprise"])
        title = str(ent.get("title") or "").strip()
        subtitle = str(ent.get("subtitle") or "").strip()
        # 脏数据防护：曾出现 title="2" / facts=3
        if len(title) < 2:
            title = str(base.get("title") or "")
        if len(subtitle) < 2:
            subtitle = str(base.get("subtitle") or "")
        facts = ent.get("facts")
        if not isinstance(facts, list):
            facts = base.get("facts") or []
        mentors = ent.get("mentors") if isinstance(ent.get("mentors"), list) else []
        return {**base, **ent, "title": title, "subtitle": subtitle, "facts": facts, "mentors": mentors}
    if not isinstance(raw, dict) or not raw:
        return default
    if isinstance(default, dict):
        return {**default, **raw}
    return raw


def _public_hero_video(media_row: dict[str, Any] | None) -> dict[str, Any] | None:
    if not media_row:
        return None
    out: dict[str, Any] = {"poster_url": None, "src_url": None, "captions_url": None}
    poster = media_row.get("poster_url") or media_row.get("poster_key")
    src = media_row.get("src_url") or media_row.get("object_key")
    captions = media_row.get("captions_url") or media_row.get("captions_key")
    if poster:
        out["poster_url"] = "/api/v1/site/hero/stream?asset=poster"
        out["poster_key"] = str(poster)
    if src:
        out["src_url"] = "/api/v1/site/hero/stream?asset=video"
        out["object_key"] = str(src)
    if captions:
        out["captions_url"] = "/api/v1/site/hero/stream?asset=captions"
    return out if (out["poster_url"] or out["src_url"]) else None


def _normalize_open_course_category(raw: dict[str, Any]) -> dict[str, Any] | None:
    cid = str(raw.get("id") or "").strip()
    name = str(raw.get("name") or "").strip()
    if not cid or not name:
        return None
    published = raw.get("published")
    if published is None:
        published = True
    sort_order = raw.get("sort_order")
    try:
        sort_order = int(sort_order) if sort_order is not None else 0
    except (TypeError, ValueError):
        sort_order = 0
    return {
        "id": cid,
        "name": name,
        "sort_order": sort_order,
        "published": bool(published),
    }


def _normalize_open_course(raw: dict[str, Any]) -> dict[str, Any] | None:
    cid = str(raw.get("id") or "").strip()
    title = str(raw.get("title") or "").strip()
    if not cid or not title:
        return None
    published = raw.get("published")
    if published is None:
        published = True
    category_id = str(raw.get("category_id") or "").strip() or None
    course = {
        "id": cid,
        "title": title,
        "minutes": raw.get("minutes"),
        "level": raw.get("level"),
        "category_id": category_id,
        "summary": raw.get("summary"),
        "object_key": raw.get("object_key") or None,
        "poster_key": raw.get("poster_key") or None,
        "duration_sec": raw.get("duration_sec"),
        "published": bool(published),
    }
    if course["object_key"]:
        course["stream_url"] = f"/api/v1/site/open-courses/{cid}/stream"
        course["poster_url"] = f"/api/v1/site/open-courses/{cid}/stream?asset=poster" if course["poster_key"] else None
    return course


def _slugify_category_id(name: str) -> str:
    import re
    from uuid import uuid4

    base = re.sub(r"[^a-zA-Z0-9\u4e00-\u9fff_-]+", "-", (name or "").strip())
    base = base.strip("-_")[:24] or "cat"
    return f"cat-{base}-{uuid4().hex[:6]}"


def _persist_landing_body(body: dict[str, Any]) -> None:
    """Write full body_json for slug=landing."""
    _ensure_landing_row()
    with db_cursor() as cur:
        cur.execute("SELECT id FROM site_pages WHERE slug=? LIMIT 1", ("landing",))
        if not cur.fetchone():
            raise HTTPException(500, "landing page missing")
        try:
            cur.execute(
                "UPDATE site_pages SET body_json=?::jsonb, updated_at=NOW() WHERE slug=?",
                (json.dumps(body, ensure_ascii=False), "landing"),
            )
        except Exception as exc:
            raise HTTPException(500, f"无法写入站点配置（需 site_pages.body_json）: {exc}") from exc


def _maybe_migrate_open_course_categories(body: dict[str, Any]) -> dict[str, Any]:
    """If categories missing, derive from course.level (or default) and persist once."""
    raw_cats = body.get("open_course_categories")
    if isinstance(raw_cats, list) and raw_cats:
        return body

    raw_courses = body.get("open_courses")
    if not isinstance(raw_courses, list) or not raw_courses:
        # No DB courses — defaults already have categories; don't force-write.
        return body

    levels: list[str] = []
    for item in raw_courses:
        if not isinstance(item, dict):
            continue
        lv = str(item.get("level") or "").strip()
        if lv and lv not in levels:
            levels.append(lv)
    if not levels:
        levels = ["公开课"]

    cats: list[dict[str, Any]] = []
    level_to_id: dict[str, str] = {}
    for i, name in enumerate(levels):
        cid = _slugify_category_id(name)
        level_to_id[name] = cid
        cats.append({"id": cid, "name": name, "sort_order": i, "published": True})

    default_id = cats[0]["id"]
    updated_courses: list[dict[str, Any]] = []
    for item in raw_courses:
        if not isinstance(item, dict):
            continue
        course = dict(item)
        if not str(course.get("category_id") or "").strip():
            lv = str(course.get("level") or "").strip()
            course["category_id"] = level_to_id.get(lv) or default_id
        updated_courses.append(course)

    body = dict(body)
    body["open_course_categories"] = cats
    body["open_courses"] = updated_courses
    try:
        _persist_landing_body(body)
    except Exception:
        pass
    return body


def _load_landing_body() -> dict[str, Any]:
    """Return merged site_pages.body_json for slug=landing (empty if missing)."""
    try:
        with db_cursor() as cur:
            if not _table_exists(cur, "site_pages"):
                return {}
        _ensure_landing_row()
        with db_cursor() as cur:
            cur.execute("SELECT * FROM site_pages WHERE slug=? LIMIT 1", ("landing",))
            row = cur.fetchone()
            if not row:
                return {}
            page = dict(row)
            raw_body = page.get("body_json")
            if not raw_body:
                return {}
            return raw_body if isinstance(raw_body, dict) else json.loads(raw_body)
    except Exception:
        return {}


def list_open_course_categories(*, include_unpublished: bool = False) -> list[dict[str, Any]]:
    body = _load_landing_body()
    body = _maybe_migrate_open_course_categories(body)
    raw_list = body.get("open_course_categories")
    if not isinstance(raw_list, list) or not raw_list:
        raw_list = DEFAULT_LANDING["open_course_categories"]
    out: list[dict[str, Any]] = []
    for item in raw_list:
        if not isinstance(item, dict):
            continue
        cat = _normalize_open_course_category(item)
        if not cat:
            continue
        if not include_unpublished and not cat["published"]:
            continue
        out.append(cat)
    out.sort(key=lambda c: (int(c.get("sort_order") or 0), str(c.get("name") or "")))
    return out


def save_open_course_categories(categories: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Persist open_course_categories into site_pages.body_json."""
    normalized: list[dict[str, Any]] = []
    for item in categories:
        if not isinstance(item, dict):
            continue
        cat = _normalize_open_course_category(item)
        if cat:
            normalized.append(cat)
    normalized.sort(key=lambda c: (int(c.get("sort_order") or 0), str(c.get("name") or "")))
    body = _load_landing_body()
    body = dict(body) if body else {}
    body["open_course_categories"] = normalized
    _persist_landing_body(body)
    return list_open_course_categories(include_unpublished=True)


def list_open_courses(*, include_unpublished: bool = False) -> list[dict[str, Any]]:
    body = _load_landing_body()
    body = _maybe_migrate_open_course_categories(body)
    raw_list = body.get("open_courses")
    if not isinstance(raw_list, list) or not raw_list:
        raw_list = DEFAULT_LANDING["open_courses"]
    out: list[dict[str, Any]] = []
    for item in raw_list:
        if not isinstance(item, dict):
            continue
        course = _normalize_open_course(item)
        if not course:
            continue
        if not include_unpublished and not course["published"]:
            continue
        out.append(course)
    return out


def save_open_courses(courses: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Persist open_courses into site_pages.body_json (author/admin)."""
    normalized: list[dict[str, Any]] = []
    for item in courses:
        if not isinstance(item, dict):
            continue
        course = _normalize_open_course(item)
        if course:
            # strip derived urls before persist
            persist = {k: v for k, v in course.items() if k not in ("stream_url", "poster_url")}
            normalized.append(persist)

    body = _load_landing_body()
    body = dict(body) if body else {}
    body["open_courses"] = normalized
    _persist_landing_body(body)
    return list_open_courses(include_unpublished=True)

def _table_exists(cur, name: str) -> bool:
    cur.execute("SELECT to_regclass(?) AS reg", (name,))
    row = cur.fetchone()
    return bool(row and row.get("reg"))


def _first(d: dict[str, Any], *keys: str) -> Any:
    for k in keys:
        v = d.get(k)
        if v is not None:
            return v
    return None


class IdentityStartBody(BaseModel):
    provider: str | None = None
    return_url: str | None = None
    # Used only to derive `masked_name`/`id_tail` in-process — never stored
    # or logged verbatim (see services.application.kyc mask_* helpers).
    real_name: str | None = None
    id_number: str | None = None


class ProfileUpdateBody(BaseModel):
    display_name: str | None = None
    bio: str | None = None


class CertificateVerifyBody(BaseModel):
    cert_id: str
    real_name: str
    id_tail: str


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "learner"}


def _ensure_landing_row() -> None:
    """Idempotent — tries this module's column shape first, then the
    alternate (M1 domain_v2) shape. Each attempt uses its own connection:
    a failed statement aborts the whole Postgres transaction, so retrying
    a different column set on the *same* cursor would just fail again."""
    with db_cursor() as cur:
        cur.execute("SELECT 1 FROM site_pages WHERE slug=?", ("landing",))
        if cur.fetchone():
            return
    variants = [
        (
            "INSERT INTO site_pages (slug, title, tagline, cta_json) VALUES (?,?,?,?::jsonb) ON CONFLICT (slug) DO NOTHING",
            ("landing", DEFAULT_LANDING["title"], DEFAULT_LANDING["tagline"], json.dumps(DEFAULT_LANDING["cta"])),
        ),
        (
            "INSERT INTO site_pages (id, slug, title, status, body_json) VALUES (?,?,?,?,?::jsonb) ON CONFLICT (slug) DO NOTHING",
            (
                "site-page-landing",
                "landing",
                DEFAULT_LANDING["title"],
                "published",
                json.dumps({"tagline": DEFAULT_LANDING["tagline"], "cta": DEFAULT_LANDING["cta"]}),
            ),
        ),
    ]
    for sql, params in variants:
        try:
            with db_cursor() as cur:
                cur.execute(sql, params)
            return
        except Exception:
            continue


@router.get("/api/v1/site/landing")
def site_landing() -> dict[str, Any]:
    """Public — no auth. Reads DB content when the M2 site tables exist,
    otherwise falls back to hardcoded defaults for 「青山在」."""

    def _fallback() -> dict[str, Any]:
        payload = dict(DEFAULT_LANDING)
        payload["open_course_categories"] = list_open_course_categories(include_unpublished=False)
        payload["open_courses"] = list_open_courses(include_unpublished=False)
        return payload

    try:
        with db_cursor() as cur:
            if not _table_exists(cur, "site_pages"):
                return _fallback()
        _ensure_landing_row()
        with db_cursor() as cur:
            cur.execute("SELECT * FROM site_pages WHERE slug=? LIMIT 1", ("landing",))
            row = cur.fetchone()
            if not row:
                return _fallback()
            page = dict(row)
            body: dict[str, Any] = {}
            raw_body = page.get("body_json")
            if raw_body:
                body = raw_body if isinstance(raw_body, dict) else json.loads(raw_body)
            raw_cta = page.get("cta_json") or body.get("cta") or DEFAULT_LANDING["cta"]
            cta = raw_cta if isinstance(raw_cta, dict) else (json.loads(raw_cta) if raw_cta else DEFAULT_LANDING["cta"])

            hero_video: dict[str, Any] | None = None
            try:
                from services.author.site_content import _read_hero_media

                hero_video = _public_hero_video(_read_hero_media())
            except Exception:
                hero_video = None

            payload = {
                "title": page.get("title") or body.get("title") or DEFAULT_LANDING["title"],
                "tagline": _first(page, "tagline") or body.get("tagline") or DEFAULT_LANDING["tagline"],
                "hero_video": hero_video,
                "cta": cta,
            }
            for key in _STATIC_LANDING_KEYS:
                if key in ("open_courses", "open_course_categories"):
                    payload[key] = _merge_section(key, body)
                elif key == "enterprise":
                    from services.author.site_content import _normalize_enterprise

                    payload[key] = _normalize_enterprise(body.get("enterprise"))
                else:
                    payload[key] = _merge_section(key, body)
            return payload
    except Exception:
        return _fallback()


@router.get("/api/v1/site/hero/stream")
def stream_site_hero(
    request: Request,
    asset: str = Query("poster", pattern="^(video|poster|captions)$"),
) -> Response:
    """Public — no auth. Streams landing Hero 海报/视频/字幕（仅 shared/site/hero）。"""
    from services.author.site_content import _read_hero_media
    from services.media.app import stream_s3_object

    media = _read_hero_media()
    if not media:
        raise HTTPException(404, "未配置 Hero 媒资")
    if asset == "poster":
        key = media.get("poster_key") or media.get("poster_url")
    elif asset == "captions":
        key = media.get("captions_key") or media.get("captions_url")
    else:
        key = media.get("object_key") or media.get("src_url")
    if not key:
        raise HTTPException(404, f"Hero 暂无 {asset}")
    key = str(key).strip().lstrip("/")
    if ".." in key or not key.startswith(_PUBLIC_SITE_HERO_PREFIX):
        raise HTTPException(403, "Hero 媒资路径不允许")
    return stream_s3_object(request, key, cache_control="public, max-age=300")


@router.get("/api/v1/site/mentors/{mentor_id}/avatar")
def stream_mentor_avatar(mentor_id: str, request: Request) -> Response:
    """Public — no auth. Streams a landing mentor avatar under shared/site/mentors/."""
    from services.author.site_content import _normalize_enterprise, _load_page_and_body
    from services.media.app import stream_s3_object

    mid = (mentor_id or "").strip()
    if not mid:
        raise HTTPException(404, "导师不存在")
    try:
        _, body = _load_page_and_body()
        enterprise = _normalize_enterprise(body.get("enterprise"))
    except Exception as exc:
        raise HTTPException(404, "导师不存在") from exc
    mentor = next((m for m in enterprise.get("mentors") or [] if str(m.get("id")) == mid), None)
    if not mentor:
        raise HTTPException(404, "导师不存在")
    key = str(mentor.get("avatar_key") or "").strip().lstrip("/")
    if not key:
        raise HTTPException(404, "未配置头像")
    if ".." in key or not key.startswith(_PUBLIC_SITE_MENTOR_PREFIX):
        raise HTTPException(403, "头像路径不允许")
    return stream_s3_object(request, key, cache_control="public, max-age=300")


@router.get("/api/v1/site/open-courses/{course_id}/stream")
def stream_open_course(
    course_id: str,
    request: Request,
    asset: str = Query("video", pattern="^(video|poster)$"),
) -> Response:
    """Public — no auth. Streams a published open-course video/poster from MinIO."""
    courses = list_open_courses(include_unpublished=False)
    course = next((c for c in courses if c["id"] == course_id), None)
    if not course:
        raise HTTPException(404, "公开课不存在或未发布")
    key = course.get("object_key") if asset == "video" else course.get("poster_key")
    if not key:
        raise HTTPException(404, "该公开课暂无媒资")
    key = str(key).strip().lstrip("/")
    if ".." in key or not any(key.startswith(p) for p in _PUBLIC_OPEN_PREFIXES):
        raise HTTPException(403, "公开课媒资路径不允许")
    # 仅视频播放计入运维「公开课点击」；海报预加载不计入
    if asset == "video":
        try:
            actor = None
            try:
                actor = require_user(request).id
            except Exception:
                actor = None
            write_audit(
                "site.open_course_play",
                actor_id=actor,
                resource_type="open_course",
                resource_id=course_id,
                camp_id=None,
                details={"asset": asset, "object_key": key},
            )
        except Exception as exc:
            log.debug("open_course_play audit skipped: %s", exc)
    from services.media.app import stream_s3_object

    return stream_s3_object(request, key, cache_control="public, max-age=120")


# NOTE: `GET /api/v1/me/enrollments` + `POST /api/v1/auth/switch-enrollment`
# already exist in `services/auth/app.py` (M1's enrollment_records model) —
# not duplicated here.


class ContactLeadBody(BaseModel):
    name: str
    org: str | None = None
    email: str | None = None
    message: str | None = None


@router.post("/api/v1/site/contact", dependencies=[Depends(rate_limit("site_contact"))])
def site_contact(body: ContactLeadBody) -> dict[str, Any]:
    """Public — no auth, rate-limited. Enterprise/institution training
    inquiry form on the landing page's 「联系我们」 tab. Persists to
    `contact_leads` (migration 009) when present; always mirrors into the
    audit log so a lead is never silently dropped if that table is missing."""
    name = (body.name or "").strip()
    if not name:
        raise HTTPException(400, "请填写姓名或联系人")
    org = (body.org or "").strip() or None
    email = (body.email or "").strip() or None
    message = (body.message or "").strip() or None

    lead_id = str(uuid4())
    stored = False
    try:
        with db_cursor() as cur:
            if _table_exists(cur, "contact_leads"):
                cur.execute(
                    """
                    INSERT INTO contact_leads (id, name, org, email, message, created_at)
                    VALUES (?,?,?,?,?,NOW())
                    """,
                    (lead_id, name, org, email, message),
                )
                stored = True
    except Exception as exc:
        log.warning("contact_leads insert failed, falling back to audit log only: %s", exc)
        stored = False

    write_audit(
        "site.contact",
        resource_type="contact_lead",
        resource_id=lead_id,
        details={"name": name, "org": org, "email": email, "message": message, "stored": stored},
    )
    return {"ok": True, "id": lead_id}


@router.get("/api/v1/camps/{camp_id}/days/{day}/resources")
def camp_day_resources(camp_id: str, day: int, request: Request) -> dict[str, Any]:
    """Learner-facing supplementary materials (slides/links/downloads) for a
    day. Reads `learning_resources` (domain v2) scoped to the learner's
    resolved course_version when that table/mapping exists; otherwise
    returns an empty list with a `placeholder` flag so the UI can show a
    soft "资料筹备中" state instead of erroring — the day package itself
    already carries the primary learn/lab/quiz content."""
    require_camp_access(request, camp_id)
    lid = session_learner_id(request)

    items: list[dict[str, Any]] = []
    try:
        from services.application.course_runtime import (
            resolve_course_version_for_camp_learner,
            resolve_published_version_for_camp,
        )

        version_id = resolve_course_version_for_camp_learner(camp_id, lid) or resolve_published_version_for_camp(
            camp_id
        )
        if version_id:
            with db_cursor() as cur:
                if _table_exists(cur, "learning_resources"):
                    cur.execute(
                        """
                        SELECT * FROM learning_resources
                        WHERE course_version_id=? AND (day_index=? OR day_index IS NULL)
                        ORDER BY day_index NULLS FIRST, created_at
                        """,
                        (version_id, day),
                    )
                    items = [dict(r) for r in cur.fetchall()]
    except Exception as exc:
        log.warning("camp_day_resources lookup failed, returning placeholder: %s", exc)
        items = []

    return {"camp_id": camp_id, "day": day, "items": items, "placeholder": not items}


@router.get("/api/v1/me/profile")
def my_profile(request: Request) -> dict[str, Any]:
    user = require_user(request)
    identity_status = "unverified"
    bio = None
    avatar_url = None
    masked_name = None
    id_tail = None
    wx_nickname = None
    with db_cursor() as cur:
        cur.execute("SELECT display_name, wx_nickname FROM users WHERE id=?", (user.id,))
        urow = cur.fetchone()
        if urow:
            urow = dict(urow)
            if urow.get("display_name"):
                # Prefer DB name over token snapshot (may have been enriched after login)
                user_display = urow.get("display_name")
            else:
                user_display = user.display_name or user.email
            wx_nickname = urow.get("wx_nickname")
        else:
            user_display = user.display_name or user.email
        if _table_exists(cur, "identity_verifications"):
            cur.execute(
                "SELECT * FROM identity_verifications WHERE user_id=? ORDER BY created_at DESC LIMIT 1",
                (user.id,),
            )
            row = cur.fetchone()
            if row:
                identity_status = row.get("status") or "unverified"
                masked_name = row.get("masked_name")
                id_tail = row.get("id_tail")
        if _table_exists(cur, "user_profiles"):
            cur.execute("SELECT * FROM user_profiles WHERE user_id=?", (user.id,))
            row = cur.fetchone()
            if row:
                d = dict(row)
                bio = d.get("bio")
                avatar_url = _first(d, "avatar_url", "avatar_key")
    if avatar_url and isinstance(avatar_url, str) and not avatar_url.startswith("http") and not avatar_url.startswith("/api/"):
        avatar_url = f"/api/v1/media/stream?object_key={avatar_url}"
    from services.wechat_mp.profile import is_placeholder_display_name, profile_incomplete_for_user

    incomplete = profile_incomplete_for_user(user.id, user_display)
    return {
        "id": user.id,
        "display_name": user_display,
        "email": user.email,
        "role": user.role,
        "identity_status": identity_status,
        "identity_masked_name": masked_name,
        "identity_id_tail": id_tail,
        "bio": bio,
        "avatar_url": avatar_url,
        "wx_nickname": wx_nickname,
        "profile_incomplete": incomplete,
        "needs_display_name": is_placeholder_display_name(user_display),
        "needs_avatar": not bool(avatar_url),
        "camps": user_camps(user.id),
    }


@router.patch("/api/v1/me/profile")
def update_profile(body: ProfileUpdateBody, request: Request) -> dict[str, Any]:
    user = require_user(request)
    display_name = (body.display_name or "").strip() or None
    if display_name:
        # Guard against accidental a11y markers (e.g. "[disabled] 昵称") pasted from UI.
        display_name = display_name.replace("[disabled]", "").strip() or None
    bio = (body.bio or "").strip() if body.bio is not None else None
    if display_name:
        with db_cursor() as cur:
            cur.execute("UPDATE users SET display_name=? WHERE id=?", (display_name, user.id))
    try:
        with db_cursor() as cur:
            if _table_exists(cur, "user_profiles") and bio is not None:
                cur.execute("SELECT 1 FROM user_profiles WHERE user_id=?", (user.id,))
                if cur.fetchone():
                    cur.execute("UPDATE user_profiles SET bio=? WHERE user_id=?", (bio, user.id))
                else:
                    cur.execute("INSERT INTO user_profiles (user_id, bio) VALUES (?, ?)", (user.id, bio))
    except Exception as exc:
        log.warning("update_profile user_profiles failed: %s", exc)
    write_audit("profile.update", actor_id=user.id, details={"display_name": display_name, "bio": bio})
    return my_profile(request)


@router.post("/api/v1/me/profile/avatar")
async def upload_profile_avatar(request: Request, avatar: UploadFile = File(...)) -> dict[str, Any]:
    user = require_user(request)
    if not avatar.filename:
        raise HTTPException(400, "请上传头像图片")
    data = await avatar.read()
    if len(data) > 5 * 1024 * 1024:
        raise HTTPException(400, "头像不能超过 5MB")
    ext = Path(avatar.filename).suffix.lower() or ".jpg"
    if ext not in (".jpg", ".jpeg", ".png", ".webp", ".gif"):
        raise HTTPException(400, "仅支持 JPG / PNG / WebP / GIF")
    from services.storage import get_store

    key = f"profiles/{user.id}/avatar-{uuid4().hex[:10]}{ext}"
    get_store().put_bytes(
        S3_BUCKET_ARTIFACTS,
        key,
        data,
        content_type=avatar.content_type or "image/jpeg",
    )
    avatar_url = f"/api/v1/media/stream?object_key={key}"
    try:
        with db_cursor() as cur:
            if _table_exists(cur, "user_profiles"):
                cur.execute("SELECT 1 FROM user_profiles WHERE user_id=?", (user.id,))
                if cur.fetchone():
                    for sql in (
                        "UPDATE user_profiles SET avatar_url=? WHERE user_id=?",
                        "UPDATE user_profiles SET avatar_key=? WHERE user_id=?",
                    ):
                        try:
                            cur.execute(sql, (key, user.id))
                            break
                        except Exception:
                            continue
                else:
                    for sql, params in (
                        ("INSERT INTO user_profiles (user_id, avatar_url, bio) VALUES (?,?,?)", (user.id, key, None)),
                        ("INSERT INTO user_profiles (user_id, avatar_key, bio) VALUES (?,?,?)", (user.id, key, None)),
                    ):
                        try:
                            cur.execute(sql, params)
                            break
                        except Exception:
                            continue
    except Exception as exc:
        log.warning("upload_profile_avatar db update failed: %s", exc)
    write_audit("profile.avatar", actor_id=user.id, details={"avatar_key": key})
    return {"ok": True, "avatar_url": avatar_url, "profile": my_profile(request)}


@router.get("/api/v1/me/certificates")
def my_certificates(request: Request) -> dict[str, Any]:
    user = require_user(request)
    with db_cursor() as cur:
        if _table_exists(cur, "certificate_issuances"):
            cur.execute("SELECT * FROM certificate_issuances WHERE user_id=? ORDER BY issued_at DESC", (user.id,))
            rows = [dict(r) for r in cur.fetchall()]
            if rows:
                items = []
                for r in rows:
                    meta: dict[str, Any] = {}
                    raw_meta = r.get("meta_json")
                    if isinstance(raw_meta, dict):
                        meta = raw_meta
                    elif isinstance(raw_meta, str) and raw_meta.strip():
                        try:
                            meta = json.loads(raw_meta)
                        except Exception:
                            meta = {}
                    items.append(
                        {
                            "id": r.get("id"),
                            "cert_id": _first(r, "cert_id", "serial"),
                            "camp_id": r.get("camp_id"),
                            "course_title": r.get("course_title") or "结业证书",
                            "status": r.get("status") or "issued",
                            "issued_at": r.get("issued_at"),
                            "on_chain": bool(meta.get("chain_tx_hash")),
                            "chain_tx_hash": meta.get("chain_tx_hash"),
                            "chain_network": meta.get("chain_network"),
                        }
                    )
                return {"items": items, "source": "certificate_issuances"}

        # Legacy fallback — synthesize a passport-style summary per enrolled camp.
        cur.execute(
            """
            SELECT c.id AS camp_id, c.name AS camp_name
            FROM enrollments e JOIN camps c ON c.id = e.camp_id
            WHERE e.user_id=? AND e.status='active'
            """,
            (user.id,),
        )
        camps = [dict(r) for r in cur.fetchall()]
        cur.execute("SELECT kind FROM evidence WHERE learner_id=?", (user.id,))
        ev_rows = [dict(r) for r in cur.fetchall()]

    has_agent = any(r.get("kind") == "agent" for r in ev_rows)
    has_sim = any(r.get("kind") in ("lab", "sim") for r in ev_rows)
    if has_agent and has_sim:
        prefix = "FDE-DUAL"
    elif has_agent:
        prefix = "FDE-AGENT"
    elif has_sim:
        prefix = "FDE-SIM"
    else:
        prefix = None

    items = []
    for camp in camps:
        cert_id = f"{prefix}-{user.id[:8].upper()}-{camp['camp_id'][:6].upper()}" if prefix else None
        items.append(
            {
                "id": f"legacy-{camp['camp_id']}",
                "cert_id": cert_id,
                "camp_id": camp["camp_id"],
                "course_title": camp.get("camp_name") or camp["camp_id"],
                "status": "issued" if cert_id else "in_progress",
                "issued_at": None,
                "legacy": True,
            }
        )
    return {"items": items, "source": "legacy_evidence"}


def _find_certificate(cert_id: str) -> dict[str, Any] | None:
    """Each candidate WHERE-clause shape gets its own connection: a failed
    statement (unknown column) aborts that Postgres transaction, so retrying
    on the same cursor would just fail again with a different error."""
    for sql, params in (
        ("SELECT * FROM certificate_issuances WHERE id=? OR cert_id=?", (cert_id, cert_id)),
        ("SELECT * FROM certificate_issuances WHERE id=? OR serial=?", (cert_id, cert_id)),
        ("SELECT * FROM certificate_issuances WHERE id=?", (cert_id,)),
    ):
        try:
            with db_cursor() as cur:
                cur.execute(sql, params)
                row = cur.fetchone()
                return dict(row) if row else None
        except Exception:
            continue
    return None


@router.get("/api/v1/certificates/{cert_id}/verify")
def verify_certificate(cert_id: str) -> dict[str, Any]:
    """Public — no auth. Used by the /verify/:id page.

    Delegates to `services.application.certificates.verify_certificate`
    (the M6 real-issuance path); falls back to the pre-M6 ad-hoc lookup
    below only if that module's query errors out entirely (e.g. brand-new
    DB mid-migration), so legacy/edge-case certs still resolve.
    """
    try:
        from services.application.certificates import verify_certificate as _verify

        return _verify(cert_id)
    except Exception as exc:
        log.warning("certificates.verify_certificate failed, falling back: %s", exc)

    with db_cursor() as cur:
        table_ok = _table_exists(cur, "certificate_issuances")
    if table_ok:
        d = _find_certificate(cert_id)
        if d:
            learner_name = None
            try:
                with db_cursor() as cur:
                    cur.execute("SELECT display_name FROM users WHERE id=?", (d.get("user_id"),))
                    u = cur.fetchone()
                    learner_name = u.get("display_name") if u else None
            except Exception:
                learner_name = None
            status = d.get("status") or "issued"
            return {
                "valid": status not in ("revoked", "rejected"),
                "id": d.get("id"),
                "cert_id": _first(d, "cert_id", "serial"),
                "course_title": d.get("course_title"),
                "status": status,
                "issued_at": d.get("issued_at"),
                "learner_name": learner_name,
            }
    return {
        "valid": False,
        "cert_id": cert_id,
        "message": "证书不存在或为遗留证书（暂不支持在线核验）",
    }


@router.post("/api/v1/certificates/verify")
def verify_certificate_challenge(body: CertificateVerifyBody) -> dict[str, Any]:
    """Public three-factor verification — cert_id + real name + ID last six digits."""
    cert_id = (body.cert_id or "").strip()
    real_name = (body.real_name or "").strip()
    id_tail = (body.id_tail or "").strip()
    if not cert_id:
        raise HTTPException(400, "请填写证书编号")
    if not real_name:
        raise HTTPException(400, "请填写姓名")
    if not id_tail.isdigit() or len(id_tail) != 6:
        raise HTTPException(400, "请填写身份证后六位")
    try:
        from services.application.certificates import verify_certificate_challenge as _challenge

        return _challenge(cert_id, real_name, id_tail)
    except HTTPException:
        raise
    except Exception as exc:
        log.warning("certificates.verify_certificate_challenge failed: %s", exc)
        raise HTTPException(500, "核验服务暂不可用") from exc


@router.post("/api/v1/me/identity/start")
def start_identity(body: IdentityStartBody, request: Request) -> dict[str, Any]:
    """Kick off identity verification via the configured KYC adapter
    (`KYC_PROVIDER=stub|http`). Only ever persists the provider's opaque
    `provider_ref` + masked display fields — the raw `real_name`/`id_number`
    the learner may submit here are used solely to compute the masked
    fields in-process and are never written to the DB."""
    from services.application.kyc import get_kyc_provider, hash_id_number, mask_id_tail, mask_name

    user = require_user(request)
    real_name = (body.real_name or "").strip()
    id_number = (body.id_number or "").strip()
    if not real_name:
        raise HTTPException(400, "请填写真实姓名")
    if not id_number or len(id_number) < 6:
        raise HTTPException(400, "请填写有效的身份证号码")
    provider = get_kyc_provider(body.provider)
    result = provider.start_verification(user.id, body.return_url or "")
    provider_ref = str(result["provider_ref"])
    status = str(result["status"])
    masked_name = mask_name(real_name)
    id_tail = mask_id_tail(id_number)
    id_number_sha256 = hash_id_number(id_number)
    holder_name = real_name

    # Dev/demo stub: auto-pass when name + ID submitted (prod still needs real KYC)
    if provider.name == "stub" and FDE_ENV != "prod" and masked_name and id_tail:
        status = "verified"

    rid = str(uuid4())
    variants = [
        (
            """
            INSERT INTO identity_verifications
              (id, user_id, provider, verification_id, provider_ref, status, masked_name, id_tail,
               holder_name, id_number_sha256, created_at, updated_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,NOW(),NOW())
            """,
            (rid, user.id, provider.name, provider_ref, provider_ref, status, masked_name, id_tail, holder_name, id_number_sha256),
        ),
        (
            """
            INSERT INTO identity_verifications
              (id, user_id, method, provider_ref, status, masked_name, id_tail, holder_name, id_number_sha256, detail_json, created_at)
            VALUES (?,?,?,?,?,?,?,?,?,?::jsonb,NOW())
            """,
            (rid, user.id, provider.name, provider_ref, status, masked_name, id_tail, holder_name, id_number_sha256, json.dumps({"verification_id": provider_ref})),
        ),
    ]
    with db_cursor() as cur:
        table_ok = _table_exists(cur, "identity_verifications")
    if table_ok:
        for sql, params in variants:
            try:
                with db_cursor() as cur:
                    cur.execute(sql, params)
                break
            except Exception:
                continue
    write_audit("identity.start", actor_id=user.id, resource_id=provider_ref, details={"provider": provider.name, "status": status})
    return {
        "provider": provider.name,
        "provider_ref": provider_ref,
        "verification_id": provider_ref,
        "status": status,
        "masked_name": masked_name,
        "id_tail": id_tail,
    }


class IdentityWebhookBody(BaseModel):
    provider_ref: str
    status: str  # pending|verified|rejected
    masked_name: str | None = None
    id_tail: str | None = None


@router.post("/api/v1/me/identity/webhook")
def identity_webhook(body: IdentityWebhookBody) -> dict[str, Any]:
    """Dev-only stub callback simulating a real KYC provider's webhook —
    disabled whenever FDE_ENV=prod (a real provider integration would use a
    signed/authenticated callback URL instead of this open dev endpoint)."""
    if FDE_ENV == "prod":
        raise HTTPException(404, "not found")
    if body.status not in ("pending", "verified", "rejected"):
        raise HTTPException(400, "invalid status")
    # Two attempts, each on its own connection (see module docstring): the
    # 005-shape table has `updated_at`/`verification_id`, the 004-shape one
    # doesn't — a failed statement aborts that Postgres transaction, so a
    # retry must happen on a fresh cursor.
    variants = [
        (
            """
            UPDATE identity_verifications
            SET status=?, masked_name=COALESCE(?, masked_name), id_tail=COALESCE(?, id_tail), updated_at=NOW()
            WHERE provider_ref=? OR verification_id=?
            """,
            (body.status, body.masked_name, body.id_tail, body.provider_ref, body.provider_ref),
        ),
        (
            """
            UPDATE identity_verifications
            SET status=?, masked_name=COALESCE(?, masked_name), id_tail=COALESCE(?, id_tail)
            WHERE provider_ref=?
            """,
            (body.status, body.masked_name, body.id_tail, body.provider_ref),
        ),
    ]
    updated = 0
    for sql, params in variants:
        try:
            with db_cursor() as cur:
                cur.execute(sql, params)
                updated = cur.rowcount
            break
        except Exception:
            continue
    write_audit("identity.webhook", resource_id=body.provider_ref, details={"status": body.status})
    return {"ok": True, "updated": updated, "provider_ref": body.provider_ref, "status": body.status}


# ---------------------------------------------------------------------------
# M4: learner lab attachments — bound to an attempt/submission, never
# auto-ingested into the RAG knowledge base (`rag_eligible=false` unless an
# author explicitly opts a specific attachment in later).
# ---------------------------------------------------------------------------


def _scan_clamav(data: bytes) -> str:
    """Fail-closed: when CLAMAV_ENABLED=1, any scan failure/unavailability
    raises and aborts the upload — "could not scan" is never treated as
    "safe to store"."""
    if not CLAMAV_ENABLED:
        return "skipped"
    try:
        import clamd

        cd = clamd.ClamdUnixSocket()
        result = cd.instream(data)  # type: ignore[arg-type]
        status = (result or {}).get("stream", ("UNKNOWN",))[0]
        if status == "FOUND":
            raise RuntimeError("malware detected: clamav FOUND")
        return status
    except Exception as exc:
        log.error("clamav scan failed/unavailable, failing closed (upload rejected): %s", exc)
        raise RuntimeError(f"clamav scan unavailable/failed: {exc}") from exc


@router.post("/api/v1/labs/attachments", dependencies=[Depends(rate_limit("upload"))])
async def upload_lab_attachment(
    request: Request,
    file: UploadFile = File(...),
    camp_id: str | None = Form(None),
    day: int | None = Form(None),
    node_id: str | None = Form(None),
    attempt_id: str | None = Form(None),
    submission_id: str | None = Form(None),
) -> dict[str, Any]:
    from services.storage import get_store

    user = require_user(request)
    camp = session_camp_id(request, camp_id)
    name = file.filename or "attachment.bin"
    data = await file.read()
    if len(data) > LAB_ATTACHMENT_MAX_BYTES:
        raise HTTPException(413, "attachment too large")
    scan_status = _scan_clamav(data)
    sha = hashlib.sha256(data).hexdigest()
    aid = str(uuid4())
    safe_name = Path(name).name.replace("..", "_")
    key = f"lab-attachments/{camp}/{user.id}/{aid}/{safe_name}"
    ctype = file.content_type or "application/octet-stream"
    get_store().put_bytes(S3_BUCKET_ARTIFACTS, key, data, content_type=ctype)
    with db_cursor() as cur:
        cur.execute(
            """
            INSERT INTO lab_attachments
            (id, learner_id, camp_id, day, node_id, attempt_id, submission_id,
             object_key, filename, content_type, size_bytes, sha256, scan_status, rag_eligible, created_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?, FALSE, NOW())
            """,
            (aid, user.id, camp, day, node_id, attempt_id, submission_id, key, safe_name, ctype, len(data), sha, scan_status),
        )
    write_audit("lab_attachment.upload", actor_id=user.id, camp_id=camp, resource_type="lab_attachment", resource_id=aid)
    return {
        "id": aid,
        "filename": safe_name,
        "content_type": ctype,
        "size_bytes": len(data),
        "scan_status": scan_status,
        "rag_eligible": False,
        "attempt_id": attempt_id,
        "submission_id": submission_id,
    }


@router.get("/api/v1/labs/attachments")
def list_lab_attachments(
    request: Request,
    attempt_id: str | None = None,
    submission_id: str | None = None,
    day: int | None = None,
    node_id: str | None = None,
    camp_id: str | None = None,
) -> dict[str, Any]:
    user = require_user(request)
    clauses = ["learner_id=?"]
    params: list[Any] = [user.id]
    if attempt_id:
        clauses.append("attempt_id=?")
        params.append(attempt_id)
    if submission_id:
        clauses.append("submission_id=?")
        params.append(submission_id)
    if day is not None:
        clauses.append("day=?")
        params.append(day)
    if node_id:
        clauses.append("node_id=?")
        params.append(node_id)
    if camp_id:
        clauses.append("camp_id=?")
        params.append(camp_id)
    with db_cursor() as cur:
        cur.execute(
            f"SELECT * FROM lab_attachments WHERE {' AND '.join(clauses)} ORDER BY created_at DESC",
            tuple(params),
        )
        items = [dict(r) for r in cur.fetchall()]
    return {"items": items}


app.include_router(router)
