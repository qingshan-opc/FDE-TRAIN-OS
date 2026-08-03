"""WeChat profit sharing — tier match + API."""

from __future__ import annotations

import json
import logging
import uuid
from typing import Any
from urllib.parse import quote

from services.billing.wechat_pay import _request, configured, get_payment_order
from services.partners.service import match_commission_rate_bps, org_paid_user_count
from services.shared import db_cursor, now_iso
from services.shared.config import WECHAT_PAY_APP_ID

log = logging.getLogger("fde.billing.profit_share")


def _ensure_receiver(org: dict) -> None:
    if not configured():
        return
    rtype = org.get("wx_receiver_type")
    account = org.get("wx_receiver_account")
    name = org.get("wx_receiver_name") or org.get("name") or "partner"
    if not rtype or not account:
        return
    payload: dict[str, Any] = {
        "appid": WECHAT_PAY_APP_ID,
        "type": rtype,
        "account": account,
        "relation_type": "PARTNER",
    }
    # MERCHANT_ID requires name; PERSONAL_OPENID name is optional (实名校验时填写)
    if rtype == "MERCHANT_ID" or (rtype == "PERSONAL_OPENID" and name):
        payload["name"] = str(name)[:32]
    try:
        _request("POST", "/v3/profitsharing/receivers/add", payload)
    except Exception as exc:
        if "已存在" in str(exc) or "EXIST" in str(exc).upper():
            return
        log.warning("add receiver failed: %s", exc)
        raise


def request_profit_share_for_order(payment_order_id: str) -> dict[str, Any] | None:
    order = get_payment_order(payment_order_id)
    if not order or order.get("status") != "paid":
        return None
    org_id = order.get("org_id")
    if not org_id:
        return None
    with db_cursor() as cur:
        cur.execute("SELECT 1 FROM profit_share_orders WHERE payment_order_id=?", (payment_order_id,))
        if cur.fetchone():
            cur.execute("SELECT * FROM profit_share_orders WHERE payment_order_id=?", (payment_order_id,))
            row = cur.fetchone()
            return dict(row) if row else None
        cur.execute("SELECT * FROM organizations WHERE id=?", (org_id,))
        org = cur.fetchone()
    if not org:
        return None
    org = dict(org)
    paid_before = org_paid_user_count(org_id, before_order_id=payment_order_id)
    rate_bps = match_commission_rate_bps(org_id, paid_before)
    if rate_bps <= 0:
        return None
    amount_fen = int(order.get("amount_fen") or 0)
    share_fen = amount_fen * rate_bps // 10000
    if share_fen <= 0:
        return None
    psid = f"ps-{uuid.uuid4().hex[:16]}"
    wx_state = "pending"
    wx_order_id = None
    error_message = None
    if configured() and org.get("wx_receiver_type") and org.get("wx_receiver_account"):
        try:
            _ensure_receiver(org)
            out_no = f"PS{uuid.uuid4().hex[:16].upper()}"
            payload = {
                "appid": WECHAT_PAY_APP_ID,
                "transaction_id": order.get("wx_transaction_id") or "",
                "out_order_no": out_no,
                "receivers": [
                    {
                        "type": org["wx_receiver_type"],
                        "account": org["wx_receiver_account"],
                        "amount": share_fen,
                        "description": "机构渠道分账",
                    }
                ],
                "unfreeze_unsplit": True,
            }
            if not payload["transaction_id"]:
                raise RuntimeError("缺少微信 transaction_id，稍后 sync 重试")
            data = _request("POST", "/v3/profitsharing/orders", payload)
            # Persist our out_order_no so we can query later (not WeChat order_id)
            wx_order_id = out_no
            wx_state = "processing"
            if data.get("state") in ("FINISHED", "finished"):
                wx_state = "finished"
        except Exception as exc:
            error_message = str(exc)[:500]
            wx_state = "failed"
            log.warning("profit sharing API failed: %s", exc)
    else:
        wx_state = "pending_manual"
        error_message = "未配置微信分账接收方，仅记录应分金额"
    with db_cursor() as cur:
        cur.execute(
            """
            INSERT INTO profit_share_orders
              (id, payment_order_id, org_id, rate_bps, share_fen, wx_state, wx_order_id, error_message, created_at, updated_at)
            VALUES (?,?,?,?,?,?,?,?,?,?)
            """,
            (psid, payment_order_id, org_id, rate_bps, share_fen, wx_state, wx_order_id, error_message, now_iso(), now_iso()),
        )
        cur.execute("SELECT * FROM profit_share_orders WHERE id=?", (psid,))
        row = cur.fetchone()
        return dict(row) if row else None


