"""Partner WeChat OAuth — bind PERSONAL_OPENID as org profit-sharing receiver."""

from __future__ import annotations

import logging
import secrets
import time
from typing import Any
from urllib.parse import quote, urlencode

import requests

from services.billing import profit_sharing
from services.partners import service as partners
from services.shared import db_cursor, now_iso
from services.shared.config import (
    FDE_PUBLIC_BASE_URL,
    WECHAT_APP_SECRET,
    WECHAT_PAY_APP_ID,
)

log = logging.getLogger("fde.partner.wechat_bind")

STATE_TTL_SEC = 15 * 60
_states_ready = False


def oauth_configured() -> bool:
    return bool(WECHAT_PAY_APP_ID and WECHAT_APP_SECRET)


def mask_openid(openid: str | None) -> str | None:
    if not openid:
        return None
    if len(openid) <= 8:
        return openid[:2] + "****"
    return f"{openid[:4]}****{openid[-4:]}"


def receiver_status(org: dict[str, Any] | None) -> dict[str, Any]:
    org = org or {}
    account = org.get("wx_receiver_account")
    rtype = org.get("wx_receiver_type")
    bound = bool(rtype and account)
    return {
        "bound": bound,
        "wx_receiver_type": rtype,
        "wx_receiver_account_masked": mask_openid(str(account)) if account else None,
        "wx_receiver_name": org.get("wx_receiver_name"),
        "oauth_configured": oauth_configured(),
    }


