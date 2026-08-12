"""WeChat OA bind (email accounts) + password-reset OTP via scan passive reply."""

from __future__ import annotations

import logging
import secrets
from typing import Any
from uuid import uuid4

from services.shared import db_cursor, now_iso
from services.shared.seed import hash_password, verify_password
from services.wechat_mp import client as mp_client
from services.wechat_mp.login import link_openid_to_user

log = logging.getLogger("fde.wechat_mp.bind_reset")

BIND_PREFIX = "bind_"
RESET_PREFIX = "pwr_"
CODE_TTL_SEC = 300
QR_TTL_SEC = 600
MAX_CODE_ATTEMPTS = 5
_schema_ready = False


def _ensure_schema() -> None:
    global _schema_ready
    if _schema_ready:
        return
    with db_cursor() as cur:
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS wechat_bind_challenges (
              id TEXT PRIMARY KEY,
              scene TEXT NOT NULL UNIQUE,
              user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              status TEXT NOT NULL DEFAULT 'pending_scan',
              openid TEXT,
              expires_at TIMESTAMPTZ NOT NULL,
              created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
              bound_at TIMESTAMPTZ
            )
            """
        )
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS password_reset_challenges (
              id TEXT PRIMARY KEY,
              email TEXT NOT NULL,
              scene TEXT NOT NULL UNIQUE,
              user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
              code_hash TEXT,
              status TEXT NOT NULL DEFAULT 'pending_scan',
              openid TEXT,
              attempts INT NOT NULL DEFAULT 0,
              expires_at TIMESTAMPTZ NOT NULL,
              created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
              used_at TIMESTAMPTZ
            )
            """
        )
    _schema_ready = True


def _scene_strip(event_key: str) -> str:
    scene = (event_key or "").strip()
    if scene.startswith("qrscene_"):
        scene = scene[len("qrscene_") :]
    return scene


def user_has_wx_openid(user_id: str) -> bool:
    with db_cursor() as cur:
        cur.execute("SELECT wx_mp_openid FROM users WHERE id=?", (user_id,))
        row = cur.fetchone()
        return bool(row and (row.get("wx_mp_openid") or "").strip())


def get_user_wx_openid(user_id: str) -> str | None:
    with db_cursor() as cur:
        cur.execute("SELECT wx_mp_openid FROM users WHERE id=?", (user_id,))
        row = cur.fetchone()
        val = (row.get("wx_mp_openid") if row else None) or ""
        return val.strip() or None


def role_requires_wx_bind(role: str) -> bool:
    """Learners and partner-as-learners must bind OA; staff portals are exempt.

    Local/dev can set FDE_REQUIRE_WX_BIND=0 (the default outside prod) to skip
    the gate when WeChat MP credentials are unavailable.
    """
    from services.shared.config import REQUIRE_WX_BIND

    if not REQUIRE_WX_BIND:
        return False
    return role in ("learner", "partner")


# ---------- bind ----------


def start_bind(user_id: str) -> dict[str, Any]:
    _ensure_schema()
    if user_has_wx_openid(user_id):
        return {"already_bound": True, "wx_bound": True}
    scene = f"{BIND_PREFIX}{secrets.token_urlsafe(18)}"[:64]
    cid = str(uuid4())
    qr = mp_client.create_temp_qr(scene, expire_seconds=QR_TTL_SEC)
    with db_cursor() as cur:
        cur.execute(
            """
            INSERT INTO wechat_bind_challenges (id, scene, user_id, status, expires_at, created_at)
            VALUES (?,?,?,'pending_scan', NOW() + ((?)::text || ' seconds')::interval, ?)
            """,
            (cid, scene, user_id, str(QR_TTL_SEC), now_iso()),
        )
    return {
        "already_bound": False,
        "wx_bound": False,
        "ticket": cid,
        "state": scene,
        "qr_content": qr.get("url") or scene,
        "qr_url": qr["qr_url"],
        "expire_seconds": int(qr.get("expire_seconds") or QR_TTL_SEC),
    }


def bind_status(ticket: str) -> dict[str, Any]:
    _ensure_schema()
    with db_cursor() as cur:
        cur.execute(
            """
            SELECT status, expires_at < NOW() AS expired
            FROM wechat_bind_challenges WHERE id=?
            """,
            (ticket,),
        )
        row = cur.fetchone()
    if not row:
        return {"pending": False, "done": False, "expired": True}
    if row.get("expired") and row["status"] != "bound":
        return {"pending": False, "done": False, "expired": True}
    if row["status"] == "bound":
        return {"pending": False, "done": True, "expired": False, "wx_bound": True}
    return {"pending": True, "done": False, "expired": False}