def sync_profit_share_statuses(limit: int = 30) -> int:
    """Query WeChat for processing shares and mark finished/failed."""
    if not configured():
        return 0
    updated = 0
    with db_cursor() as cur:
        cur.execute(
            """
            SELECT ps.id, ps.wx_order_id, ps.payment_order_id, po.wx_transaction_id
            FROM profit_share_orders ps
            JOIN payment_orders po ON po.id = ps.payment_order_id
            WHERE ps.wx_state = 'processing'
              AND ps.wx_order_id IS NOT NULL
              AND po.wx_transaction_id IS NOT NULL
            ORDER BY ps.updated_at ASC
            LIMIT ?
            """,
            (limit,),
        )
        rows = [dict(r) for r in cur.fetchall()]
    for row in rows:
        out_no = row.get("wx_order_id")
        tx = row.get("wx_transaction_id")
        if not out_no or not tx:
            continue
        try:
            path = (
                f"/v3/profitsharing/orders/{quote(str(out_no), safe='')}"
                f"?transaction_id={quote(str(tx), safe='')}"
            )
            data = _request("GET", path)
            state = str(data.get("state") or "").upper()
            receivers = data.get("receivers") or []
            # Aggregate receiver results if present
            if any(str(r.get("result") or "").upper() == "CLOSED" for r in receivers):
                state = "CLOSED"
            elif any(str(r.get("result") or "").upper() == "PENDING" for r in receivers):
                state = "PROCESSING"
            elif receivers and all(str(r.get("result") or "").upper() == "SUCCESS" for r in receivers):
                state = "FINISHED"
            new_state = None
            err = None
            if state in ("FINISHED", "SUCCESS"):
                new_state = "finished"
            elif state in ("CLOSED", "FAILED"):
                new_state = "failed"
                err = json.dumps(data, ensure_ascii=False)[:500]
            if new_state:
                with db_cursor() as cur:
                    cur.execute(
                        """
                        UPDATE profit_share_orders
                        SET wx_state=?, error_message=COALESCE(?, error_message), updated_at=?
                        WHERE id=?
                        """,
                        (new_state, err, now_iso(), row["id"]),
                    )
                updated += 1
        except Exception as exc:
            log.warning("sync profit share %s failed: %s", row.get("id"), exc)
    return updated


def retry_pending_shares(limit: int = 20) -> int:
    """Retry profit shares that failed / waited for receiver or transaction_id."""
    count = 0
    sync_profit_share_statuses(limit=limit)
    with db_cursor() as cur:
        cur.execute(
            """
            SELECT ps.id, ps.payment_order_id FROM profit_share_orders ps
            JOIN payment_orders po ON po.id = ps.payment_order_id
            JOIN organizations o ON o.id = ps.org_id
            WHERE ps.wx_state IN ('pending','failed','pending_manual')
              AND po.wx_transaction_id IS NOT NULL
              AND o.wx_receiver_type IS NOT NULL
              AND o.wx_receiver_account IS NOT NULL
            LIMIT ?
            """,
            (limit,),
        )
        rows = [dict(r) for r in cur.fetchall()]
    for row in rows:
        with db_cursor() as cur:
            cur.execute("DELETE FROM profit_share_orders WHERE id=?", (row["id"],))
        if request_profit_share_for_order(row["payment_order_id"]):
            count += 1
    return count
