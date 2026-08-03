"""WeChat MP client — access_token + temporary QR with scene_str."""

from __future__ import annotations

import logging
import threading
import time
from typing import Any

import requests

from services.shared.config import WECHAT_APP_SECRET, WECHAT_PAY_APP_ID

log = logging.getLogger("fde.wechat_mp.client")

_lock = threading.Lock()
_cached: dict[str, Any] = {"token": "", "expires_at": 0.0}


def mp_configured() -> bool:
    return bool(WECHAT_PAY_APP_ID and WECHAT_APP_SECRET)


def get_access_token(*, force: bool = False) -> str:
    if not mp_configured():
        raise RuntimeError("未配置 WECHAT_PAY_APP_ID / WECHAT_APP_SECRET")
    now = time.time()
    with _lock:
        if not force and _cached["token"] and _cached["expires_at"] > now + 60:
            return str(_cached["token"])
    resp = requests.get(
        "https://api.weixin.qq.com/cgi-bin/token",
        params={
            "grant_type": "client_credential",
            "appid": WECHAT_PAY_APP_ID,
            "secret": WECHAT_APP_SECRET,
        },
        timeout=20,
    )
    data = resp.json() if resp.text else {}
    if not data.get("access_token"):
        raise RuntimeError(f"获取 access_token 失败: {data}")
    with _lock:
        _cached["token"] = data["access_token"]
        _cached["expires_at"] = now + int(data.get("expires_in") or 7200)
        return str(_cached["token"])


def create_temp_qr(scene_str: str, expire_seconds: int = 600) -> dict[str, Any]:
    """Create temporary QR with scene_str. Returns ticket + showqrcode URL."""
    if len(scene_str) > 64:
        raise ValueError("scene_str 过长")
    token = get_access_token()
    body = {
        "expire_seconds": max(60, min(int(expire_seconds), 2592000)),
        "action_name": "QR_STR_SCENE",
        "action_info": {"scene": {"scene_str": scene_str}},
    }
    resp = requests.post(
        "https://api.weixin.qq.com/cgi-bin/qrcode/create",
        params={"access_token": token},
        json=body,
        timeout=20,
    )
    data = resp.json() if resp.text else {}
    if data.get("errcode"):
        # retry once on invalid credential
        if int(data.get("errcode") or 0) in (40001, 42001):
            token = get_access_token(force=True)
            resp = requests.post(
                "https://api.weixin.qq.com/cgi-bin/qrcode/create",
                params={"access_token": token},
                json=body,
                timeout=20,
            )
            data = resp.json() if resp.text else {}
    if not data.get("ticket"):
        raise RuntimeError(f"创建带参二维码失败: {data}")
    ticket = str(data["ticket"])
    from urllib.parse import quote

    return {
        "ticket": ticket,
        "expire_seconds": int(data.get("expire_seconds") or expire_seconds),
        "url": data.get("url"),
        "qr_url": f"https://mp.weixin.qq.com/cgi-bin/showqrcode?ticket={quote(ticket)}",
    }
