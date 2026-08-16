"""Auth / Camp / Enrollment APIs — cookie refresh + no auto-enroll."""

from __future__ import annotations

import html
import logging
import secrets
import sys
import time
from pathlib import Path
from typing import Any
from urllib.parse import urlencode
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
    JSAPI_OPENID_COOKIE,
    JSAPI_OPENID_MAX_AGE,
    JSAPI_OAUTH_STATE_COOKIE,
    BIND_OAUTH_STATE_COOKIE,
    MP_OAUTH_STATE_COOKIE,
    REFRESH_COOKIE,
    clear_auth_cookies,
    set_auth_cookies,
)
from services.shared.rate_limit import rate_limit  # noqa: E402

router = APIRouter(tags=["auth"])
app = FastAPI(title="FDE Auth", version="0.2.0")
init_schema()
log = logging.getLogger("fde.auth")


REMEMBER_TTL_SEC = 30 * 86400


class LoginBody(BaseModel):
    email: str
    password: str
    camp_id: str | None = None
    remember: bool = False


class PasswordResetStartBody(BaseModel):
    email: str


class PasswordResetConfirmBody(BaseModel):
    email: str
    code: str
    new_password: str


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


def _set_auth_cookies(
    resp: Response,
    access: str,
    refresh: str,
    csrf: str,
    *,
    refresh_max_age: int | None = None,
) -> None:
    set_auth_cookies(resp, access, refresh, csrf, refresh_max_age=refresh_max_age)


def _clear_cookies(resp: Response) -> None:
    clear_auth_cookies(resp)


def _wx_bound_for(user: AuthUser) -> bool:
    from services.wechat_mp import bind_reset

    if not bind_reset.role_requires_wx_bind(user.role):
        return True
    return bind_reset.user_has_wx_openid(user.id)


def _issue(
    user: AuthUser,
    camp_id: str | None,
    response: Response,
    request: Request,
    *,
    remember: bool = False,
) -> dict[str, Any]:
    from services.auth.session_context import attach_session_context, user_can_learn

    ttl = REMEMBER_TTL_SEC if remember else None
    sid, refresh = create_refresh_session(
        user.id,
        camp_id,
        user_agent=request.headers.get("user-agent"),
        ip=request.client.host if request.client else None,
        exclusive=True,
        ttl_sec=ttl,
    )
    access = create_access_token(user, camp_id, session_id=sid)
    csrf = secrets.token_urlsafe(24)
    _set_auth_cookies(response, access, refresh, csrf, refresh_max_age=ttl)
    write_audit("auth.login", actor_id=user.id, camp_id=camp_id, ip=request.client.host if request.client else None)
    wx_bound = _wx_bound_for(user)
    profile_incomplete = False
    try:
        from services.wechat_mp.profile import profile_incomplete_for_user

        if user_can_learn(user.role) and user.role not in ("author", "admin"):
            profile_incomplete = profile_incomplete_for_user(user.id, user.display_name)
    except Exception:
        profile_incomplete = False
    return attach_session_context(
        {
            "token": access,
            "csrf": csrf,
            "user": {"id": user.id, "email": user.email, "role": user.role, "display_name": user.display_name},
            "camp_id": camp_id,
            "camps": user_camps(user.id),
            "wx_bound": wx_bound,
            "needs_wx_bind": not wx_bound,
            "profile_incomplete": profile_incomplete,
        },
        user,
    )


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
    if camp_id and user.role in ("learner", "partner"):
        _ensure_enrollment_record_safe(user.id, camp_id)
    issued = _issue(user, camp_id, response, request, remember=bool(body.remember))
    # 邮箱登录同样消费邀请 cookie（机构 / 学员推荐），与微信登录一致
    if user.role in ("learner", "partner"):
        _try_bind_pending_invite(request, response, user.id)
    return issued


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

    if expect_role == "partner":
        from services.auth.session_context import list_partner_orgs

        # Partner console QR: require org linkage (role may still be partner, or learner+org)
        if peek["role"] not in ("partner", "admin") and not list_partner_orgs(str(peek["id"])):
            return {
                "pending": False,
                "done": False,
                "expired": False,
                "error": "该微信未关联机构账号。请先用邮箱登录机构后台并扫码绑定收款微信。",
            }

    user = mp_login.consume_login_user(state)
    if not user:
        return {"pending": True, "done": False, "expired": False}

    from services.auth.session_context import build_session_context, list_partner_orgs

    camp_id = _resolve_camp_id(user, None)
    if camp_id and user.role in ("learner", "partner"):
        _ensure_enrollment_record_safe(user.id, camp_id)
    out = _issue(user, camp_id, response, request)
    _try_bind_pending_invite(request, response, user.id)
    write_audit("auth.wechat_login", actor_id=user.id, details={"role": user.role})

    ctx = build_session_context(user)
    redirect = str(ctx["default_home"])
    org_id = None
    receiver = None
    orgs = list_partner_orgs(user.id)
    if orgs:
        org_id = orgs[0]["id"]
        receiver = wechat_bind.receiver_status(partners.get_organization(org_id))
        # Partner-console QR login: if receiver unbound, nudge bind flow
        if expect_role == "partner" and receiver and not receiver.get("bound"):
            redirect = "/partner?bind=1"

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


