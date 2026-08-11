"""WeChat Pay v3 — Native QR checkout + notify."""

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

from services.shared import db_cursor, now_iso
from services.shared.config import (
    FDE_ENV,
    FDE_PUBLIC_BASE_URL,
    WECHAT_PAY_API_V3_KEY,
    WECHAT_PAY_APP_ID,
    WECHAT_PAY_MCH_ID,
    WECHAT_PAY_PLATFORM_CERT_PATH,
    WECHAT_PAY_PRIVATE_KEY_PATH,
    WECHAT_PAY_PROFIT_SHARING,
    WECHAT_PAY_SERIAL_NO,
    WECHAT_PAY_SKIP_VERIFY,
)

log = logging.getLogger("fde.billing.wechat")
API_BASE = "https://api.mch.weixin.qq.com"


def configured() -> bool:
    return bool(
        WECHAT_PAY_MCH_ID
        and WECHAT_PAY_APP_ID
        and WECHAT_PAY_SERIAL_NO
        and WECHAT_PAY_API_V3_KEY
        and len(WECHAT_PAY_API_V3_KEY) == 32
        and WECHAT_PAY_PRIVATE_KEY_PATH
        and Path(WECHAT_PAY_PRIVATE_KEY_PATH).exists()
    )


def _settings() -> dict[str, str]:
    return {
        "mch_id": WECHAT_PAY_MCH_ID,
        "app_id": WECHAT_PAY_APP_ID,
        "serial_no": WECHAT_PAY_SERIAL_NO,
        "api_v3_key": WECHAT_PAY_API_V3_KEY,
        "private_key_path": WECHAT_PAY_PRIVATE_KEY_PATH,
        "platform_cert_path": WECHAT_PAY_PLATFORM_CERT_PATH,
    }


def _load_private_key():
    from cryptography.hazmat.primitives.serialization import load_pem_private_key

    path = Path(WECHAT_PAY_PRIVATE_KEY_PATH)
    if not path.exists():
        raise RuntimeError(f"WeChat Pay private key not found: {path}")
    return load_pem_private_key(path.read_bytes(), password=None)


def _load_platform_public_key():
    from cryptography.x509 import load_pem_x509_certificate

    path = Path(WECHAT_PAY_PLATFORM_CERT_PATH)
    if not path.exists():
        raise RuntimeError(f"WeChat Pay platform cert not found: {path}")
    cert = load_pem_x509_certificate(path.read_bytes())
    return cert.public_key()


def _sign_message(message: str) -> str:
    from cryptography.hazmat.primitives.asymmetric.padding import PKCS1v15
    from cryptography.hazmat.primitives.hashes import SHA256

    key = _load_private_key()
    sig = key.sign(message.encode("utf-8"), PKCS1v15(), SHA256())
    return base64.b64encode(sig).decode("utf-8")


def _auth_header(method: str, url_path: str, body: str = "") -> dict[str, str]:
    cfg = _settings()
    ts = str(int(time.time()))
    nonce = uuid.uuid4().hex
    message = f"{method}\n{url_path}\n{ts}\n{nonce}\n{body}\n"
    signature = _sign_message(message)
    token = (
        f'WECHATPAY2-SHA256-RSA2048 mchid="{cfg["mch_id"]}",'
        f'nonce_str="{nonce}",timestamp="{ts}",serial_no="{cfg["serial_no"]}",'
        f'signature="{signature}"'
    )
    return {
        "Authorization": token,
        "Accept": "application/json",
        "Content-Type": "application/json",
    }


def _request(method: str, path: str, payload: dict | None = None) -> dict:
    body = json.dumps(payload, separators=(",", ":"), ensure_ascii=True) if payload else ""
    headers = _auth_header(method, path, body)
    body_bytes = body.encode("utf-8") if body else None
    if body_bytes is not None:
        headers["Content-Length"] = str(len(body_bytes))
    resp = requests.request(method, API_BASE + path, headers=headers, data=body_bytes, timeout=30)
    if resp.status_code >= 400:
        raise RuntimeError(f"WeChat Pay API {resp.status_code}: {resp.text[:500]}")
    return resp.json() if resp.text else {}


