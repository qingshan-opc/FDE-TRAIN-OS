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
from fastapi.responses import HTMLResponse, RedirectResponse
from pydantic import BaseModel, Field

_PKG_ROOT = Path(__file__).resolve().parents[2]
if str(_PKG_ROOT) not in sys.path:
    sys.path.insert(0, str(_PKG_ROOT))
from services.shared.config import ROOT as _ROOT  # noqa: E402

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


def _resolve_camp_id(user: AuthUser, preferred: str | None = None) -> str | None:
    camps = user_camps(user.id)
    camp_id = preferred
    if camp_id:
        if user.role not in ("author", "admin") and not user_enrolled(user.id, camp_id):
            raise HTTPException(403, "未加入该营期，请使用邀请码或联系管理员")
        return camp_id
    if camps:
        return camps[0]["id"]
    if user.role in ("author", "admin"):
        with db_cursor() as cur:
            cur.execute("SELECT id FROM camps ORDER BY id LIMIT 1")
            row = cur.fetchone()
            return row["id"] if row else None
    return None


@router.post("/api/v1/auth/login", dependencies=[Depends(rate_limit("login"))])
def login(body: LoginBody, request: Request, response: Response) -> dict[str, Any]:
    user = authenticate(body.email.strip().lower(), body.password)
    if not user:
        write_audit("auth.login_failed", details={"email": body.email}, ip=request.client.host if request.client else None)
        raise HTTPException(401, "邮箱或密码错误")
    camp_id = _resolve_camp_id(user, body.camp_id)
    if camp_id and user.role == "learner":
        _ensure_enrollment_record_safe(user.id, camp_id)
    return _issue(user, camp_id, response, request)


@router.post("/api/v1/auth/wechat/login-qr", dependencies=[Depends(rate_limit("login"))])
def wechat_login_qr() -> dict[str, Any]:
    """Create MP temporary QR for scan-follow login."""
    from services.wechat_mp import login as mp_login

    try:
        return mp_login.create_login_qr()
    except RuntimeError as exc:
        raise HTTPException(503, str(exc)) from exc


@router.get("/api/v1/auth/wechat/login-status")
def wechat_login_status(
    state: str,
    request: Request,
    response: Response,
    expect_role: str | None = None,
) -> dict[str, Any]:
    """Poll QR login; when done, set auth cookies and return user + redirect hint."""
    from services.wechat_mp import login as mp_login
    from services.partner.app import _partner_org_id
    from services.partner import wechat_bind
    from services.partners import service as partners

    if not state or len(state) > 80:
        raise HTTPException(400, "invalid state")
    st = mp_login.poll_login_status(state)
    if st.get("expired"):
        return {"pending": False, "done": False, "expired": True}
    if not st.get("done"):
        return {"pending": True, "done": False, "expired": False}

    # Peek user before consuming / issuing cookies (partner page may require role)
    with db_cursor() as cur:
        cur.execute(
            """
            SELECT u.id, u.email, u.role, u.display_name
            FROM wechat_login_states s
            JOIN users u ON u.id = s.user_id
            WHERE s.id=? AND s.status='done' AND s.user_id IS NOT NULL
            """,
            (state,),
        )
        peek = cur.fetchone()
    if not peek:
        return {"pending": True, "done": False, "expired": False}

    if expect_role == "partner" and peek["role"] not in ("partner", "admin"):
        return {
            "pending": False,
            "done": False,
            "expired": False,
            "error": "该微信未关联机构账号。请先用邮箱登录机构后台并扫码绑定收款微信。",
        }

    user = mp_login.consume_login_user(state)
    if not user:
        return {"pending": True, "done": False, "expired": False}

    camp_id = None if user.role == "partner" else _resolve_camp_id(user, None)
    if camp_id and user.role == "learner":
        _ensure_enrollment_record_safe(user.id, camp_id)
    out = _issue(user, camp_id, response, request)
    _try_bind_pending_invite(request, response, user.id)
    write_audit("auth.wechat_login", actor_id=user.id, details={"role": user.role})

    redirect = "/app/courses"
    org_id = None
    receiver = None
    if user.role == "partner":
        org_id = _partner_org_id(user.id)
        redirect = "/partner"
        if org_id:
            receiver = wechat_bind.receiver_status(partners.get_organization(org_id))
            if receiver and not receiver.get("bound"):
                redirect = "/partner?bind=1"
    elif user.role in ("author", "admin"):
        redirect = "/author"

    out.update(
        {
            "pending": False,
            "done": True,
            "expired": False,
            "redirect": redirect,
            "org_id": org_id,
            "receiver": receiver,
        }
    )
    return out