def _wechat_login_fallback(next_path: str, *, reason: str = "off") -> RedirectResponse:
    from services.wechat_mp import entry as mp_entry

    nxt = mp_entry.sanitize_next(next_path) or "/app/shop"
    query = urlencode({"next": nxt, "wx": reason})
    return RedirectResponse(f"/login?{query}", status_code=302)


def _mp_entry_error_html(message: str, *, next_path: str = "/app/shop") -> HTMLResponse:
    from services.wechat_mp import entry as mp_entry

    nxt = mp_entry.sanitize_next(next_path) or "/app/shop"
    raw = (message or "").strip()
    unconfigured = any(token in raw for token in ("AppID", "AppSecret", "未配置"))
    if unconfigured:
        title = "微信登录暂不可用"
        detail = "当前环境还没开通微信授权。用邮箱登录即可继续看课。"
    else:
        title = "这次没进来"
        detail = raw or "微信授权没有完成。可以再试一次，或改用邮箱登录。"
    login_href = html.escape(f"/login?{urlencode({'next': nxt, 'wx': 'err'})}", quote=True)
    retry_href = html.escape(f"/api/v1/auth/wechat/mp-entry?{urlencode({'next': nxt})}", quote=True)
    safe_detail = html.escape(detail)
    retry_block = (
        ""
        if unconfigured
        else f'<a class="ghost" href="{retry_href}">再试一次微信</a>'
    )
    body = f"""<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"/>
<title>青山在 · {html.escape(title)}</title>
<style>
  :root {{
    --paper: #eef3f2;
    --sheet: #f7faf9;
    --ink: #1c2321;
    --mute: #5b6b67;
    --pine: #0f766e;
    --pine-deep: #0f2e2a;
    --line: rgba(15, 46, 42, 0.12);
  }}
  * {{ box-sizing: border-box; }}
  html, body {{ margin: 0; min-height: 100%; }}
  body {{
    min-height: 100svh;
    font-family: "PingFang SC", "Noto Sans SC", -apple-system, BlinkMacSystemFont, sans-serif;
    background:
      radial-gradient(80% 50% at 50% -10%, rgba(20, 184, 166, 0.16), transparent 60%),
      var(--paper);
    color: var(--ink);
    display: flex;
    flex-direction: column;
  }}
  .bar {{
    height: 4px;
    background: linear-gradient(90deg, var(--pine-deep), var(--pine));
  }}
  main {{
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 28px 20px calc(28px + env(safe-area-inset-bottom));
  }}
  .sheet {{
    width: min(100%, 400px);
    background: var(--sheet);
    border: 1px solid var(--line);
    border-radius: 20px;
    padding: 28px 24px 24px;
    box-shadow: 0 18px 50px rgba(15, 46, 42, 0.08);
  }}
  .brand {{
    font-family: "Noto Serif SC", "Songti SC", serif;
    letter-spacing: 0.18em;
    font-size: 13px;
    color: var(--pine);
    margin: 0 0 18px;
  }}
  h1 {{
    font-size: 22px;
    line-height: 1.3;
    margin: 0 0 10px;
    font-weight: 650;
  }}
  p {{
    margin: 0 0 22px;
    color: var(--mute);
    font-size: 15px;
    line-height: 1.65;
  }}
  .actions {{ display: grid; gap: 10px; }}
  a.primary, a.ghost {{
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 48px;
    border-radius: 999px;
    text-decoration: none;
    font-size: 15px;
    font-weight: 600;
  }}
  a.primary {{
    background: var(--pine);
    color: #f7faf9;
  }}
  a.ghost {{
    background: transparent;
    color: var(--pine-deep);
    border: 1px solid var(--line);
  }}
</style>
</head>
<body>
  <div class="bar"></div>
  <main>
    <div class="sheet">
      <p class="brand">青山在</p>
      <h1>{html.escape(title)}</h1>
      <p>{safe_detail}</p>
      <div class="actions">
        <a class="primary" href="{login_href}">用邮箱登录</a>
        {retry_block}
      </div>
    </div>
  </main>
</body>
</html>"""
    return HTMLResponse(body, status_code=400)


