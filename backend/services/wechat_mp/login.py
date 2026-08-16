"""WeChat MP scan-follow login — state machine + user resolution."""

from __future__ import annotations

import logging
import secrets
import time
import xml.etree.ElementTree as ET
from typing import Any
from uuid import uuid4

from services.shared import AuthUser, db_cursor, now_iso
from services.shared.config import WECHAT_MP_TOKEN
from services.wechat_mp import client as mp_client
from services.wechat_mp import crypto as mp_crypto

log = logging.getLogger("fde.wechat_mp.login")

STATE_TTL_SEC = 10 * 60
_schema_ready = False


def login_configured() -> bool:
    return bool(mp_client.mp_configured() and WECHAT_MP_TOKEN)


def _ensure_schema() -> None:
    global _schema_ready
    if _schema_ready:
        return
    with db_cursor() as cur:
        cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS wx_mp_openid TEXT")
        cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS wx_nickname TEXT")
        cur.execute(
            """
            CREATE UNIQUE INDEX IF NOT EXISTS idx_users_wx_mp_openid
              ON users (wx_mp_openid) WHERE wx_mp_openid IS NOT NULL
            """
        )
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS wechat_login_states (
              id TEXT PRIMARY KEY,
              created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
              expires_at TIMESTAMPTZ NOT NULL,
              consumed_at TIMESTAMPTZ,
              user_id TEXT,
              ticket TEXT,
              status TEXT NOT NULL DEFAULT 'pending'
            )
            """
        )
    _schema_ready = True


def create_login_qr() -> dict[str, Any]:
    if not login_configured():
        raise RuntimeError("未配置公众号扫码登录（需要 WECHAT_MP_TOKEN + AppID/Secret）")
    _ensure_schema()
    state = secrets.token_urlsafe(16)
    exp = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(time.time() + STATE_TTL_SEC))
    qr = mp_client.create_temp_qr(state, expire_seconds=STATE_TTL_SEC)
    with db_cursor() as cur:
        cur.execute(
            """
            INSERT INTO wechat_login_states (id, created_at, expires_at, ticket, status)
            VALUES (?,?,?,?, 'pending')
            """,
            (state, now_iso(), exp, qr.get("ticket")),
        )
        cur.execute(
            "DELETE FROM wechat_login_states WHERE expires_at < NOW() - INTERVAL '1 day'"
        )
    return {
        "state": state,
        # `url` is the raw weixin scene content — encode as QR on the client
        "qr_content": qr.get("url") or qr["qr_url"],
        # ticket image (can also be shown as <img src=...>)
        "qr_url": qr["qr_url"],
        "expire_seconds": qr.get("expire_seconds") or STATE_TTL_SEC,
        "configured": True,
    }


def poll_login_status(state: str) -> dict[str, Any]:
    _ensure_schema()
    with db_cursor() as cur:
        cur.execute(
            """
            SELECT id, user_id, status, expires_at, consumed_at
            FROM wechat_login_states WHERE id=?
            """,
            (state,),
        )
        row = cur.fetchone()
    if not row:
        return {"pending": False, "done": False, "expired": True}
    row = dict(row)
    if row.get("status") == "done" and row.get("user_id"):
        return {
            "pending": False,
            "done": True,
            "expired": False,
            "user_id": row["user_id"],
        }
    with db_cursor() as cur:
        cur.execute(
            "SELECT 1 AS ok FROM wechat_login_states WHERE id=? AND expires_at > NOW()",
            (state,),
        )
        alive = cur.fetchone()
    if not alive:
        return {"pending": False, "done": False, "expired": True}
    return {"pending": True, "done": False, "expired": False}


def consume_login_user(state: str) -> AuthUser | None:
    """Return AuthUser for a completed scan; mark consumed for PC cookie issue."""
    _ensure_schema()
    with db_cursor() as cur:
        cur.execute(
            """
            SELECT user_id FROM wechat_login_states
            WHERE id=? AND status='done' AND user_id IS NOT NULL
              AND expires_at > NOW()
              AND (consumed_at IS NULL OR consumed_at > NOW() - INTERVAL '30 seconds')
            """,
            (state,),
        )
        row = cur.fetchone()
        if not row:
            return None
        uid = row["user_id"]
        cur.execute(
            """
            UPDATE wechat_login_states SET consumed_at=?
            WHERE id=? AND consumed_at IS NULL
            """,
            (now_iso(), state),
        )
        cur.execute(
            "SELECT id, email, role, display_name FROM users WHERE id=?",
            (uid,),
        )
        u = cur.fetchone()
    if not u:
        return None
    return AuthUser(
        id=u["id"],
        email=u["email"],
        role=u["role"],
        display_name=u.get("display_name"),
    )


def link_openid_to_user(user_id: str, openid: str, nickname: str | None = None) -> None:
    _ensure_schema()
    with db_cursor() as cur:
        # clear conflict on other users
        cur.execute(
            "UPDATE users SET wx_mp_openid=NULL WHERE wx_mp_openid=? AND id<>?",
            (openid, user_id),
        )
        if nickname:
            cur.execute(
                "UPDATE users SET wx_mp_openid=?, wx_nickname=? WHERE id=?",
                (openid, nickname[:64], user_id),
            )
        else:
            cur.execute(
                "UPDATE users SET wx_mp_openid=? WHERE id=?",
                (openid, user_id),
            )


def _find_partner_user_by_openid(openid: str) -> dict[str, Any] | None:
    """Match org receiver openid → partner user via org_accounts."""
    with db_cursor() as cur:
        cur.execute(
            """
            SELECT u.id, u.email, u.role, u.display_name, o.id AS org_id
            FROM organizations o
            JOIN org_accounts oa ON oa.org_id = o.id AND oa.status='active'
            JOIN users u ON LOWER(u.email) = LOWER(oa.email)
            WHERE o.wx_receiver_account=? AND o.wx_receiver_type='PERSONAL_OPENID'
            ORDER BY oa.created_at ASC NULLS LAST
            LIMIT 1
            """,
            (openid,),
        )
        row = cur.fetchone()
        return dict(row) if row else None


def resolve_or_create_user(openid: str, nickname: str | None = None) -> AuthUser:
    from services.wechat_mp.profile import decode_wechat_text, is_placeholder_display_name

    nickname = decode_wechat_text(nickname) or None

    _ensure_schema()
    with db_cursor() as cur:
        cur.execute(
            "SELECT id, email, role, display_name FROM users WHERE wx_mp_openid=?",
            (openid,),
        )
        row = cur.fetchone()
        if row:
            row = dict(row)
            repaired_name = decode_wechat_text(row.get("display_name"))
            if repaired_name and repaired_name != (row.get("display_name") or "").strip():
                cur.execute(
                    "UPDATE users SET display_name=? WHERE id=?",
                    (repaired_name[:64], row["id"]),
                )
                row["display_name"] = repaired_name[:64]
            if nickname and is_placeholder_display_name(row.get("display_name")):
                cur.execute(
                    "UPDATE users SET display_name=?, wx_nickname=? WHERE id=?",
                    (nickname[:64], nickname[:64], row["id"]),
                )
                row["display_name"] = nickname[:64]
            elif nickname:
                cur.execute(
                    "UPDATE users SET wx_nickname=? WHERE id=?",
                    (nickname[:64], row["id"]),
                )
            return AuthUser(
                id=row["id"],
                email=row["email"],
                role=row["role"],
                display_name=row.get("display_name") or nickname,
            )

    partner = _find_partner_user_by_openid(openid)
    if partner:
        link_openid_to_user(partner["id"], openid, nickname)
        return AuthUser(
            id=partner["id"],
            email=partner["email"],
            role=partner.get("role") or "partner",
            display_name=partner.get("display_name") or nickname,
        )

    # New learner stub (password unusable)
    from services.shared import _hash_password

    uid = str(uuid4())
    email = f"wx_{openid[-16:]}@wechat.fde.local".lower()
    display = (nickname or "微信用户")[:64]
    pwd = _hash_password(secrets.token_urlsafe(32))
    with db_cursor() as cur:
        # ensure email unique
        cur.execute("SELECT id FROM users WHERE email=?", (email,))
        if cur.fetchone():
            email = f"wx_{uid[:8]}@wechat.fde.local"
        cur.execute(
            """
            INSERT INTO users (id, email, password_hash, display_name, role, created_at, wx_mp_openid, wx_nickname)
            VALUES (?,?,?,?, 'learner', ?, ?, ?)
            """,
            (uid, email, pwd, display, now_iso(), openid, (nickname or "")[:64] or None),
        )
    return AuthUser(id=uid, email=email, role="learner", display_name=display)


def complete_scan_login(scene: str, openid: str) -> AuthUser | None:
    """Bind openid to login state when user scans / follows via QR."""
    scene = (scene or "").strip()
    if scene.startswith("qrscene_"):
        scene = scene[len("qrscene_") :]
    if not scene or not openid:
        return None
    _ensure_schema()
    with db_cursor() as cur:
        cur.execute(
            """
            SELECT id, status, user_id FROM wechat_login_states
            WHERE id=? AND expires_at > NOW()
            """,
            (scene,),
        )
        st = cur.fetchone()
    if not st:
        log.info("login scan ignored: unknown/expired scene=%s", scene)
        return None
    user = resolve_or_create_user(openid)
    with db_cursor() as cur:
        cur.execute(
            """
            UPDATE wechat_login_states
            SET user_id=?, status='done'
            WHERE id=? AND expires_at > NOW()
            """,
            (user.id, scene),
        )
    log.info("login scan ok scene=%s user=%s role=%s", scene, user.id, user.role)
    return user


def parse_xml(xml_text: str) -> dict[str, str]:
    root = ET.fromstring(xml_text)
    out: dict[str, str] = {}
    for child in root:
        out[child.tag] = (child.text or "").strip()
    return out


def handle_mp_xml(xml_text: str) -> str | None:
    """
    Process inbound MP message/event XML.
    Returns plain-text reply body (or None for silent success).
    """
    msg = parse_xml(xml_text)
    msg_type = msg.get("MsgType", "")
    if msg_type != "event":
        return None
    event = (msg.get("Event") or "").lower()
    openid = msg.get("FromUserName") or ""
    event_key = msg.get("EventKey") or ""
    if event in ("subscribe", "scan"):
        from services.wechat_mp import bind_reset

        bind_reply = bind_reset.handle_bind_or_reset_scan(event_key, openid)
        if bind_reply is not None:
            return bind_reply
        user = complete_scan_login(event_key, openid)
        if user:
            if user.role == "partner":
                return "机构账号登录成功，请回到电脑端继续。"
            return "登录成功，请回到电脑端继续。"
        if event == "subscribe":
            return "欢迎关注灵栖智能。请从网站重新扫码登录。"
        return "二维码已过期，请回到电脑端刷新后重试。"
    return None


def wrap_text_reply(*, to_openid: str, from_gh: str, content: str) -> str:
    ts = int(time.time())
    # escape minimal XML
    safe = (
        content.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )
    return (
        f"<xml>"
        f"<ToUserName><![CDATA[{to_openid}]]></ToUserName>"
        f"<FromUserName><![CDATA[{from_gh}]]></FromUserName>"
        f"<CreateTime>{ts}</CreateTime>"
        f"<MsgType><![CDATA[text]]></MsgType>"
        f"<Content><![CDATA[{safe}]]></Content>"
        f"</xml>"
    )


def extract_inbound_xml(raw_body: bytes, *, msg_signature: str, timestamp: str, nonce: str) -> str:
    """Plain or encrypted POST body → XML string."""
    text = raw_body.decode("utf-8", errors="replace").strip()
    if not text:
        raise ValueError("empty body")
    # Encrypted envelope
    if "<Encrypt>" in text:
        env = parse_xml(text)
        encrypt = env.get("Encrypt") or ""
        if not encrypt:
            raise ValueError("missing Encrypt")
        # optional msg_signature check
        if msg_signature and WECHAT_MP_TOKEN:
            parts = sorted([WECHAT_MP_TOKEN, timestamp, nonce, encrypt])
            import hashlib

            dig = hashlib.sha1("".join(parts).encode("utf-8")).hexdigest()
            if dig != msg_signature:
                raise ValueError("msg_signature mismatch")
        return mp_crypto.decrypt_message(encrypt)
    return text