def _mp_entry_error_html(message: str) -> HTMLResponse:
    body = f"""<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>进入失败</title>
<style>
body{{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;margin:0;background:#0f172a;color:#e2e8f0;}}
.card{{max-width:420px;margin:16vh auto;padding:28px 24px;background:#1e293b;border-radius:16px;text-align:center;}}
h1{{font-size:20px;margin:0 0 12px;color:#f87171}}
p{{line-height:1.6;color:#cbd5e1;font-size:15px}}
a{{color:#2dd4bf}}
</style></head>
<body><div class="card">
<h1>暂时无法进入</h1>
<p>{message}</p>
<p><a href="/login">去网页登录</a></p>
</div></body></html>"""
    return HTMLResponse(body, status_code=400)


def _stash_invite_cookie(response: Response, invite: str | None) -> str | None:
    """Validate invite and set pending cookie; return normalized code or None."""
    from services.partners.service import normalize_code, resolve_invite_code

    raw = (invite or "").strip()
    if not raw:
        return None
    ic = resolve_invite_code(raw)
    if not ic:
        return None
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
    return normalized


def _try_bind_pending_invite(request: Request, response: Response, user_id: str) -> bool:
    """Bind fde_invite_pending cookie if user has no attribution yet."""
    from services.partners.service import bind_invite_code, get_user_attribution

    pending = (request.cookies.get(INVITE_PENDING_COOKIE) or "").strip()
    if not pending:
        return False
    if get_user_attribution(user_id):
        response.delete_cookie(INVITE_PENDING_COOKIE, path="/")
        return False
    # Only attribute learners via invite posters
    user = get_user_by_id(user_id)
    if not user or user.role not in ("learner",):
        return False
    try:
        bind_invite_code(user_id, pending)
        response.delete_cookie(INVITE_PENDING_COOKIE, path="/")
        write_audit("auth.invite_bound_wechat", actor_id=user_id, details={"code": pending})
        return True
    except ValueError as exc:
        log.info("invite bind skipped user=%s: %s", user_id, exc)
        return False


@router.get("/api/v1/auth/wechat/mp-entry")
def wechat_mp_entry(
    next: str = "/app/courses",
    invite: str | None = None,
) -> Response:
    """公众号/海报入口：可选 invite → cookie，再跳转微信网页授权。"""
    from services.wechat_mp import entry as mp_entry

    try:
        url = mp_entry.create_oauth_authorize_url(next_path=next)
    except RuntimeError as exc:
        return _mp_entry_error_html(str(exc))
    out = RedirectResponse(url, status_code=302)
    _stash_invite_cookie(out, invite)
    return out


@router.get("/api/v1/auth/wechat/mp-entry/callback")
def wechat_mp_entry_callback(
    request: Request,
    response: Response,
    code: str | None = None,
    state: str | None = None,
) -> Response:
    """OAuth callback from WeChat — issue cookies then redirect into SPA."""
    from services.wechat_mp import entry as mp_entry

    if not code or not state:
        return _mp_entry_error_html("缺少微信授权参数，请从公众号菜单重新进入")
    try:
        user, next_path = mp_entry.complete_oauth_entry(code, state)
    except Exception as exc:
        log.warning("mp-entry callback failed: %s", exc)
        return _mp_entry_error_html(str(exc)[:200])

    camp_id = None if user.role == "partner" else _resolve_camp_id(user, None)
    if camp_id and user.role == "learner":
        _ensure_enrollment_record_safe(user.id, camp_id)
    # _issue sets cookies on response; we still need a RedirectResponse with those cookies
    out_resp = RedirectResponse(next_path, status_code=302)
    _issue(user, camp_id, out_resp, request)
    _try_bind_pending_invite(request, out_resp, user.id)
    write_audit("auth.wechat_mp_entry", actor_id=user.id, details={"next": next_path, "role": user.role})
    return out_resp


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

    from services.db import session_scope
    from services.models import User
    from services.repositories import UserRepository

    email = body.email.strip().lower()
    if len(body.password) < 6:
        raise HTTPException(400, "密码至少 6 位")
    with session_scope() as session:
        repo = UserRepository(session)
        if repo.get_by_email(email):
            raise HTTPException(409, "邮箱已注册")
        uid = str(uuid4())
        repo.add(
            User(
                id=uid,
                email=email,
                password_hash=_hash_password(body.password),
                display_name=body.display_name.strip() or "学员",
                role="learner",
            )
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
