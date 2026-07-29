"""Auth / Camp / Enrollment APIs — cookie refresh + no auto-enroll."""

from __future__ import annotations

import logging
import secrets
import sys
import time
from pathlib import Path
from typing import Any
from uuid import uuid4

from fastapi import APIRouter, Depends, FastAPI, HTTPException, Request, Response
from pydantic import BaseModel, Field

_ROOT = Path(__file__).resolve().parents[2]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from services.shared import (  # noqa: E402
    AuthUser,
    FDE_ENV,
    authenticate,
    create_access_token,
    create_refresh_session,
    decode_access_token,
    get_user_by_id,
    init_schema,
    mask_secret,
    now_iso,
    revoke_refresh_session,
    rotate_refresh_session,
    user_camps,
    user_enrolled,
    write_audit,
    db_cursor,
    _hash_password,
    _pg_upsert_enrollment,
)
from services.shared.config import CORS_ORIGINS  # noqa: E402
from services.shared.auth_constants import (  # noqa: E402
    ACCESS_COOKIE,
    CSRF_COOKIE,
    INVITE_PENDING_COOKIE,
    INVITE_PENDING_MAX_AGE,
    REFRESH_COOKIE,
    clear_auth_cookies,
    set_auth_cookies,
)
from services.shared.rate_limit import rate_limit  # noqa: E402

router = APIRouter(tags=["auth"])
app = FastAPI(title="FDE Auth", version="0.2.0")
init_schema()
log = logging.getLogger("fde.auth")


class LoginBody(BaseModel):
    email: str
    password: str
    camp_id: str | None = None


class InviteLoginBody(BaseModel):
    invite_code: str
    display_name: str = "学员"
    email: str | None = None


class RegisterBody(BaseModel):
    email: str
    password: str
    display_name: str = "学员"


class BindInviteBody(BaseModel):
    invite_code: str


class CampKeyBody(BaseModel):
    lingzhi_api_key: str = Field(default="")


class SwitchCampBody(BaseModel):
    camp_id: str


def _ensure_enrollment_record_safe(user_id: str, camp_id: str) -> None:
    """Best-effort v2 enrollment_records sync — see seed_domain_v2 docstring.
    Never blocks login/invite on a v2-model hiccup (e.g. camp without any
    course_version yet)."""
    try:
        from services.shared.seed_domain_v2 import ensure_enrollment_record

        ensure_enrollment_record(user_id, camp_id)
    except Exception:
        log.warning("ensure_enrollment_record failed for user=%s camp=%s", user_id, camp_id, exc_info=True)


def _secure() -> bool:
    from services.shared.auth_constants import auth_cookie_secure

    return auth_cookie_secure()


def _set_auth_cookies(resp: Response, access: str, refresh: str, csrf: str) -> None:
    set_auth_cookies(resp, access, refresh, csrf)


def _clear_cookies(resp: Response) -> None:
    clear_auth_cookies(resp)


def _issue(user: AuthUser, camp_id: str | None, response: Response, request: Request) -> dict[str, Any]:
    access = create_access_token(user, camp_id)
    _, refresh = create_refresh_session(
        user.id,
        camp_id,
        user_agent=request.headers.get("user-agent"),
        ip=request.client.host if request.client else None,
    )
    csrf = secrets.token_urlsafe(24)
    _set_auth_cookies(response, access, refresh, csrf)
    write_audit("auth.login", actor_id=user.id, camp_id=camp_id, ip=request.client.host if request.client else None)
    return {
        "token": access,
        "csrf": csrf,
        "user": {"id": user.id, "email": user.email, "role": user.role, "display_name": user.display_name},
        "camp_id": camp_id,
        "camps": user_camps(user.id),
    }