def _resolve_any_invite(raw: str) -> dict[str, Any] | None:
    """Org invite wins lookup; fall back to learner referral code."""
    from services.partners.service import resolve_invite_code
    from services.referral.service import resolve_learner_invite_code

    ic = resolve_invite_code(raw)
    if ic:
        return ic
    return resolve_learner_invite_code(raw)


def _stash_invite_cookie(response: Response, invite: str | None) -> str | None:
    """Validate invite and set pending cookie; return normalized code or None."""
    from services.partners.service import normalize_code

    raw = (invite or "").strip()
    if not raw:
        return None
    ic = _resolve_any_invite(raw)
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
    from services.partners.service import get_user_attribution
    from services.referral.service import bind_any_invite_code, get_user_referral

    pending = (request.cookies.get(INVITE_PENDING_COOKIE) or "").strip()
    if not pending:
        return False
    if get_user_attribution(user_id):
        response.delete_cookie(INVITE_PENDING_COOKIE, path="/")
        return False
    if get_user_referral(user_id):
        response.delete_cookie(INVITE_PENDING_COOKIE, path="/")
        return False
    # Only attribute learners (and partner-as-learner) via invite posters
    user = get_user_by_id(user_id)
    if not user or user.role not in ("learner", "partner"):
        return False
    try:
        result = bind_any_invite_code(user_id, pending)
        response.delete_cookie(INVITE_PENDING_COOKIE, path="/")
        write_audit(
            "auth.invite_bound_wechat",
            actor_id=user_id,
            details={"code": pending, "kind": result.get("kind")},
        )
        return True
    except ValueError as exc:
        log.info("invite bind skipped user=%s: %s", user_id, exc)
        return False


def _set_mp_oauth_state_cookie(resp: Response, state: str) -> None:
    from services.wechat_mp import entry as mp_entry

    resp.set_cookie(
        MP_OAUTH_STATE_COOKIE,
        state,
        max_age=mp_entry.STATE_TTL_SEC,
        httponly=True,
        samesite="lax",
        secure=_secure(),
        path="/",
    )


def _restart_wechat_oauth(next_path: str) -> Response:
    from services.wechat_mp import entry as mp_entry

    try:
        url, state = mp_entry.create_oauth_authorize_url(next_path=next_path)
    except RuntimeError:
        return _wechat_login_fallback(next_path, reason="off")
    out = RedirectResponse(url, status_code=302)
    _set_mp_oauth_state_cookie(out, state)
    return out


@router.get("/api/v1/auth/wechat/oauth-ready")
def wechat_oauth_ready() -> dict[str, bool]:
    from services.wechat_mp import entry as mp_entry

    return {"ready": mp_entry.entry_configured()}


@router.get("/api/v1/auth/wechat/mp-entry")
def wechat_mp_entry(
    request: Request,
    next: str = "/app/courses",
    invite: str | None = None,
) -> Response:
    """公众号/海报入口：可选 invite → cookie，再跳转微信网页授权。"""
    from services.wechat_mp import entry as mp_entry

    reuse = (request.cookies.get(MP_OAUTH_STATE_COOKIE) or "").strip() or None
    try:
        url, state = mp_entry.create_oauth_authorize_url(next_path=next, reuse_state=reuse)
    except RuntimeError:
        return _wechat_login_fallback(next, reason="off")
    out = RedirectResponse(url, status_code=302)
    _stash_invite_cookie(out, invite)
    _set_mp_oauth_state_cookie(out, state)
    return out


def _set_jsapi_oauth_state_cookie(resp: Response, state: str) -> None:
    from services.wechat_mp import entry as mp_entry

    resp.set_cookie(
        JSAPI_OAUTH_STATE_COOKIE,
        state,
        max_age=mp_entry.STATE_TTL_SEC,
        httponly=True,
        samesite="lax",
        secure=_secure(),
        path="/",
    )


