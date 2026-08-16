#!/usr/bin/env python3
"""Create / publish WeChat MP custom menu.

Usage (inside app container or with env set):
  python scripts/wechat_mp_create_menu.py

Env:
  WECHAT_PAY_APP_ID / WECHAT_APP_SECRET
  FDE_PUBLIC_BASE_URL (default https://fde.818cloud.com)
"""

from __future__ import annotations

import json
import os
import sys
from urllib.parse import quote

import requests

APP_ID = os.getenv("WECHAT_PAY_APP_ID") or os.getenv("WECHAT_MP_APP_ID") or ""
SECRET = os.getenv("WECHAT_APP_SECRET") or ""
BASE = (os.getenv("FDE_PUBLIC_BASE_URL") or "https://fde.818cloud.com").rstrip("/")


def main() -> int:
    if not APP_ID or not SECRET:
        print("ERROR: missing WECHAT_PAY_APP_ID / WECHAT_APP_SECRET", file=sys.stderr)
        return 1

    tok = requests.get(
        "https://api.weixin.qq.com/cgi-bin/token",
        params={"grant_type": "client_credential", "appid": APP_ID, "secret": SECRET},
        timeout=20,
    ).json()
    if not tok.get("access_token"):
        print("ERROR get token:", tok, file=sys.stderr)
        return 1

    entry = f"{BASE}/api/v1/auth/wechat/mp-entry?next={quote('/app/courses', safe='')}"
    shop = f"{BASE}/api/v1/auth/wechat/mp-entry?next={quote('/app/shop', safe='')}"
    partner = f"{BASE}/api/v1/auth/wechat/mp-entry?next={quote('/partner/activate', safe='')}"
    body = {
        "button": [
            {
                "name": "学习中心",
                "sub_button": [
                    {"type": "view", "name": "我的课程", "url": entry},
                    {"type": "view", "name": "选购课程", "url": shop},
                ],
            },
            {
                "type": "view",
                "name": "官网",
                "url": BASE + "/",
            },
            {
                "type": "view",
                "name": "机构平台",
                "url": partner,
            },
        ]
    }
    print("menu payload:")
    print(json.dumps(body, ensure_ascii=False, indent=2))

    data = json.dumps(body, ensure_ascii=False).encode("utf-8")
    resp = requests.post(
        "https://api.weixin.qq.com/cgi-bin/menu/create",
        params={"access_token": tok["access_token"]},
        data=data,
        headers={"Content-Type": "application/json; charset=utf-8"},
        timeout=20,
    ).json()
    print("wechat response:", resp)
    if int(resp.get("errcode") or 0) != 0:
        return 1

    # verify
    cur = requests.get(
        "https://api.weixin.qq.com/cgi-bin/get_current_selfmenu_info",
        params={"access_token": tok["access_token"]},
        timeout=20,
    ).json()
    print("current menu:", json.dumps(cur, ensure_ascii=False)[:800])
    print("OK — 请用手机微信打开公众号，下拉刷新会话后查看底部菜单")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
