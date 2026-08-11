"""WeChat MP menu / in-WeChat OAuth entry — silent snsapi_base → session cookies."""

from __future__ import annotations

import logging
import secrets
import time
from typing import Any
from urllib.parse import quote, urlencode

import requests

from services.shared import db_cursor, now_iso
from services.shared.config import FDE_PUBLIC_BASE_URL, WECHAT_APP_SECRET, WECHAT_PAY_APP_ID
from services.wechat_mp import login as mp_login

log = logging.getLogger("fde.wechat_mp.entry")

STATE_TTL_SEC = 15 * 60
ALLOWED_NEXT_PREFIXES = ("/app/", "/partner", "/author", "/open", "/verify")


def entry_configured() -> bool:
    return bool(WECHAT_PAY_APP_ID and WECHAT_APP_SECRET)


def sanitize_next(raw: str | None) -> str:
    path = (raw or "").strip() or "/app/courses"
    if not path.startswith("/") or path.startswith("//"):
        return "/app/courses"
    if "://" in path or "\\" in path:
        return "/app/courses"
    if path == "/partner" or path.startswith("/partner?") or path.startswith("/partner/"):
        return path.split("#")[0][:200]
    if path == "/author" or path.startswith("/author?") or path.startswith("/author/"):
        return path.split("#")[0][:200]
    if any(path == p.rstrip("/") or path.startswith(p) for p in ALLOWED_NEXT_PREFIXES):
        return path.split("#")[0][:200]
    return "/app/courses"


def callback_url() -> str:
    return f"{FDE_PUBLIC_BASE_URL.rstrip('/')}/api/v1/auth/wechat/mp-entry/callback"


def _ensure_next_col() -> None:
    mp_login._ensure_schema()  # noqa: SLF001 — shared login schema
    with db_cursor() as cur:
        cur.execute("ALTER TABLE wechat_login_states ADD COLUMN IF NOT EXISTS next_path TEXT")


def create_oauth_authorize_url(*, next_path: str = "/app/courses") -> str:
    if not entry_configured():
        raise RuntimeError("未配置公众号 AppID/AppSecret，无法网页授权登录")
    _ensure_next_col()
    state = secrets.token_urlsafe(16)
    nxt = sanitize_next(next_path)
    exp = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(time.time() + STATE_TTL_SEC))
    with db_cursor() as cur:
        cur.execute(
            """
            INSERT INTO wechat_login_states (id, created_at, expires_at, status, next_path)
            VALUES (?,?,?, 'pending', ?)
            """,
            (state, now_iso(), exp, nxt),
        )
    query = urlencode(
        {
            "appid": WECHAT_PAY_APP_ID,
            "redirect_uri": callback_url(),
            "response_type": "code",
            "scope": "snsapi_base",
            "state": state,
        },
        quote_via=quote,
    )
    return f"https://open.weixin.qq.com/connect/oauth2/authorize?{query}#wechat_redirect"


def _exchange_code(code: str) -> dict[str, Any]:
    resp = requests.get(
        "https://api.weixin.qq.com/sns/oauth2/access_token",
        params={
            "appid": WECHAT_PAY_APP_ID,
            "secret": WECHAT_APP_SECRET,
            "code": code,
            "grant_type": "authorization_code",
        },
        timeout=20,
    )
    data = resp.json() if resp.text else {}
    if data.get("errcode") or not data.get("openid"):
        raise RuntimeError(f"微信授权失败: {data.get('errmsg') or data}")
    return data


def complete_oauth_entry(code: str, state: str) -> tuple[Any, str]:
    """Exchange OAuth code → AuthUser + next_path."""
    _ensure_next_col()
    with db_cursor() as cur:
        cur.execute(
            """
            SELECT id, next_path, status, expires_at, consumed_at
            FROM wechat_login_states
            WHERE id=? AND expires_at > NOW() AND consumed_at IS NULL
            """,
            (state,),
        )
        row = cur.fetchone()
    if not row:
        raise ValueError("授权已过期，请从公众号菜单重新进入")
    next_path = sanitize_next(row.get("next_path") if isinstance(row, dict) else None)
    token = _exchange_code(code)
    openid = str(token["openid"])
    user = mp_login.resolve_or_create_user(openid)
    with db_cursor() as cur:
        cur.execute(
            """
            UPDATE wechat_login_states
            SET user_id=?, status='done', consumed_at=?
            WHERE id=?
            """,
            (user.id, now_iso(), state),
        )
    # Role-aware default landing
    if user.role == "partner" and next_path.startswith("/app/"):
        next_path = "/partner"
    elif user.role == "finance" and next_path.startswith("/app/"):
        next_path = "/author/finance"
    elif user.role in ("author", "admin") and next_path.startswith("/app/"):
        next_path = "/author"
    return user, next_path


def menu_entry_url(next_path: str = "/app/courses") -> str:
    """Public URL to paste into 公众号自定义菜单."""
    nxt = sanitize_next(next_path)
    return f"{FDE_PUBLIC_BASE_URL.rstrip('/')}/api/v1/auth/wechat/mp-entry?next={quote(nxt, safe='')}"
