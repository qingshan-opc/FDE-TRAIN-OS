"""WeChat MP menu / in-WeChat OAuth entry — snsapi_userinfo → session cookies + profile enrich."""

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
from services.wechat_mp import profile as mp_profile

log = logging.getLogger("fde.wechat_mp.entry")

STATE_TTL_SEC = 15 * 60
ALLOWED_NEXT_PREFIXES = ("/app/", "/partner", "/author", "/open", "/verify")
# Poster QR is a static mp-entry URL. WeChat often reloads the callback after
# a successful scan; treat that as replay instead of "expired".
DEFAULT_SCAN_NEXT = "/app/shop"


class OauthRestart(Exception):
    """State missing/expired — caller should start a fresh WeChat authorize."""

    def __init__(self, next_path: str):
        self.next_path = sanitize_next(next_path) or DEFAULT_SCAN_NEXT
        super().__init__("请重新扫码进入")


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
        cur.execute("ALTER TABLE wechat_login_states ADD COLUMN IF NOT EXISTS purpose TEXT")


def _authorize_url(state: str) -> str:
    query = urlencode(
        {
            "appid": WECHAT_PAY_APP_ID,
            "redirect_uri": callback_url(),
            "response_type": "code",
            # 拉取昵称/头像（用户会看到授权页）；失败时仍可用 openid 登录
            "scope": "snsapi_userinfo",
            "state": state,
        },
        quote_via=quote,
    )
    return f"https://open.weixin.qq.com/connect/oauth2/authorize?{query}#wechat_redirect"


def _state_expired(expires_at: Any) -> bool:
    if expires_at is None:
        return True
    if hasattr(expires_at, "timestamp"):
        return float(expires_at.timestamp()) <= time.time()
    return False


def create_oauth_authorize_url(*, next_path: str = "/app/courses", reuse_state: str | None = None) -> tuple[str, str]:
    """Return (WeChat authorize URL, state id). Reuse a still-pending state when WeChat double-GETs the poster URL."""
    if not entry_configured():
        raise RuntimeError("未配置公众号 AppID/AppSecret，无法网页授权登录")
    _ensure_next_col()
    nxt = sanitize_next(next_path)
    reused = (reuse_state or "").strip()
    if reused:
        with db_cursor() as cur:
            cur.execute(
                """
                SELECT id FROM wechat_login_states
                WHERE id=? AND consumed_at IS NULL AND expires_at > NOW()
                  AND COALESCE(purpose, 'login') = 'login'
                """,
                (reused,),
            )
            row = cur.fetchone()
            if row:
                cur.execute("UPDATE wechat_login_states SET next_path=? WHERE id=?", (nxt, reused))
                return _authorize_url(reused), reused
    state = secrets.token_urlsafe(16)
    exp = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(time.time() + STATE_TTL_SEC))
    with db_cursor() as cur:
        cur.execute(
            """
            INSERT INTO wechat_login_states (id, created_at, expires_at, status, next_path, purpose)
            VALUES (?,?,?, 'pending', ?, 'login')
            """,
            (state, now_iso(), exp, nxt),
        )
    return _authorize_url(state), state


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
    """Exchange OAuth code → AuthUser + next_path; best-effort profile enrich.

    WeChat in-app browser commonly reloads the callback URL after a successful
    poster scan. A consumed state is replayed (re-issue session) instead of
    showing 「授权已过期」.
    """
    from services.shared import get_user_by_id

    _ensure_next_col()
    sid = (state or "").strip()
    if not sid:
        raise OauthRestart(DEFAULT_SCAN_NEXT)
    with db_cursor() as cur:
        cur.execute(
            """
            SELECT id, next_path, status, expires_at, consumed_at, user_id, purpose
            FROM wechat_login_states
            WHERE id=?
            """,
            (sid,),
        )
        row = cur.fetchone()
    if not row:
        raise OauthRestart(DEFAULT_SCAN_NEXT)
    next_path = sanitize_next(row.get("next_path") if isinstance(row, dict) else None)
    purpose = ((row.get("purpose") if isinstance(row, dict) else None) or "login").strip()
    if purpose in ("jsapi", "bind"):
        raise OauthRestart(next_path or DEFAULT_SCAN_NEXT)
    consumed = row.get("consumed_at")
    uid = str(row.get("user_id") or "").strip()
    if consumed and uid:
        user = get_user_by_id(uid)
        if user:
            log.info("mp-entry callback replay state=%s user=%s next=%s", sid[:8], uid, next_path)
            return user, next_path
        raise OauthRestart(next_path)
    if consumed or _state_expired(row.get("expires_at")):
        raise OauthRestart(next_path)
    token = _exchange_code(code)
    openid = str(token["openid"])
    nickname = None
    headimgurl = None
    access_token = str(token.get("access_token") or "")
    if access_token:
        info = mp_profile.fetch_sns_userinfo(access_token, openid)
        nickname = (info.get("nickname") or "").strip() or None
        headimgurl = (info.get("headimgurl") or "").strip() or None
    user = mp_login.resolve_or_create_user(openid, nickname)
    try:
        mp_profile.apply_wechat_profile(user.id, nickname=nickname, headimgurl=headimgurl)
        with db_cursor() as cur:
            cur.execute("SELECT display_name FROM users WHERE id=?", (user.id,))
            urow = cur.fetchone()
        if urow and urow.get("display_name"):
            from services.shared import AuthUser

            user = AuthUser(
                id=user.id,
                email=user.email,
                role=user.role,
                display_name=urow.get("display_name"),
            )
    except Exception as exc:
        log.warning("apply wechat profile failed user=%s: %s", user.id, exc)
    with db_cursor() as cur:
        cur.execute(
            """
            UPDATE wechat_login_states
            SET user_id=?, status='done', consumed_at=?
            WHERE id=?
            """,
            (user.id, now_iso(), state),
        )
    if user.role == "partner" and next_path.startswith("/author"):
        from services.auth.session_context import build_session_context

        next_path = build_session_context(user)["default_home"]
    elif user.role == "finance" and next_path.startswith("/app/"):
        next_path = "/author/finance"
    elif user.role in ("author", "admin") and next_path.startswith("/app/"):
        # Staff may visit /app; keep next. Only rewrite clearly wrong partner-only paths — none.
        pass
    return user, next_path


def menu_entry_url(next_path: str = "/app/courses") -> str:
    """Public URL to paste into 公众号自定义菜单."""
    nxt = sanitize_next(next_path)
    return f"{FDE_PUBLIC_BASE_URL.rstrip('/')}/api/v1/auth/wechat/mp-entry?next={quote(nxt, safe='')}"