def _restart_jsapi_oauth(next_path: str) -> Response:
    from services.wechat_mp import jsapi_openid as jsapi_ox

    try:
        url, state = jsapi_ox.create_jsapi_authorize_url(next_path=next_path)
    except RuntimeError:
        return _wechat_login_fallback(next_path, reason="off")
    out = RedirectResponse(url, status_code=302)
    _set_jsapi_oauth_state_cookie(out, state)
    return out


@router.get("/api/v1/auth/wechat/jsapi-openid")
def wechat_jsapi_openid(request: Request, next: str = "/app/shop") -> Response:
    """Silent snsapi_base — stamp current WeChat openid for JSAPI pay, keep login."""
    from services.wechat_mp import jsapi_openid as jsapi_ox

    reuse = (request.cookies.get(JSAPI_OAUTH_STATE_COOKIE) or "").strip() or None
    try:
        url, state = jsapi_ox.create_jsapi_authorize_url(next_path=next, reuse_state=reuse)
    except RuntimeError:
        return _wechat_login_fallback(next, reason="off")
    out = RedirectResponse(url, status_code=302)
    _set_jsapi_oauth_state_cookie(out, state)
    return out


@router.get("/api/v1/auth/wechat/jsapi-openid/callback")
def wechat_jsapi_openid_callback(
    request: Request,
    code: str | None = None,
    state: str | None = None,
) -> Response:
    """OAuth callback — set payer cookie only. Never calls _issue()."""
    from services.wechat_mp import entry as mp_entry
    from services.wechat_mp import jsapi_openid as jsapi_ox

    if not code or not state:
        return _restart_jsapi_oauth("/app/shop")
    try:
        result = jsapi_ox.complete_jsapi_openid(code, state)
    except mp_entry.OauthRestart as exc:
        log.info("jsapi-openid callback restart next=%s", exc.next_path)
        return _restart_jsapi_oauth(exc.next_path)
    except Exception as exc:
        log.warning("jsapi-openid callback failed: %s", exc)
        return _mp_entry_error_html("请重新授权后再支付", next_path="/app/shop")

    next_path = jsapi_ox.with_pay_flag(result.next_path)
    out = RedirectResponse(next_path, status_code=302)
    if result.openid:
        out.set_cookie(
            JSAPI_OPENID_COOKIE,
            result.openid,
            max_age=JSAPI_OPENID_MAX_AGE,
            httponly=True,
            samesite="lax",
            secure=_secure(),
            path="/",
        )
    out.delete_cookie(JSAPI_OAUTH_STATE_COOKIE, path="/")
    return out


def _set_bind_oauth_state_cookie(resp: Response, state: str) -> None:
    from services.wechat_mp import entry as mp_entry

    resp.set_cookie(
        BIND_OAUTH_STATE_COOKIE,
        state,
        max_age=mp_entry.STATE_TTL_SEC,
        httponly=True,
        samesite="lax",
        secure=_secure(),
        path="/",
    )


def _restart_bind_oauth(next_path: str, user_id: str) -> Response:
    from services.wechat_mp import bind_oauth as bind_ox

    try:
        url, state = bind_ox.create_bind_authorize_url(user_id=user_id, next_path=next_path)
    except RuntimeError:
        return _wechat_login_fallback(next_path, reason="off")
    out = RedirectResponse(url, status_code=302)
    _set_bind_oauth_state_cookie(out, state)
    return out


@router.get("/api/v1/auth/wechat/bind-oauth")
def wechat_bind_oauth(request: Request, next: str = "/app/invite") -> Response:
    """In-WeChat authorize — bind current WeChat to the logged-in account, keep session."""
    from services.wechat_mp import bind_oauth as bind_ox
    from services.wechat_mp import bind_reset
    from services.wechat_mp import entry as mp_entry

    nxt = mp_entry.sanitize_next(next) or bind_ox.DEFAULT_NEXT
    user = getattr(request.state, "user", None)
    if not user:
        q = urlencode({"next": nxt, "bind": "1"})
        return RedirectResponse(f"/login?{q}", status_code=302)
    if bind_reset.user_has_wx_openid(user.id):
        return RedirectResponse(bind_ox.with_bind_flag(nxt, "ok"), status_code=302)
    reuse = (request.cookies.get(BIND_OAUTH_STATE_COOKIE) or "").strip() or None
    try:
        url, state = bind_ox.create_bind_authorize_url(user_id=user.id, next_path=nxt, reuse_state=reuse)
    except RuntimeError:
        return _wechat_login_fallback(nxt, reason="off")
    out = RedirectResponse(url, status_code=302)
    _set_bind_oauth_state_cookie(out, state)
    return out