def complete_bind_scan(scene: str, openid: str) -> str | None:
    """Handle bind_ QR scan. Returns WeChat reply text or None if not a bind scene."""
    scene = _scene_strip(scene)
    if not scene.startswith(BIND_PREFIX) or not openid:
        return None
    _ensure_schema()
    with db_cursor() as cur:
        cur.execute(
            """
            SELECT id, user_id, status FROM wechat_bind_challenges
            WHERE scene=? AND expires_at > NOW()
            """,
            (scene,),
        )
        st = cur.fetchone()
    if not st:
        return "绑定二维码已过期，请回到网页刷新后重试。"
    if st["status"] == "bound":
        return "微信已绑定成功，请回到电脑端继续。"

    user_id = st["user_id"]
    with db_cursor() as cur:
        cur.execute("SELECT id, wx_mp_openid FROM users WHERE wx_mp_openid=?", (openid,))
        occupied = cur.fetchone()
        if occupied and occupied["id"] != user_id:
            return "该微信已绑定其他账号，请使用未绑定的微信扫码，或联系管理员。"
        cur.execute("SELECT wx_mp_openid FROM users WHERE id=?", (user_id,))
        me = cur.fetchone()
        if me and me.get("wx_mp_openid") and me["wx_mp_openid"] != openid:
            return "该账号已绑定其他微信，如需更换请联系管理员。"

    link_openid_to_user(user_id, openid)
    with db_cursor() as cur:
        cur.execute(
            """
            UPDATE wechat_bind_challenges
            SET status='bound', openid=?, bound_at=NOW()
            WHERE id=?
            """,
            (openid, st["id"]),
        )
    log.info("wechat bind ok user=%s openid=%s…", user_id, openid[:8])
    return "微信绑定成功，请回到电脑端继续。"


# ---------- password reset ----------


def _rate_limited_reset(email: str) -> bool:
    """True if too many recent start attempts."""
    with db_cursor() as cur:
        cur.execute(
            """
            SELECT COUNT(*) AS c FROM password_reset_challenges
            WHERE email=? AND created_at > NOW() - INTERVAL '1 minute'
            """,
            (email,),
        )
        if int(cur.fetchone()["c"] or 0) >= 1:
            return True
        cur.execute(
            """
            SELECT COUNT(*) AS c FROM password_reset_challenges
            WHERE email=? AND created_at > NOW() - INTERVAL '1 hour'
            """,
            (email,),
        )
        if int(cur.fetchone()["c"] or 0) >= 5:
            return True
    return False


def start_password_reset(email: str) -> dict[str, Any]:
    """Always returns QR-shaped payload; scan reply carries real errors."""
    _ensure_schema()
    email = email.strip().lower()
    if _rate_limited_reset(email):
        raise RuntimeError("请求过于频繁，请稍后再试")

    scene = f"{RESET_PREFIX}{secrets.token_urlsafe(18)}"[:64]
    cid = str(uuid4())
    qr = mp_client.create_temp_qr(scene, expire_seconds=QR_TTL_SEC)
    user_id = None
    with db_cursor() as cur:
        cur.execute("SELECT id, wx_mp_openid FROM users WHERE email=?", (email,))
        row = cur.fetchone()
        if row:
            user_id = row["id"]
        cur.execute(
            """
            INSERT INTO password_reset_challenges
              (id, email, scene, user_id, status, expires_at, created_at)
            VALUES (?,?,?,?,'pending_scan', NOW() + ((?)::text || ' seconds')::interval, ?)
            """,
            (cid, email, scene, user_id, str(QR_TTL_SEC), now_iso()),
        )
    return {
        "ticket": cid,
        "state": scene,
        "qr_content": qr.get("url") or scene,
        "qr_url": qr["qr_url"],
        "expire_seconds": int(qr.get("expire_seconds") or QR_TTL_SEC),
        "hint": "若账号有效且已绑定微信，请用该微信扫码，验证码将发送到服务号。",
    }


def reset_status(ticket: str) -> dict[str, Any]:
    _ensure_schema()
    with db_cursor() as cur:
        cur.execute(
            """
            SELECT status, expires_at < NOW() AS expired
            FROM password_reset_challenges WHERE id=?
            """,
            (ticket,),
        )
        row = cur.fetchone()
    if not row:
        return {"pending": False, "code_sent": False, "expired": True}
    if row.get("expired") and row["status"] not in ("code_sent", "used"):
        return {"pending": False, "code_sent": False, "expired": True}
    if row["status"] == "code_sent":
        return {"pending": False, "code_sent": True, "expired": False}
    if row["status"] == "used":
        return {"pending": False, "code_sent": False, "expired": False, "used": True}
    return {"pending": True, "code_sent": False, "expired": False}


