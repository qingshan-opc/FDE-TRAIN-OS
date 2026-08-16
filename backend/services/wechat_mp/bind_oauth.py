"""In-WeChat OAuth bind — attach current WeChat openid to the logged-in account.

Does not create users or switch the login session (unlike mp-entry).
If this openid already belongs to another user, bind is refused.
"""

from __future__ import annotations

import logging
import secrets
import time
from dataclasses import dataclass
from urllib.parse import quote, urlencode

from services.shared import db_cursor, now_iso
from services.shared.config import WECHAT_PAY_APP_ID
from services.wechat_mp import entry as mp_entry
from services.wechat_mp import login as mp_login
from services.wechat_mp import profile as mp_profile

log = logging.getLogger("fde.wechat_mp.bind_oauth")

PURPOSE = "bind"
DEFAULT_NEXT = "/app/invite"


class OpenidTaken(Exception):
    """This WeChat is already linked to a different account."""

    def __init__(self, next_path: str = DEFAULT_NEXT):
        self.next_path = next_path or DEFAULT_NEXT
        super().__init__("该微信已绑定其他账号")


@dataclass
class BindOauthResult:
    next_path: str
    already_bound: bool = False
    conflict: bool = False


def configured() -> bool:
    return mp_entry.entry_configured()


def callback_url() -> str:
    from services.shared.config import FDE_PUBLIC_BASE_URL

    return f"{FDE_PUBLIC_BASE_URL.rstrip('/')}/api/v1/auth/wechat/bind-oauth/callback"


def with_bind_flag(path: str, flag: str) -> str:
    raw = (path or "").strip() or DEFAULT_NEXT
    base = raw.split("#", 1)[0]
    sep = "&" if "?" in base else "?"
    # drop a previous wx_bind flag
    if "wx_bind=" in base:
        from urllib.parse import parse_qsl, urlencode as enc, urlsplit, urlunsplit

        parts = urlsplit(base)
        q = [(k, v) for k, v in parse_qsl(parts.query, keep_blank_values=True) if k != "wx_bind"]
        q.append(("wx_bind", flag))
        return urlunsplit((parts.scheme, parts.netloc, parts.path, enc(q), parts.fragment))
    return f"{base}{sep}wx_bind={flag}"


def _ensure_cols() -> None:
    mp_entry._ensure_next_col()  # noqa: SLF001 — shared login-state schema


def _authorize_url(state: str) -> str:
    query = urlencode(
        {
            "appid": WECHAT_PAY_APP_ID,
            "redirect_uri": callback_url(),
            "response_type": "code",
            "scope": "snsapi_userinfo",
            "state": state,
        },
        quote_via=quote,
    )
    return f"https://open.weixin.qq.com/connect/oauth2/authorize?{query}#wechat_redirect"


def create_bind_authorize_url(*, user_id: str, next_path: str = DEFAULT_NEXT, reuse_state: str | None = None) -> tuple[str, str]:
    if not configured():
        raise RuntimeError("未配置公众号 AppID/AppSecret，无法网页授权绑定")
    _ensure_cols()
    nxt = mp_entry.sanitize_next(next_path) or DEFAULT_NEXT
    uid = str(user_id or "").strip()
    if not uid:
        raise RuntimeError("缺少登录用户")
    reused = (reuse_state or "").strip()
    if reused:
        with db_cursor() as cur:
            cur.execute(
                """
                SELECT id FROM wechat_login_states
                WHERE id=? AND consumed_at IS NULL AND expires_at > NOW()
                  AND COALESCE(purpose, 'login') = ?
                  AND user_id=?
                """,
                (reused, PURPOSE, uid),
            )
            row = cur.fetchone()
            if row:
                cur.execute("UPDATE wechat_login_states SET next_path=? WHERE id=?", (nxt, reused))
                return _authorize_url(reused), reused
    state = secrets.token_urlsafe(16)
    exp = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(time.time() + mp_entry.STATE_TTL_SEC))
    with db_cursor() as cur:
        cur.execute(
            """
            INSERT INTO wechat_login_states
              (id, created_at, expires_at, status, next_path, purpose, user_id)
            VALUES (?,?,?, 'pending', ?, ?, ?)
            """,
            (state, now_iso(), exp, nxt, PURPOSE, uid),
        )
    return _authorize_url(state), state