@router.post("/api/v1/auth/login", dependencies=[Depends(rate_limit("login"))])
def login(body: LoginBody, request: Request, response: Response) -> dict[str, Any]:
    user = authenticate(body.email.strip().lower(), body.password)
    if not user:
        write_audit("auth.login_failed", details={"email": body.email}, ip=request.client.host if request.client else None)
        raise HTTPException(401, "邮箱或密码错误")
    camps = user_camps(user.id)
    camp_id = body.camp_id
    if camp_id:
        if user.role not in ("author", "admin") and not user_enrolled(user.id, camp_id):
            raise HTTPException(403, "未加入该营期，请使用邀请码或联系管理员")
    elif camps:
        camp_id = camps[0]["id"]
    elif user.role in ("author", "admin"):
        with db_cursor() as cur:
            cur.execute("SELECT id FROM camps ORDER BY id LIMIT 1")
            row = cur.fetchone()
            camp_id = row["id"] if row else None
    if camp_id and user.role == "learner":
        _ensure_enrollment_record_safe(user.id, camp_id)
    return _issue(user, camp_id, response, request)


@router.get("/api/v1/auth/invite-link")
def claim_invite_link(code: str, response: Response) -> dict[str, Any]:
    """Validate org invite link and stash code in httpOnly cookie for registration."""
    from services.partners.service import normalize_code, resolve_invite_code

    raw = (code or "").strip()
    if not raw:
        raise HTTPException(400, "缺少邀请码")
    ic = resolve_invite_code(raw)
    if not ic:
        raise HTTPException(404, "邀请链接无效或已失效")
    normalized = normalize_code(raw)
    response.set_cookie(
        INVITE_PENDING_COOKIE,
        normalized,
        max_age=INVITE_PENDING_MAX_AGE,
        httponly=True,
        samesite="lax",
        secure=_secure(),
        path="/",
    )
    return {
        "valid": True,
        "code": normalized,
        "org_name": ic.get("org_name") or ic.get("org_id"),
    }


@router.post("/api/v1/auth/register", dependencies=[Depends(rate_limit("login"))])
def register(body: RegisterBody, request: Request, response: Response) -> dict[str, Any]:
    from services.partners.service import bind_invite_code

    email = body.email.strip().lower()
    if len(body.password) < 6:
        raise HTTPException(400, "密码至少 6 位")
    with db_cursor() as cur:
        cur.execute("SELECT id FROM users WHERE email=?", (email,))
        if cur.fetchone():
            raise HTTPException(409, "邮箱已注册")
        uid = str(uuid4())
        cur.execute(
            "INSERT INTO users (id, email, password_hash, display_name, role, created_at) VALUES (?,?,?,?,?,?)",
            (uid, email, _hash_password(body.password), body.display_name.strip() or "学员", "learner", now_iso()),
        )
    pending_invite = (request.cookies.get(INVITE_PENDING_COOKIE) or "").strip()
    if pending_invite:
        try:
            bind_invite_code(uid, pending_invite)
            response.delete_cookie(INVITE_PENDING_COOKIE, path="/")
        except ValueError as exc:
            raise HTTPException(400, str(exc)) from exc
    user = get_user_by_id(uid)
    assert user
    write_audit("auth.register", actor_id=user.id, ip=request.client.host if request.client else None)
    return _issue(user, None, response, request)


@router.post("/api/v1/me/bind-invite")
def bind_invite(body: BindInviteBody, request: Request) -> dict[str, Any]:
    """Self-service invite binding is disabled — attribution only via org registration link."""
    raise HTTPException(403, "不支持自行绑定邀请码，请通过机构提供的注册链接完成注册")


@router.post("/api/v1/auth/invite")
def invite_login(body: InviteLoginBody, request: Request, response: Response) -> dict[str, Any]:
    with db_cursor() as cur:
        cur.execute("SELECT id, name, version FROM camps WHERE invite_code=?", (body.invite_code.strip(),))
        camp = cur.fetchone()
        if not camp:
            raise HTTPException(404, "邀请码无效")
        camp = dict(camp)
        email = (body.email or f"invite-{uuid4().hex[:8]}@fde.local").strip().lower()
        cur.execute("SELECT id FROM users WHERE email=?", (email,))
        existing = cur.fetchone()
        if existing:
            uid = existing["id"] if isinstance(existing, dict) else existing[0]
        else:
            uid = str(uuid4())
            cur.execute(
                "INSERT INTO users (id, email, password_hash, display_name, role, created_at) VALUES (?,?,?,?,?,?)",
                (uid, email, _hash_password(uuid4().hex), body.display_name, "learner", now_iso()),
            )
        _pg_upsert_enrollment(cur, uid, camp["id"])
    user = get_user_by_id(uid)
    assert user
    _ensure_enrollment_record_safe(user.id, camp["id"])
    write_audit("auth.invite", actor_id=user.id, camp_id=camp["id"], resource_type="camp", resource_id=camp["id"])
    return _issue(user, camp["id"], response, request)


