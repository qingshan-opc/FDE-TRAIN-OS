"""Shared auth cookie names and helpers — avoid drift across auth/partner/middleware."""

from __future__ import annotations

from fastapi import Response

from services.shared.config import FDE_ENV, JWT_TTL_SEC, REFRESH_TTL_SEC

ACCESS_COOKIE = "fde_token"
REFRESH_COOKIE = "fde_refresh"
CSRF_COOKIE = "fde_csrf"
CSRF_HEADER = "X-CSRF-Token"
INVITE_PENDING_COOKIE = "fde_invite_pending"
INVITE_PENDING_MAX_AGE = 1800
MP_OAUTH_STATE_COOKIE = "fde_mp_oauth_state"
# Current-WeChat openid for JSAPI pay — must NOT switch the login session.
JSAPI_OPENID_COOKIE = "fde_wx_jsapi_openid"
JSAPI_OAUTH_STATE_COOKIE = "fde_wx_jsapi_state"
JSAPI_OPENID_MAX_AGE = 30 * 60
BIND_OAUTH_STATE_COOKIE = "fde_wx_bind_state"


def auth_cookie_secure() -> bool:
    """Secure cookies require HTTPS. Set FDE_COOKIE_SECURE=0 for LAN HTTP deploys."""
    import os

    raw = os.getenv("FDE_COOKIE_SECURE")
    if raw is not None:
        return raw.strip() == "1"
    return FDE_ENV == "prod"


def set_auth_cookies(
    resp: Response,
    access: str,
    refresh: str,
    csrf: str,
    *,
    refresh_max_age: int | None = None,
) -> None:
    refresh_age = int(refresh_max_age if refresh_max_age is not None else REFRESH_TTL_SEC)
    common = {"httponly": True, "samesite": "lax", "secure": auth_cookie_secure(), "path": "/"}
    resp.set_cookie(ACCESS_COOKIE, access, max_age=JWT_TTL_SEC, **common)
    resp.set_cookie(REFRESH_COOKIE, refresh, max_age=refresh_age, **common)
    resp.set_cookie(
        CSRF_COOKIE,
        csrf,
        httponly=False,
        samesite="lax",
        secure=auth_cookie_secure(),
        path="/",
        max_age=refresh_age,
    )


def clear_auth_cookies(resp: Response) -> None:
    for name in (
        ACCESS_COOKIE,
        REFRESH_COOKIE,
        CSRF_COOKIE,
        JSAPI_OPENID_COOKIE,
        JSAPI_OAUTH_STATE_COOKIE,
        BIND_OAUTH_STATE_COOKIE,
    ):
        resp.delete_cookie(name, path="/")