def _header_value(headers: dict, name: str) -> str:
    for key, value in headers.items():
        if key.lower() == name.lower():
            return (value or "").strip()
    return ""


def verify_notify_signature(headers: dict, body: bytes) -> None:
    if WECHAT_PAY_SKIP_VERIFY and FDE_ENV != "prod":
        return
    timestamp = _header_value(headers, "Wechatpay-Timestamp")
    nonce = _header_value(headers, "Wechatpay-Nonce")
    signature_b64 = _header_value(headers, "Wechatpay-Signature")
    serial = _header_value(headers, "Wechatpay-Serial")
    if not all([timestamp, nonce, signature_b64, serial]):
        raise ValueError("缺少微信回调验签头")
    if abs(time.time() - int(timestamp)) > 300:
        raise ValueError("微信回调时间戳超出允许范围")
    from cryptography.hazmat.primitives.asymmetric.padding import PKCS1v15
    from cryptography.hazmat.primitives.hashes import SHA256

    message = f"{timestamp}\n{nonce}\n{body.decode('utf-8')}\n".encode("utf-8")
    signature = base64.b64decode(signature_b64)
    public_key = _load_platform_public_key()
    public_key.verify(signature, message, PKCS1v15(), SHA256())


def _decrypt_resource(resource: dict) -> dict:
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM

    key = WECHAT_PAY_API_V3_KEY.encode("utf-8")
    nonce = resource["nonce"].encode("utf-8")
    associated = resource.get("associated_data", "").encode("utf-8")
    ciphertext = base64.b64decode(resource["ciphertext"])
    plain = AESGCM(key).decrypt(nonce, ciphertext, associated)
    return json.loads(plain.decode("utf-8"))


def record_payment_event(provider: str, event_id: str, event_type: str, payload_hash: str) -> bool:
    """Return False if duplicate."""
    eid = f"pe-{uuid.uuid4().hex[:16]}"
    with db_cursor() as cur:
        cur.execute(
            "SELECT 1 FROM payment_events WHERE provider=? AND event_id=?",
            (provider, event_id),
        )
        if cur.fetchone():
            return False
        cur.execute(
            """
            INSERT INTO payment_events (id, provider, event_id, event_type, payload_hash, created_at)
            VALUES (?,?,?,?,?,?)
            """,
            (eid, provider, event_id, event_type, payload_hash, now_iso()),
        )
    return True


def get_payment_order(order_id: str) -> dict[str, Any] | None:
    with db_cursor() as cur:
        cur.execute("SELECT * FROM payment_orders WHERE id=? OR out_trade_no=?", (order_id, order_id))
        row = cur.fetchone()
        return dict(row) if row else None


def validate_trade_against_order(order: dict, trade: dict) -> str | None:
    if (trade.get("mchid") or "") != WECHAT_PAY_MCH_ID:
        return "商户号不匹配"
    appid = trade.get("appid")
    if appid and appid != WECHAT_PAY_APP_ID:
        return "AppID 不匹配"
    amount = trade.get("amount") or {}
    paid_total = int(amount.get("total") or 0)
    if paid_total != int(order.get("amount_fen") or 0):
        return f"支付金额不匹配: {paid_total} != {order.get('amount_fen')}"
    if (trade.get("out_trade_no") or "") != order.get("out_trade_no"):
        return "商户订单号不匹配"
    return None


