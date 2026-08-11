"""Alipay OpenAPI — Face-to-face precreate QR checkout + notify."""

from __future__ import annotations

import base64
import hashlib
import json
import logging
import time
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import requests

from services.billing.wechat_pay import get_payment_order, mark_order_paid, record_payment_event
from services.shared import db_cursor, now_iso
from services.shared.config import (
    ALIPAY_APP_ID,
    ALIPAY_GATEWAY,
    ALIPAY_PRIVATE_KEY,
    ALIPAY_PRIVATE_KEY_PATH,
    ALIPAY_PUBLIC_KEY,
    ALIPAY_PUBLIC_KEY_PATH,
    FDE_ENV,
    FDE_PUBLIC_BASE_URL,
)

log = logging.getLogger("fde.billing.alipay")


def _normalize_pem(raw: str, *, kind: str) -> str:
    text = (raw or "").strip()
    if not text:
        return ""
    if "BEGIN" in text:
        return text
    # Key-tool exports are often bare base64 (single line).
    body = "".join(text.split())
    wrapped = "\n".join(body[i : i + 64] for i in range(0, len(body), 64))
    if kind == "private":
        # PKCS#8 (MIIE…) vs PKCS#1 (MIIE… RSA PRIVATE) — tool RSA2048 is PKCS#8.
        return f"-----BEGIN PRIVATE KEY-----\n{wrapped}\n-----END PRIVATE KEY-----"
    return f"-----BEGIN PUBLIC KEY-----\n{wrapped}\n-----END PUBLIC KEY-----"


def _load_private_key_pem() -> str:
    if ALIPAY_PRIVATE_KEY.strip():
        return _normalize_pem(ALIPAY_PRIVATE_KEY, kind="private")
    if ALIPAY_PRIVATE_KEY_PATH:
        path = Path(ALIPAY_PRIVATE_KEY_PATH)
        if path.exists():
            return _normalize_pem(path.read_text(encoding="utf-8"), kind="private")
    return ""


def _load_public_key_pem() -> str:
    if ALIPAY_PUBLIC_KEY.strip():
        return _normalize_pem(ALIPAY_PUBLIC_KEY, kind="public")
    if ALIPAY_PUBLIC_KEY_PATH:
        path = Path(ALIPAY_PUBLIC_KEY_PATH)
        if path.exists():
            return _normalize_pem(path.read_text(encoding="utf-8"), kind="public")
    return ""


def configured() -> bool:
    return bool(ALIPAY_APP_ID and _load_private_key_pem() and _load_public_key_pem())


def _sign_rsa2(message: str) -> str:
    from cryptography.hazmat.primitives.asymmetric.padding import PKCS1v15
    from cryptography.hazmat.primitives.hashes import SHA256
    from cryptography.hazmat.primitives.serialization import load_pem_private_key

    key = load_pem_private_key(_load_private_key_pem().encode("utf-8"), password=None)
    sig = key.sign(message.encode("utf-8"), PKCS1v15(), SHA256())
    return base64.b64encode(sig).decode("utf-8")


def verify_rsa2(message: str, signature_b64: str) -> bool:
    from cryptography.hazmat.primitives.asymmetric.padding import PKCS1v15
    from cryptography.hazmat.primitives.hashes import SHA256
    from cryptography.hazmat.primitives.serialization import load_pem_public_key
    from cryptography.exceptions import InvalidSignature

    pub = load_pem_public_key(_load_public_key_pem().encode("utf-8"))
    try:
        pub.verify(base64.b64decode(signature_b64), message.encode("utf-8"), PKCS1v15(), SHA256())
        return True
    except (InvalidSignature, ValueError):
        return False


def _sign_content(params: dict[str, Any]) -> str:
    """Build Alipay OpenAPI unsigned string (ASCII key order).

    Only ``sign`` is excluded. ``sign_type`` MUST participate in the signature —
    omitting it yields Alipay's misleading charset error.
    """
    items = []
    for key in sorted(params.keys()):
        if key == "sign":
            continue
        val = params[key]
        if val is None or val == "":
            continue
        items.append(f"{key}={val}")
    return "&".join(items)


