"""Apply WeChat sns/userinfo fields onto FDE user profile (best-effort)."""

from __future__ import annotations

import logging
import mimetypes
from typing import Any
from uuid import uuid4

import requests

from services.shared import db_cursor
from services.shared.config import S3_BUCKET_ARTIFACTS

log = logging.getLogger("fde.wechat_mp.profile")

PLACEHOLDER_NAMES = frozenset({"", "微信用户", "学员", "用户", "分销收款"})


def decode_wechat_text(value: str | None) -> str:
    """Repair WeChat sns/userinfo nicknames that arrived as Latin-1 mojibake (e.g. å¾é¹ → 徐鸿)."""
    text = (value or "").strip()
    if not text:
        return ""
    has_cjk = any("\u4e00" <= ch <= "\u9fff" for ch in text)
    has_latin1 = any("\u00c0" <= ch <= "\u00ff" for ch in text)
    if has_cjk or not has_latin1:
        return text
    try:
        repaired = text.encode("latin-1").decode("utf-8")
    except (UnicodeEncodeError, UnicodeDecodeError):
        return text
    if any("\u4e00" <= ch <= "\u9fff" for ch in repaired):
        return repaired.strip()
    return text


def is_placeholder_display_name(name: str | None) -> bool:
    n = (name or "").strip()
    if not n:
        return True
    if n in PLACEHOLDER_NAMES:
        return True
    if n.startswith("wx_") and "@" in n:
        return True
    return False


def fetch_sns_userinfo(access_token: str, openid: str) -> dict[str, Any]:
    try:
        resp = requests.get(
            "https://api.weixin.qq.com/sns/userinfo",
            params={"access_token": access_token, "openid": openid, "lang": "zh_CN"},
            timeout=20,
        )
        data = resp.json() if resp.text else {}
        if data.get("errcode"):
            log.warning("sns/userinfo failed: %s", data)
            return {}
        if isinstance(data, dict) and data.get("nickname"):
            data["nickname"] = decode_wechat_text(str(data.get("nickname")))
        return data if isinstance(data, dict) else {}
    except Exception as exc:
        log.warning("sns/userinfo request failed: %s", exc)
        return {}


def _user_has_avatar(user_id: str) -> bool:
    with db_cursor() as cur:
        cur.execute(
            """
            SELECT 1 FROM information_schema.tables
            WHERE table_schema='public' AND table_name='user_profiles'
            """
        )
        if not cur.fetchone():
            return False
        cur.execute("SELECT * FROM user_profiles WHERE user_id=?", (user_id,))
        row = cur.fetchone()
    if not row:
        return False
    d = dict(row)
    return bool((d.get("avatar_url") or d.get("avatar_key") or "").strip())


def _set_avatar_key(user_id: str, key: str) -> None:
    with db_cursor() as cur:
        cur.execute(
            """
            SELECT 1 FROM information_schema.tables
            WHERE table_schema='public' AND table_name='user_profiles'
            """
        )
        if not cur.fetchone():
            return
        cur.execute("SELECT 1 FROM user_profiles WHERE user_id=?", (user_id,))
        exists = bool(cur.fetchone())
        if exists:
            for sql in (
                "UPDATE user_profiles SET avatar_url=? WHERE user_id=?",
                "UPDATE user_profiles SET avatar_key=? WHERE user_id=?",
            ):
                try:
                    cur.execute(sql, (key, user_id))
                    return
                except Exception:
                    continue
            return
        for sql, params in (
            ("INSERT INTO user_profiles (user_id, avatar_url, bio) VALUES (?,?,?)", (user_id, key, None)),
            ("INSERT INTO user_profiles (user_id, avatar_key, bio) VALUES (?,?,?)", (user_id, key, None)),
        ):
            try:
                cur.execute(sql, params)
                return
            except Exception:
                continue


def _download_avatar(user_id: str, headimgurl: str) -> str | None:
    url = (headimgurl or "").strip()
    if not url.startswith("http"):
        return None
    try:
        resp = requests.get(url, timeout=20)
        if resp.status_code >= 400 or not resp.content:
            log.warning("download wx avatar http %s", resp.status_code)
            return None
        data = resp.content
        if len(data) > 5 * 1024 * 1024:
            log.warning("wx avatar too large user=%s", user_id)
            return None
        ctype = (resp.headers.get("Content-Type") or "image/jpeg").split(";")[0].strip()
        ext = mimetypes.guess_extension(ctype) or ".jpg"
        if ext == ".jpe":
            ext = ".jpg"
        if ext not in (".jpg", ".jpeg", ".png", ".webp", ".gif"):
            ext = ".jpg"
            ctype = "image/jpeg"
        key = f"profiles/{user_id}/wx-avatar-{uuid4().hex[:10]}{ext}"
        from services.storage import get_store

        get_store().put_bytes(S3_BUCKET_ARTIFACTS, key, data, content_type=ctype)
        _set_avatar_key(user_id, key)
        return key
    except Exception as exc:
        log.warning("download wx avatar failed user=%s: %s", user_id, exc)
        return None


def apply_wechat_profile(
    user_id: str,
    *,
    nickname: str | None = None,
    headimgurl: str | None = None,
) -> dict[str, Any]:
    """
    Best-effort enrich display_name / wx_nickname / avatar.
    Never overwrites a non-placeholder display_name or an existing avatar.
    """
    changed: dict[str, Any] = {"display_name": False, "avatar": False}
    nick = decode_wechat_text(nickname)[:64] or None

    with db_cursor() as cur:
        cur.execute("SELECT display_name, wx_nickname FROM users WHERE id=?", (user_id,))
        row = cur.fetchone()
    if not row:
        return changed
    row = dict(row)
    current_name = row.get("display_name")
    repaired_current = decode_wechat_text(current_name)
    if repaired_current and repaired_current != (current_name or "").strip():
        with db_cursor() as cur:
            cur.execute("UPDATE users SET display_name=? WHERE id=?", (repaired_current[:64], user_id))
        current_name = repaired_current
        changed["display_name"] = True

    if nick:
        with db_cursor() as cur:
            cur.execute("UPDATE users SET wx_nickname=? WHERE id=?", (nick, user_id))
        if is_placeholder_display_name(current_name):
            with db_cursor() as cur:
                cur.execute("UPDATE users SET display_name=? WHERE id=?", (nick, user_id))
            changed["display_name"] = True

    if headimgurl and not _user_has_avatar(user_id):
        key = _download_avatar(user_id, headimgurl)
        if key:
            changed["avatar"] = True

    return changed


def profile_incomplete_for_user(user_id: str, display_name: str | None = None) -> bool:
    """True when learner still has placeholder name or no avatar."""
    name = display_name
    has_avatar = False
    with db_cursor() as cur:
        if name is None:
            cur.execute("SELECT display_name FROM users WHERE id=?", (user_id,))
            row = cur.fetchone()
            name = dict(row).get("display_name") if row else None
        cur.execute(
            """
            SELECT 1 FROM information_schema.tables
            WHERE table_schema='public' AND table_name='user_profiles'
            """
        )
        if cur.fetchone():
            cur.execute("SELECT * FROM user_profiles WHERE user_id=?", (user_id,))
            prow = cur.fetchone()
            if prow:
                d = dict(prow)
                has_avatar = bool((d.get("avatar_url") or d.get("avatar_key") or "").strip())
    return is_placeholder_display_name(name) or not has_avatar