def _other_user_with_openid(openid: str, user_id: str) -> str | None:
    with db_cursor() as cur:
        cur.execute(
            "SELECT id FROM users WHERE wx_mp_openid=? AND id<>? LIMIT 1",
            (openid, user_id),
        )
        row = cur.fetchone()
    if not row:
        return None
    return str(row["id"] if isinstance(row, dict) else row[0])


def complete_bind_oauth(code: str, state: str, *, user_id: str) -> BindOauthResult:
    """Exchange code → openid and attach it to the current logged-in user."""
    _ensure_cols()
    uid = str(user_id or "").strip()
    sid = (state or "").strip()
    if not sid or not uid:
        raise mp_entry.OauthRestart(DEFAULT_NEXT)
    with db_cursor() as cur:
        cur.execute(
            """
            SELECT id, next_path, status, expires_at, consumed_at, purpose, user_id
            FROM wechat_login_states
            WHERE id=?
            """,
            (sid,),
        )
        row = cur.fetchone()
    if not row:
        raise mp_entry.OauthRestart(DEFAULT_NEXT)
    next_path = mp_entry.sanitize_next(row.get("next_path") if isinstance(row, dict) else None) or DEFAULT_NEXT
    purpose = ((row.get("purpose") if isinstance(row, dict) else None) or "login").strip()
    if purpose != PURPOSE:
        raise mp_entry.OauthRestart(next_path)
    state_uid = str((row.get("user_id") if isinstance(row, dict) else None) or "").strip()
    if state_uid != uid:
        raise mp_entry.OauthRestart(next_path)
    consumed = row.get("consumed_at")
    if consumed:
        log.info("bind-oauth callback replay state=%s user=%s next=%s", sid[:8], uid, next_path)
        return BindOauthResult(next_path=next_path, already_bound=True)
    if mp_entry._state_expired(row.get("expires_at")):  # noqa: SLF001
        raise mp_entry.OauthRestart(next_path)
    token = mp_entry._exchange_code(code)  # noqa: SLF001
    openid = str(token.get("openid") or "").strip()
    if not openid:
        raise RuntimeError("微信未返回 openid")
    other = _other_user_with_openid(openid, uid)
    if other:
        with db_cursor() as cur:
            cur.execute(
                "UPDATE wechat_login_states SET status='done', consumed_at=? WHERE id=?",
                (now_iso(), sid),
            )
        log.warning("bind-oauth openid taken state=%s user=%s other=%s", sid[:8], uid, other)
        raise OpenidTaken(next_path)
    nickname = None
    headimgurl = None
    access_token = str(token.get("access_token") or "")
    if access_token:
        info = mp_profile.fetch_sns_userinfo(access_token, openid)
        nickname = (info.get("nickname") or "").strip() or None
        headimgurl = (info.get("headimgurl") or "").strip() or None
    mp_login.link_openid_to_user(uid, openid, nickname)
    try:
        mp_profile.apply_wechat_profile(uid, nickname=nickname, headimgurl=headimgurl)
    except Exception as exc:
        log.warning("bind-oauth profile apply failed user=%s: %s", uid, exc)
    with db_cursor() as cur:
        cur.execute(
            """
            UPDATE wechat_login_states
            SET status='done', consumed_at=?
            WHERE id=?
            """,
            (now_iso(), sid),
        )
    log.info("bind-oauth ok user=%s openid=%s…", uid, openid[:8])
    return BindOauthResult(next_path=next_path)