def _ensure_states_table() -> None:
    global _states_ready
    if _states_ready:
        return
    with db_cursor() as cur:
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS wechat_oauth_states (
              id TEXT PRIMARY KEY,
              org_id TEXT NOT NULL,
              user_id TEXT NOT NULL,
              purpose TEXT NOT NULL DEFAULT 'wx_bind',
              created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
              expires_at TIMESTAMPTZ NOT NULL,
              consumed_at TIMESTAMPTZ
            )
            """
        )
    _states_ready = True


def _create_state(org_id: str, user_id: str) -> str:
    _ensure_states_table()
    state = secrets.token_urlsafe(16)
    exp = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(time.time() + STATE_TTL_SEC))
    with db_cursor() as cur:
        cur.execute(
            """
            INSERT INTO wechat_oauth_states (id, org_id, user_id, purpose, created_at, expires_at)
            VALUES (?,?,?,?,?,?)
            """,
            (state, org_id, user_id, "wx_bind", now_iso(), exp),
        )
        # prune old rows opportunistically
        cur.execute(
            "DELETE FROM wechat_oauth_states WHERE expires_at < NOW() - INTERVAL '1 day'"
        )
    return state


def _peek_state(state: str) -> dict[str, Any]:
    _ensure_states_table()
    with db_cursor() as cur:
        cur.execute(
            """
            SELECT id, org_id, user_id, purpose, expires_at, consumed_at
            FROM wechat_oauth_states
            WHERE id=? AND consumed_at IS NULL AND expires_at > NOW()
            """,
            (state,),
        )
        row = cur.fetchone()
    if not row:
        raise ValueError("授权 state 无效或已过期，请回到电脑端刷新二维码后重试")
    row = dict(row)
    if row.get("purpose") != "wx_bind":
        raise ValueError("授权 state 无效")
    return row


def _mark_state_consumed(state: str) -> None:
    with db_cursor() as cur:
        cur.execute(
            """
            UPDATE wechat_oauth_states SET consumed_at=?
            WHERE id=? AND consumed_at IS NULL AND expires_at > NOW()
            """,
            (now_iso(), state),
        )
        if cur.rowcount == 0:
            raise ValueError("该授权码已使用或已过期，请刷新二维码重试")


def callback_url() -> str:
    return f"{FDE_PUBLIC_BASE_URL.rstrip('/')}/api/v1/partner/wechat/callback"


def build_bind_url(org_id: str, user_id: str) -> dict[str, str]:
    if not oauth_configured():
        raise RuntimeError("未配置 WECHAT_APP_SECRET，无法扫码绑定")
    state = _create_state(org_id, user_id)
    # snsapi_base: silent openid (enough for PERSONAL_OPENID profit sharing)
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
    authorize = f"https://open.weixin.qq.com/connect/oauth2/authorize?{query}#wechat_redirect"
    return {
        "authorize_url": authorize,
        "state": state,
        "redirect_uri": callback_url(),
        "expires_in": STATE_TTL_SEC,
    }


def _exchange_code(code: str) -> dict[str, Any]:
    params = {
        "appid": WECHAT_PAY_APP_ID,
        "secret": WECHAT_APP_SECRET,
        "code": code,
        "grant_type": "authorization_code",
    }
    resp = requests.get(
        "https://api.weixin.qq.com/sns/oauth2/access_token",
        params=params,
        timeout=20,
    )
    data = resp.json() if resp.text else {}
    if data.get("errcode"):
        raise RuntimeError(f"微信换票失败: {data.get('errmsg') or data}")
    if not data.get("openid"):
        raise RuntimeError("微信未返回 openid")
    return data


def _fetch_userinfo(access_token: str, openid: str) -> dict[str, Any]:
    try:
        resp = requests.get(
            "https://api.weixin.qq.com/sns/userinfo",
            params={"access_token": access_token, "openid": openid, "lang": "zh_CN"},
            timeout=20,
        )
        data = resp.json() if resp.text else {}
        if data.get("errcode"):
            log.warning("userinfo failed: %s", data)
            return {}
        return data
    except Exception as exc:
        log.warning("userinfo request failed: %s", exc)
        return {}


def bind_poll_status(org_id: str, state: str) -> dict[str, Any]:
    """PC polls this while QR modal is open — detects phone OAuth completion."""
    _ensure_states_table()
    with db_cursor() as cur:
        cur.execute(
            """
            SELECT id, org_id, purpose, expires_at, consumed_at
            FROM wechat_oauth_states WHERE id=?
            """,
            (state,),
        )
        row = cur.fetchone()
    org = partners.get_organization(org_id)
    recv = receiver_status(org)
    if not row:
        return {"pending": False, "done": False, "expired": True, "receiver": recv}
    row = dict(row)
    if str(row.get("org_id")) != str(org_id) or row.get("purpose") != "wx_bind":
        return {"pending": False, "done": False, "expired": True, "receiver": recv}
    if row.get("consumed_at"):
        return {"pending": False, "done": True, "expired": False, "receiver": recv}
    # still waiting — check expiry
    with db_cursor() as cur:
        cur.execute(
            "SELECT 1 AS ok FROM wechat_oauth_states WHERE id=? AND expires_at > NOW()",
            (state,),
        )
        alive = cur.fetchone()
    if not alive:
        return {"pending": False, "done": False, "expired": True, "receiver": recv}
    return {"pending": True, "done": False, "expired": False, "receiver": recv}


def complete_bind(code: str, state: str) -> dict[str, Any]:
    """Exchange OAuth code and persist PERSONAL_OPENID on the org."""
    st = _peek_state(state)
    org_id = str(st["org_id"])
    token = _exchange_code(code)
    openid = str(token["openid"])
    nickname = None
    # snsapi_base usually has no userinfo scope; try only if scope allows
    scope = str(token.get("scope") or "")
    if token.get("access_token") and "snsapi_userinfo" in scope:
        info = _fetch_userinfo(str(token["access_token"]), openid)
        nickname = info.get("nickname")
    org = partners.update_organization(
        org_id,
        {
            "wx_receiver_type": "PERSONAL_OPENID",
            "wx_receiver_account": openid,
            "wx_receiver_name": (nickname or "分销收款")[:32],
        },
    )
    # Same openid also becomes login identity for the partner user who initiated bind
    bind_user_id = st.get("user_id")
    if bind_user_id:
        try:
            from services.wechat_mp import login as mp_login

            mp_login.link_openid_to_user(str(bind_user_id), openid, nickname)
        except Exception as exc:
            log.warning("link wx login openid after bind failed: %s", exc)
    # Mark consumed only after org is updated so PC poll doesn't false-success
    _mark_state_consumed(state)
    try:
        profit_sharing._ensure_receiver(org)
    except Exception as exc:
        log.warning("ensure receiver after bind failed: %s", exc)
    try:
        profit_sharing.retry_pending_shares(limit=50)
    except Exception as exc:
        log.warning("retry pending shares after bind: %s", exc)
    return {
        "org_id": org_id,
        "receiver": receiver_status(org),
    }