@router.post("/api/v1/auth/refresh")
def refresh(request: Request, response: Response) -> dict[str, Any]:
    token = request.cookies.get(REFRESH_COOKIE)
    if not token:
        raise HTTPException(401, "无 refresh session")
    try:
        user, _sid, new_refresh, camp_id = rotate_refresh_session(token)
    except ValueError as exc:
        _clear_cookies(response)
        raise HTTPException(401, "refresh 无效或已过期") from exc
    access = create_access_token(user, camp_id)
    csrf = secrets.token_urlsafe(24)
    _set_auth_cookies(response, access, new_refresh, csrf)
    return {
        "token": access,
        "csrf": csrf,
        "user": {"id": user.id, "email": user.email, "role": user.role, "display_name": user.display_name},
        "camp_id": camp_id,
        "camps": user_camps(user.id),
    }


@router.post("/api/v1/auth/logout")
def logout(request: Request, response: Response) -> dict[str, str]:
    token = request.cookies.get(REFRESH_COOKIE)
    if token:
        revoke_refresh_session(token)
    _clear_cookies(response)
    return {"status": "ok"}


@router.post("/api/v1/auth/switch-camp")
def switch_camp(body: SwitchCampBody, request: Request, response: Response) -> dict[str, Any]:
    user = getattr(request.state, "user", None)
    if not user:
        raise HTTPException(401, "未登录")
    if user.role not in ("author", "admin") and not user_enrolled(user.id, body.camp_id):
        raise HTTPException(403, "未加入该营期")
    return _issue(user, body.camp_id, response, request)


@router.get("/api/v1/auth/me")
def me(request: Request) -> dict[str, Any]:
    user = getattr(request.state, "user", None)
    if not user:
        auth = request.headers.get("Authorization", "")
        token = auth[7:] if auth.startswith("Bearer ") else request.cookies.get(ACCESS_COOKIE)
        if not token:
            raise HTTPException(401, "未登录")
        try:
            payload = decode_access_token(token)
        except Exception as exc:
            raise HTTPException(401, "token 无效") from exc
        u = get_user_by_id(payload["sub"])
        if not u:
            raise HTTPException(401, "用户不存在")
        user = u
        camp_id = payload.get("camp_id")
    else:
        camp_id = getattr(request.state, "camp_id", None)
    from services.partners.service import get_user_attribution

    attribution = get_user_attribution(user.id)
    return {
        "user": {"id": user.id, "email": user.email, "role": user.role, "display_name": user.display_name},
        "camp_id": camp_id,
        "camps": user_camps(user.id),
        "csrf": request.cookies.get(CSRF_COOKIE),
        "server_time": int(time.time()),
        "attribution": attribution,
    }


@router.get("/api/v1/camps")
def list_camps(request: Request) -> dict[str, Any]:
    user = getattr(request.state, "user", None)
    if not user:
        raise HTTPException(401, "未登录")
    with db_cursor() as cur:
        if user.role in ("author", "admin"):
            cur.execute("SELECT id, name, version, invite_code FROM camps")
        else:
            cur.execute(
                """
                SELECT c.id, c.name, c.version, c.invite_code
                FROM camps c JOIN enrollments e ON e.camp_id=c.id
                WHERE e.user_id=? AND e.status='active'
                """,
                (user.id,),
            )
        rows = [dict(r) for r in cur.fetchall()]
    return {"items": rows}