def _gateway_post(method: str, biz: dict[str, Any]) -> dict[str, Any]:
    if not configured():
        raise RuntimeError("支付宝未配置")
    params: dict[str, Any] = {
        "app_id": ALIPAY_APP_ID,
        "method": method,
        "format": "json",
        "charset": "utf-8",
        "sign_type": "RSA2",
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "version": "1.0",
        "biz_content": json.dumps(biz, ensure_ascii=False, separators=(",", ":")),
    }
    if method == "alipay.trade.precreate":
        params["notify_url"] = f"{FDE_PUBLIC_BASE_URL.rstrip('/')}/api/v1/billing/alipay/notify"
    unsigned = _sign_content(params)
    params["sign"] = _sign_rsa2(unsigned)
    # Alipay requires charset in the URL query string for correct decoding.
    gateway = ALIPAY_GATEWAY.rstrip("/")
    url = gateway if "charset=" in gateway else f"{gateway}?charset=utf-8"
    resp = requests.post(
        url,
        data=params,
        headers={"Content-Type": "application/x-www-form-urlencoded;charset=utf-8"},
        timeout=30,
    )
    if resp.status_code >= 400:
        raise RuntimeError(f"Alipay HTTP {resp.status_code}: {resp.text[:400]}")
    data = resp.json()
    # Response key: alipay_trade_precreate_response / alipay_trade_query_response
    resp_key = method.replace(".", "_") + "_response"
    payload = data.get(resp_key) or {}
    # Verify response sign when present
    sign = data.get("sign")
    if sign and payload:
        raw = resp.text
        # Prefer canonical: content between "xxx_response": and ,"sign"
        marker = f'"{resp_key}":'
        i = raw.find(marker)
        if i >= 0:
            j = raw.find("{", i)
            # find matching brace
            depth = 0
            k = j
            while k < len(raw):
                if raw[k] == "{":
                    depth += 1
                elif raw[k] == "}":
                    depth -= 1
                    if depth == 0:
                        content = raw[j : k + 1]
                        if not verify_rsa2(content, sign):
                            log.warning("alipay response sign verify failed for %s", method)
                        break
                k += 1
    code = str(payload.get("code") or "")
    if code and code != "10000":
        raise RuntimeError(f"Alipay {method}: {payload.get('sub_msg') or payload.get('msg') or payload}")
    return payload


def create_payment_order(
    user_id: str,
    offering_id: str,
    amount_fen: int,
    org_id: str | None,
    description: str,
    referrer_user_id: str | None = None,
) -> dict[str, Any]:
    oid = f"po-{uuid.uuid4().hex[:16]}"
    out_trade_no = f"FDA{int(time.time())}{uuid.uuid4().hex[:8].upper()}"
    code_url = None
    status = "pending"
    yuan = f"{amount_fen / 100:.2f}"
    if configured():
        data = _gateway_post(
            "alipay.trade.precreate",
            {
                "out_trade_no": out_trade_no,
                "total_amount": yuan,
                "subject": description[:256],
                "timeout_express": "2h",
            },
        )
        code_url = data.get("qr_code")
        if not code_url:
            raise RuntimeError("支付宝未返回收款二维码")
    elif FDE_ENV != "prod":
        code_url = f"dev://fde-alipay/{out_trade_no}"
    else:
        raise RuntimeError("支付宝未配置")

    with db_cursor() as cur:
        cur.execute(
            """
            INSERT INTO payment_orders
              (id, out_trade_no, user_id, offering_id, org_id, referrer_user_id,
               amount_fen, status, code_url, pay_channel, created_at, updated_at)
            VALUES (?,?,?,?,?,?,?,?,?,'alipay',?,?)
            """,
            (
                oid,
                out_trade_no,
                user_id,
                offering_id,
                org_id,
                referrer_user_id,
                amount_fen,
                status,
                code_url,
                now_iso(),
                now_iso(),
            ),
        )
        cur.execute("SELECT * FROM payment_orders WHERE id=?", (oid,))
        row = cur.fetchone()
        return dict(row) if row else {}


