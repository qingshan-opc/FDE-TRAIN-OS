"""Silent snsapi_base OAuth — capture the current WeChat openid for JSAPI pay.

Does not create users or issue login cookies. Login session stays on the
account already in the browser; the payer openid is stored in a short-lived
httpOnly cookie for checkout.
"""

from __future__ import annotations

import logging
import secrets
import time
from dataclasses import dataclass
from urllib.parse import quote, urlencode

from services.shared import db_cursor, now_iso
from services.shared.config import FDE_PUBLIC_BASE_URL, WECHAT_PAY_APP_ID
from services.wechat_mp import entry as mp_entry

log = logging.getLogger("fde.wechat_mp.jsapi_openid")

PURPOSE = "jsapi"
DEFAULT_NEXT = "/app/shop"


@dataclass
class JsapiOauthResult:
    next_path: str
    openid: str | None  # None on WeChat callback replay (cookie already set)


def configured() -> bool:
    return mp_entry.entry_configured()


def callback_url() -> str:
    return f"{FDE_PUBLIC_BASE_URL.rstrip('/')}/api/v1/auth/wechat/jsapi-openid/callback"


def with_pay_flag(path: str) -> str:
    raw = (path or "").strip() or DEFAULT_NEXT
    base = raw.split("#", 1)[0]
    if "pay=1" in base:
        return raw
    return raw + ("&" if "?" in base else "?") + "pay=1"


def _ensure_cols() -> None:
    mp_entry._ensure_next_col()  # noqa: SLF001 — shared login-state schema
    with db_cursor() as cur:
        cur.execute("ALTER TABLE wechat_login_states ADD COLUMN IF NOT EXISTS purpose TEXT")


def _authorize_url(state: str) -> str:
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


def create_jsapi_authorize_url(*, next_path: str = DEFAULT_NEXT, reuse_state: str | None = None) -> tuple[str, str]:
    if not configured():
        raise RuntimeError("未配置公众号 AppID/AppSecret，无法发起微信支付授权")
    _ensure_cols()
    nxt = mp_entry.sanitize_next(next_path) or DEFAULT_NEXT
    reused = (reuse_state or "").strip()
    if reused:
        with db_cursor() as cur:
            cur.execute(
                """
                SELECT id FROM wechat_login_states
                WHERE id=? AND consumed_at IS NULL AND expires_at > NOW()
                  AND COALESCE(purpose, 'login') = ?
                """,
                (reused, PURPOSE),
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
            INSERT INTO wechat_login_states (id, created_at, expires_at, status, next_path, purpose)
            VALUES (?,?,?, 'pending', ?, ?)
            """,
            (state, now_iso(), exp, nxt, PURPOSE),
        )
    return _authorize_url(state), state


def complete_jsapi_openid(code: str, state: str) -> JsapiOauthResult:
    """Exchange code → current WeChat openid. Never touches users / login session."""
    _ensure_cols()
    sid = (state or "").strip()
    if not sid:
        raise mp_entry.OauthRestart(DEFAULT_NEXT)
    with db_cursor() as cur:
        cur.execute(
            """
            SELECT id, next_path, status, expires_at, consumed_at, purpose
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
    consumed = row.get("consumed_at")
    if consumed:
        log.info("jsapi-openid callback replay state=%s next=%s", sid[:8], next_path)
        return JsapiOauthResult(next_path=next_path, openid=None)
    if mp_entry._state_expired(row.get("expires_at")):  # noqa: SLF001
        raise mp_entry.OauthRestart(next_path)
    token = mp_entry._exchange_code(code)  # noqa: SLF001 — same AppID token exchange
    openid = str(token.get("openid") or "").strip()
    if not openid:
        raise RuntimeError("微信未返回 openid")
    with db_cursor() as cur:
        cur.execute(
            """
            UPDATE wechat_login_states
            SET status='done', consumed_at=?
            WHERE id=?
            """,
            (now_iso(), sid),
        )
    log.info("jsapi-openid captured state=%s openid=%s…", sid[:8], openid[:8])
    return JsapiOauthResult(next_path=next_path, openid=openid)