@router.get("/api/v1/camps/{camp_id}/config")
def camp_config(camp_id: str, request: Request) -> dict[str, Any]:
    user = getattr(request.state, "user", None)
    if not user:
        raise HTTPException(401, "未登录")
    if user.role not in ("author", "admin") and not user_enrolled(user.id, camp_id):
        raise HTTPException(403, "无权查看")
    with db_cursor() as cur:
        cur.execute("SELECT id, name, version, invite_code, lingzhi_api_key FROM camps WHERE id=?", (camp_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(404, "camp not found")
        d = dict(row)
    key = d.pop("lingzhi_api_key", None) or ""
    out = {**d, "lingzhi_api_key_masked": mask_secret(key), "has_lingzhi_key": bool(key)}
    if user.role in ("author", "admin"):
        out["lingzhi_api_key_set"] = bool(key)
    else:
        out.pop("invite_code", None)
    return out


@router.put("/api/v1/camps/{camp_id}/lingzhi-key")
def set_camp_key(camp_id: str, body: CampKeyBody, request: Request) -> dict[str, Any]:
    user = getattr(request.state, "user", None)
    if not user or user.role not in ("author", "admin"):
        raise HTTPException(403, "仅教研可配置")
    with db_cursor() as cur:
        cur.execute("UPDATE camps SET lingzhi_api_key=? WHERE id=?", (body.lingzhi_api_key or None, camp_id))
        cur.execute("SELECT id FROM camps WHERE id=?", (camp_id,))
        if not cur.fetchone():
            raise HTTPException(404, "camp not found")
    write_audit("camp.set_lingzhi_key", actor_id=user.id, camp_id=camp_id, resource_type="camp", resource_id=camp_id)
    return {"camp_id": camp_id, "lingzhi_api_key_masked": mask_secret(body.lingzhi_api_key), "ok": True}


class SwitchEnrollmentBody(BaseModel):
    enrollment_id: str


@router.get("/api/v1/me/enrollments")
def my_enrollments(request: Request) -> dict[str, Any]:
    """List the current user's v2 enrollment records with course/offering titles."""
    user = getattr(request.state, "user", None)
    if not user:
        raise HTTPException(401, "未登录")
    from services.application import EnrollmentService

    items = EnrollmentService().list_for_user(user.id)
    active = None
    try:
        with db_cursor() as cur:
            cur.execute(
                """
                SELECT active_enrollment_id FROM sessions
                WHERE user_id=? AND revoked_at IS NULL AND active_enrollment_id IS NOT NULL
                ORDER BY created_at DESC LIMIT 1
                """,
                (user.id,),
            )
            row = cur.fetchone()
            active = row["active_enrollment_id"] if row else None
    except Exception:
        active = None
    return {"items": items, "active_enrollment_id": active}


@router.post("/api/v1/auth/switch-enrollment")
def switch_enrollment(body: SwitchEnrollmentBody, request: Request, response: Response) -> dict[str, Any]:
    """Set the active enrollment; also updates legacy camp scope for compat."""
    user = getattr(request.state, "user", None)
    if not user:
        raise HTTPException(401, "未登录")
    from services.application import EnrollmentService

    try:
        info = EnrollmentService().switch_active_enrollment(user.id, body.enrollment_id)
    except ValueError as exc:
        raise HTTPException(404, "未找到该报名记录") from exc

    camp_id = info.get("camp_id")
    # Re-issue tokens so the new camp scope is carried in the access token.
    out = _issue(user, camp_id, response, request)
    # Ensure the freshly-issued session also records the active enrollment.
    try:
        with db_cursor() as cur:
            cur.execute(
                "UPDATE sessions SET active_enrollment_id=? WHERE user_id=? AND revoked_at IS NULL",
                (body.enrollment_id, user.id),
            )
    except Exception:
        pass
    write_audit(
        "auth.switch_enrollment",
        actor_id=user.id,
        camp_id=camp_id,
        resource_type="enrollment",
        resource_id=body.enrollment_id,
    )
    out["active_enrollment_id"] = body.enrollment_id
    out["enrollment"] = info
    return out


@router.get("/health")
def health() -> dict[str, Any]:
    return {"status": "ok", "service": "auth", "cors": CORS_ORIGINS}


app.include_router(router)