@router.get("/api/v1/auth/wechat/bind-oauth/callback")
def wechat_bind_oauth_callback(
    request: Request,
    code: str | None = None,
    state: str | None = None,
) -> Response:
    """OAuth callback — link openid onto the current user. Never calls _issue()."""
    from services.wechat_mp import bind_oauth as bind_ox
    from services.wechat_mp import entry as mp_entry

    user = getattr(request.state, "user", None)
    if not user:
        return _wechat_login_fallback("/app/invite", reason="err")
    if not code or not state:
        return _restart_bind_oauth("/app/invite", user.id)
    try:
        result = bind_ox.complete_bind_oauth(code, state, user_id=user.id)
    except bind_ox.OpenidTaken as exc:
        out = RedirectResponse(bind_ox.with_bind_flag(exc.next_path, "taken"), status_code=302)
        out.delete_cookie(BIND_OAUTH_STATE_COOKIE, path="/")
        return out
    except mp_entry.OauthRestart as exc:
        log.info("bind-oauth callback restart next=%s", exc.next_path)
        return _restart_bind_oauth(exc.next_path, user.id)
    except Exception as exc:
        log.warning("bind-oauth callback failed: %s", exc)
        return _mp_entry_error_html("请重新授权绑定微信", next_path="/app/invite")

    flag = "ok" if not result.conflict else "taken"
    out = RedirectResponse(bind_ox.with_bind_flag(result.next_path, flag), status_code=302)
    out.delete_cookie(BIND_OAUTH_STATE_COOKIE, path="/")
    write_audit("auth.wechat_bind_oauth", actor_id=user.id, details={"next": result.next_path})
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
        return _restart_wechat_oauth("/app/shop")
    try:
        user, next_path = mp_entry.complete_oauth_entry(code, state)
    except mp_entry.OauthRestart as exc:
        log.info("mp-entry callback restart next=%s", exc.next_path)
        return _restart_wechat_oauth(exc.next_path)
    except Exception as exc:
        log.warning("mp-entry callback failed: %s", exc)
        return _mp_entry_error_html("请重新扫码进入", next_path="/app/shop")

    camp_id = _resolve_camp_id(user, None)
    if camp_id and user.role in ("learner", "partner"):
        _ensure_enrollment_record_safe(user.id, camp_id)
    # Prefer OAuth next; fall back to server default_home if empty/invalid already sanitized
    from services.auth.session_context import build_session_context

    if not next_path:
        next_path = build_session_context(user)["default_home"]
    # _issue sets cookies on response; we still need a RedirectResponse with those cookies
    out_resp = RedirectResponse(next_path, status_code=302)
    _issue(user, camp_id, out_resp, request)
    _try_bind_pending_invite(request, out_resp, user.id)
    out_resp.delete_cookie(MP_OAUTH_STATE_COOKIE, path="/")
    write_audit("auth.wechat_mp_entry", actor_id=user.id, details={"next": next_path, "role": user.role})
    return out_resp


@router.get("/api/v1/auth/invite-link")
def claim_invite_link(code: str, response: Response) -> dict[str, Any]:
    """Validate org or learner invite link and stash code in httpOnly cookie."""
    from services.partners.service import normalize_code, resolve_invite_code

    raw = (code or "").strip()
    if not raw:
        raise HTTPException(400, "缺少邀请码")
    ic = resolve_invite_code(raw)
    kind = "org"
    if not ic:
        from services.referral.service import resolve_learner_invite_code

        ic = resolve_learner_invite_code(raw)
        kind = "learner"
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
    out: dict[str, Any] = {"valid": True, "code": normalized, "kind": kind}
    if kind == "org":
        out["org_name"] = ic.get("org_name") or ic.get("org_id")
    else:
        out["referrer_name"] = ic.get("referrer_display_name") or ic.get("referrer_email")
        from services.wechat_mp.profile import decode_wechat_text

        if out.get("referrer_name"):
            out["referrer_name"] = decode_wechat_text(str(out["referrer_name"])) or out["referrer_name"]
    return out