def create_payment_order(
    user_id: str,
    offering_id: str,
    amount_fen: int,
    org_id: str | None,
    description: str,
    referrer_user_id: str | None = None,
) -> dict[str, Any]:
    oid = f"po-{uuid.uuid4().hex[:16]}"
    out_trade_no = f"FDE{int(time.time())}{uuid.uuid4().hex[:8].upper()}"
    code_url = None
    status = "pending"
    if configured():
        notify_url = f"{FDE_PUBLIC_BASE_URL}/api/v1/billing/wechat/notify"
        payload = {
            "appid": WECHAT_PAY_APP_ID,
            "mchid": WECHAT_PAY_MCH_ID,
            "description": description[:127],
            "out_trade_no": out_trade_no,
            "notify_url": notify_url,
            "amount": {"total": amount_fen, "currency": "CNY"},
        }
        if WECHAT_PAY_PROFIT_SHARING:
            payload["settle_info"] = {"profit_sharing": True}
        data = _request("POST", "/v3/pay/transactions/native", payload)
        code_url = data.get("code_url")
    elif FDE_ENV != "prod":
        code_url = f"dev://fde-pay/{out_trade_no}"
    else:
        raise RuntimeError("微信支付未配置")
    with db_cursor() as cur:
        cur.execute(
            """
            INSERT INTO payment_orders
              (id, out_trade_no, user_id, offering_id, org_id, referrer_user_id,
               amount_fen, status, code_url, created_at, updated_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?)
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


def query_wechat_order(out_trade_no: str) -> dict:
    path = f"/v3/pay/transactions/out-trade-no/{out_trade_no}?mchid={WECHAT_PAY_MCH_ID}"
    return _request("GET", path)


def mark_order_paid(order_id: str, wx_transaction_id: str = "") -> dict[str, Any]:
    from services.billing.fulfillment import fulfill_paid_order

    with db_cursor() as cur:
        cur.execute("SELECT * FROM payment_orders WHERE id=? OR out_trade_no=?", (order_id, order_id))
        order = cur.fetchone()
        if not order:
            raise ValueError("订单不存在")
        order = dict(order)
        if order.get("status") == "paid":
            return order
        cur.execute(
            """
            UPDATE payment_orders
            SET status='paid', wx_transaction_id=?, paid_at=?, updated_at=?
            WHERE id=?
            """,
            (wx_transaction_id or None, now_iso(), now_iso(), order["id"]),
        )
    fulfill_paid_order(order["id"])
    return get_payment_order(order["id"]) or {}


def sync_order_status(order_id: str) -> str:
    order = get_payment_order(order_id)
    if not order:
        return "missing"
    if order.get("status") == "paid":
        return "paid"
    if not configured():
        return order.get("status", "pending")
    try:
        data = query_wechat_order(order["out_trade_no"])
    except Exception as exc:
        log.warning("sync_order_status failed: %s", exc)
        return order.get("status", "pending")
    state = data.get("trade_state", "")
    if state == "SUCCESS":
        err = validate_trade_against_order(order, data)
        if err:
            log.error("trade validation failed: %s", err)
            return "pending"
        mark_order_paid(order["id"], data.get("transaction_id", ""))
        return "paid"
    if state in ("CLOSED", "REVOKED", "PAYERROR"):
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


def handle_notify(headers: dict, body: bytes) -> NotifyResult:
    if not configured() and not (WECHAT_PAY_SKIP_VERIFY and FDE_ENV != "prod"):
        return NotifyResult(ok=False, error="wechat not configured")
    try:
        verify_notify_signature(headers, body)
    except Exception as exc:
        return NotifyResult(ok=False, error=str(exc))
    try:
        payload = json.loads(body.decode("utf-8"))
    except Exception as exc:
        return NotifyResult(ok=False, error=str(exc))
    event_id = payload.get("id") or hashlib.sha256(body).hexdigest()[:32]
    payload_hash = hashlib.sha256(body).hexdigest()
    if not record_payment_event("wechat", event_id, payload.get("event_type", ""), payload_hash):
        return NotifyResult(ok=True, error="duplicate")
    resource = payload.get("resource") or {}
    try:
        data = _decrypt_resource(resource)
    except Exception as exc:
        return NotifyResult(ok=False, error=f"decrypt failed: {exc}")
    if data.get("trade_state") != "SUCCESS":
        return NotifyResult(ok=True)
    order = get_payment_order(data.get("out_trade_no", ""))
    if not order:
        return NotifyResult(ok=False, error="order not found")
    if order.get("status") == "paid":
        return NotifyResult(ok=True, order_id=order["id"])
    err = validate_trade_against_order(order, data)
    if err:
        return NotifyResult(ok=False, error=err)
    mark_order_paid(order["id"], data.get("transaction_id", ""))
    return NotifyResult(ok=True, order_id=order["id"])