def query_trade(out_trade_no: str) -> dict[str, Any]:
    return _gateway_post("alipay.trade.query", {"out_trade_no": out_trade_no})


def validate_trade_against_order(order: dict, trade: dict) -> str | None:
    paid = trade.get("total_amount") or trade.get("receipt_amount")
    if paid is not None:
        try:
            paid_fen = int(round(float(paid) * 100))
        except (TypeError, ValueError):
            return "支付金额解析失败"
        if paid_fen != int(order.get("amount_fen") or 0):
            return f"支付金额不匹配: {paid_fen} != {order.get('amount_fen')}"
    if (trade.get("out_trade_no") or "") != order.get("out_trade_no"):
        return "商户订单号不匹配"
    app_id = trade.get("app_id")
    if app_id and app_id != ALIPAY_APP_ID:
        return "AppID 不匹配"
    return None


def sync_order_status(order_id: str) -> str:
    order = get_payment_order(order_id)
    if not order:
        return "missing"
    if order.get("status") == "paid":
        return "paid"
    if (order.get("pay_channel") or "wechat") != "alipay":
        return order.get("status", "pending")
    if not configured():
        return order.get("status", "pending")
    try:
        data = query_trade(order["out_trade_no"])
    except Exception as exc:
        log.warning("alipay sync failed: %s", exc)
        return order.get("status", "pending")
    state = (data.get("trade_status") or "").upper()
    if state in ("TRADE_SUCCESS", "TRADE_FINISHED"):
        err = validate_trade_against_order(order, data)
        if err:
            log.error("alipay trade validation failed: %s", err)
            return "pending"
        mark_order_paid(order["id"], data.get("trade_no", ""))
        return "paid"
    if state in ("TRADE_CLOSED",):
        with db_cursor() as cur:
            cur.execute(
                "UPDATE payment_orders SET status='failed', updated_at=? WHERE id=?",
                (now_iso(), order["id"]),
            )
        return "failed"
    return "pending"


@dataclass
class NotifyResult:
    ok: bool
    error: str | None = None
    order_id: str | None = None


def handle_notify(form: dict[str, str]) -> NotifyResult:
    if not configured() and FDE_ENV == "prod":
        return NotifyResult(ok=False, error="alipay not configured")
    params = {k: v for k, v in form.items() if v is not None}
    sign = params.pop("sign", "") or ""
    params.pop("sign_type", None)
    content = _sign_content(params)
    if configured() and sign and not verify_rsa2(content, sign):
        return NotifyResult(ok=False, error="invalid sign")
    event_id = params.get("trade_no") or params.get("notify_id") or hashlib.sha256(content.encode()).hexdigest()[:32]
    payload_hash = hashlib.sha256(content.encode()).hexdigest()
    if not record_payment_event("alipay", event_id, params.get("trade_status", ""), payload_hash):
        return NotifyResult(ok=True, error="duplicate")
    status = (params.get("trade_status") or "").upper()
    if status not in ("TRADE_SUCCESS", "TRADE_FINISHED"):
        return NotifyResult(ok=True)
    order = get_payment_order(params.get("out_trade_no", ""))
    if not order:
        return NotifyResult(ok=False, error="order not found")
    if order.get("status") == "paid":
        return NotifyResult(ok=True, order_id=order["id"])
    err = validate_trade_against_order(order, params)
    if err:
        return NotifyResult(ok=False, error=err)
    mark_order_paid(order["id"], params.get("trade_no", ""))
    return NotifyResult(ok=True, order_id=order["id"])