@router.post("/api/v1/auth/register", dependencies=[Depends(rate_limit("login"))])
def register(body: RegisterBody, request: Request, response: Response) -> dict[str, Any]:
    from services.referral.service import bind_any_invite_code

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
            bind_any_invite_code(uid, pending_invite)
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
        user, sid, new_refresh, camp_id = rotate_refresh_session(token)
    except ValueError as exc:
        _clear_cookies(response)
        raise HTTPException(401, "session_replaced") from exc
    access = create_access_token(user, camp_id, session_id=sid)
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
    from services.shared import session_is_active

    # Prefer middleware-authenticated user (includes single-session sid check).
    # Fallback decode must also enforce sid so revoked sessions cannot revive via /me.
    user = getattr(request.state, "user", None)
    if not user:
        if getattr(request.state, "session_replaced", False):
            raise HTTPException(401, "session_replaced")
        auth = request.headers.get("Authorization", "")
        token = auth[7:] if auth.startswith("Bearer ") else request.cookies.get(ACCESS_COOKIE)
        if not token:
            raise HTTPException(401, "未登录")
        try:
            payload = decode_access_token(token)
        except Exception as exc:
            raise HTTPException(401, "token 无效") from exc
        sid = payload.get("sid")
        if not session_is_active(sid if isinstance(sid, str) else None):
            raise HTTPException(401, "session_replaced")
        u = get_user_by_id(payload["sub"])
        if not u:
            raise HTTPException(401, "用户不存在")
        user = u
        camp_id = payload.get("camp_id")
    else:
        camp_id = getattr(request.state, "camp_id", None)
    from services.partners.service import get_user_attribution

    attribution = get_user_attribution(user.id)
    wx_bound = _wx_bound_for(user)
    profile_incomplete = False
    from services.auth.session_context import attach_session_context, user_can_learn

    try:
        from services.wechat_mp.profile import profile_incomplete_for_user

        if user_can_learn(user.role) and user.role not in ("author", "admin"):
            profile_incomplete = profile_incomplete_for_user(user.id, user.display_name)
    except Exception:
        profile_incomplete = False

    return attach_session_context(
        {
            "user": {"id": user.id, "email": user.email, "role": user.role, "display_name": user.display_name},
            "camp_id": camp_id,
            "camps": user_camps(user.id),
            "csrf": request.cookies.get(CSRF_COOKIE),
            "server_time": int(time.time()),
            "attribution": attribution,
            "wx_bound": wx_bound,
            "needs_wx_bind": not wx_bound,
            "profile_incomplete": profile_incomplete,
        },
        user,
    )


@router.post("/api/v1/auth/wechat/bind-start", dependencies=[Depends(rate_limit("login"))])
def wechat_bind_start(request: Request) -> dict[str, Any]:
    from services.shared.middleware import require_user
    from services.wechat_mp import bind_reset

    user = require_user(request)
    if not bind_reset.role_requires_wx_bind(user.role):
        return {"already_bound": True, "wx_bound": True}
    try:
        return bind_reset.start_bind(user.id)
    except RuntimeError as exc:
        raise HTTPException(503, str(exc)) from exc


@router.get("/api/v1/auth/wechat/bind-status")
def wechat_bind_status(ticket: str, request: Request) -> dict[str, Any]:
    from services.shared.middleware import require_user
    from services.wechat_mp import bind_reset

    require_user(request)
    if not ticket or len(ticket) > 80:
        raise HTTPException(400, "invalid ticket")
    return bind_reset.bind_status(ticket)


@router.post("/api/v1/auth/password-reset/start", dependencies=[Depends(rate_limit("login"))])
def password_reset_start(body: PasswordResetStartBody) -> dict[str, Any]:
    from services.wechat_mp import bind_reset

    email = body.email.strip().lower()
    if not email or "@" not in email:
        raise HTTPException(400, "请输入有效邮箱")
    try:
        return bind_reset.start_password_reset(email)
    except RuntimeError as exc:
        raise HTTPException(429, str(exc)) from exc


@router.get("/api/v1/auth/password-reset/status")
def password_reset_status(ticket: str) -> dict[str, Any]:
    from services.wechat_mp import bind_reset

    if not ticket or len(ticket) > 80:
        raise HTTPException(400, "invalid ticket")
    return bind_reset.reset_status(ticket)


@router.post("/api/v1/auth/password-reset/confirm", dependencies=[Depends(rate_limit("login"))])
def password_reset_confirm(body: PasswordResetConfirmBody) -> dict[str, Any]:
    from services.wechat_mp import bind_reset

    try:
        bind_reset.confirm_password_reset(body.email, body.code, body.new_password)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    write_audit("auth.password_reset", details={"email": body.email.strip().lower()})
    return {"ok": True}


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