def complete_reset_scan(scene: str, openid: str) -> str | None:
    scene = _scene_strip(scene)
    if not scene.startswith(RESET_PREFIX) or not openid:
        return None
    _ensure_schema()
    with db_cursor() as cur:
        cur.execute(
            """
            SELECT id, email, user_id, status FROM password_reset_challenges
            WHERE scene=? AND expires_at > NOW()
            """,
            (scene,),
        )
        st = cur.fetchone()
    if not st:
        return "重置二维码已过期，请回到网页刷新后重试。"
    if st["status"] == "code_sent":
        return "验证码已发送，请查看上方消息并回到网页填写。"
    if st["status"] == "used":
        return "该重置请求已使用，如需重新重置请回到网页操作。"

    email = st["email"]
    with db_cursor() as cur:
        cur.execute(
            "SELECT id, wx_mp_openid, role FROM users WHERE email=?",
            (email,),
        )
        user = cur.fetchone()
    if not user:
        return "未找到该邮箱对应的账号。"
    bound = (user.get("wx_mp_openid") or "").strip()
    if not bound:
        return "该账号尚未绑定微信。请先用邮箱登录并完成微信绑定后再重置密码。"
    if bound != openid:
        return "请使用已绑定该账号的微信扫码。"

    code = f"{secrets.randbelow(1_000_000):06d}"
    code_hash = hash_password(code)
    with db_cursor() as cur:
        cur.execute(
            """
            UPDATE password_reset_challenges
            SET status='code_sent', code_hash=?, openid=?, user_id=?,
                expires_at=NOW() + ((?)::text || ' seconds')::interval
            WHERE id=?
            """,
            (code_hash, openid, user["id"], str(CODE_TTL_SEC), st["id"]),
        )
    log.info("password reset code sent email=%s", email)
    return f"【青山在】验证码 {code}，{CODE_TTL_SEC // 60} 分钟内有效。如非本人操作请忽略。"


def confirm_password_reset(email: str, code: str, new_password: str) -> None:
    _ensure_schema()
    email = email.strip().lower()
    code = (code or "").strip()
    if len(new_password) < 6:
        raise ValueError("密码至少 6 位")
    if not code or len(code) < 4:
        raise ValueError("请输入验证码")

    with db_cursor() as cur:
        cur.execute(
            """
            SELECT id, code_hash, status, attempts, user_id
            FROM password_reset_challenges
            WHERE email=? AND status='code_sent' AND expires_at > NOW()
            ORDER BY created_at DESC
            LIMIT 1
            """,
            (email,),
        )
        st = cur.fetchone()
        if not st or not st.get("code_hash"):
            raise ValueError("验证码无效或已过期，请重新扫码获取")
        attempts = int(st["attempts"] or 0)
        if attempts >= MAX_CODE_ATTEMPTS:
            cur.execute(
                "UPDATE password_reset_challenges SET status='expired' WHERE id=?",
                (st["id"],),
            )
            raise ValueError("验证码错误次数过多，请重新扫码获取")
        if not verify_password(code, st["code_hash"]):
            cur.execute(
                "UPDATE password_reset_challenges SET attempts=attempts+1 WHERE id=?",
                (st["id"],),
            )
            raise ValueError("验证码错误")
        uid = st["user_id"]
        if not uid:
            cur.execute("SELECT id FROM users WHERE email=?", (email,))
            u = cur.fetchone()
            uid = u["id"] if u else None
        if not uid:
            raise ValueError("账号不存在")
        cur.execute(
            "UPDATE users SET password_hash=? WHERE id=?",
            (hash_password(new_password), uid),
        )
        cur.execute(
            """
            UPDATE password_reset_challenges
            SET status='used', used_at=NOW()
            WHERE id=?
            """,
            (st["id"],),
        )
        cur.execute(
            "UPDATE sessions SET revoked_at=NOW() WHERE user_id=? AND revoked_at IS NULL",
            (uid,),
        )


def handle_bind_or_reset_scan(event_key: str, openid: str) -> str | None:
    """Route bind_/pwr_ scenes. Returns reply text if handled, else None."""
    scene = _scene_strip(event_key)
    if scene.startswith(BIND_PREFIX):
        return complete_bind_scan(scene, openid)
    if scene.startswith(RESET_PREFIX):
        return complete_reset_scan(scene, openid)
    return None
