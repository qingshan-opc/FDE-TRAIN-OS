"""WeChat profit sharing — 7-day hold, then split / unfreeze."""

from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any
from urllib.parse import quote

from services.billing.wechat_pay import _request, configured, get_payment_order
from services.partners.service import match_commission_rate_bps, org_paid_user_count
from services.referral.service import count_learner_invites, match_learner_rate_bps
from services.shared import db_cursor, now_iso
from services.shared.config import WECHAT_PAY_APP_ID, WECHAT_PAY_SHARE_HOLD_DAYS

log = logging.getLogger("fde.billing.profit_share")

OPEN_SHARE_STATES = ("held", "pending", "pending_manual", "failed")
CLAIMABLE_STATES = OPEN_SHARE_STATES + ("submitting",)
PENDING_KPI_STATES = ("held", "pending", "processing", "pending_manual", "submitting")
BLOCK_REFUND_STATES = ("submitting", "processing", "finished")


def hold_days() -> int:
    return int(WECHAT_PAY_SHARE_HOLD_DAYS)


def as_utc(value: Any) -> datetime | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc)
    text = str(value).strip()
    if not text:
        return None
    if text.endswith("Z"):
        text = text[:-1] + "+00:00"
    try:
        parsed = datetime.fromisoformat(text)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def hold_deadline(paid_at: Any) -> datetime:
    start = as_utc(paid_at) or datetime.now(timezone.utc)
    return start + timedelta(days=hold_days())


def refund_window_open(order: dict[str, Any], *, now: datetime | None = None) -> bool:
    paid = as_utc(order.get("paid_at"))
    if not paid:
        return False
    current = now or datetime.now(timezone.utc)
    return current < hold_deadline(paid)


def _ensure_org_receiver(org: dict) -> None:
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
    if rtype == "MERCHANT_ID" and name:
        payload["name"] = str(name)[:32]
    try:
        _request("POST", "/v3/profitsharing/receivers/add", payload)
    except Exception as exc:
        if "已存在" in str(exc) or "EXIST" in str(exc).upper():
            return
        log.warning("add receiver failed: %s", exc)
        raise


# Alias used by partner WeChat bind.
_ensure_receiver = _ensure_org_receiver


def _ensure_personal_receiver(openid: str) -> None:
    if not configured() or not openid:
        return
    payload: dict[str, Any] = {
        "appid": WECHAT_PAY_APP_ID,
        "type": "PERSONAL_OPENID",
        "account": openid,
        "relation_type": "PARTNER",
    }
    try:
        _request("POST", "/v3/profitsharing/receivers/add", payload)
    except Exception as exc:
        if "已存在" in str(exc) or "EXIST" in str(exc).upper():
            return
        log.warning("add personal receiver failed: %s", exc)
        raise


def _existing_profit_share(payment_order_id: str) -> dict[str, Any] | None:
    with db_cursor() as cur:
        cur.execute("SELECT * FROM profit_share_orders WHERE payment_order_id=?", (payment_order_id,))
        row = cur.fetchone()
        return dict(row) if row else None


def _insert_held_share(
    *,
    payment_order_id: str,
    org_id: str | None,
    referrer_user_id: str | None,
    beneficiary_kind: str,
    rate_bps: int,
    share_fen: int,
    share_after: datetime,
) -> dict[str, Any] | None:
    psid = f"ps-{uuid.uuid4().hex[:16]}"
    with db_cursor() as cur:
        cur.execute(
            """
            INSERT INTO profit_share_orders
              (id, payment_order_id, org_id, referrer_user_id, beneficiary_kind,
               rate_bps, share_fen, wx_state, wx_order_id, error_message,
               share_after_at, created_at, updated_at)
            VALUES (?,?,?,?,?,?,?,'held',NULL,NULL,?,?,?)
            """,
            (
                psid,
                payment_order_id,
                org_id,
                referrer_user_id,
                beneficiary_kind,
                rate_bps,
                share_fen,
                share_after.isoformat(),
                now_iso(),
                now_iso(),
            ),
        )
        cur.execute("SELECT * FROM profit_share_orders WHERE id=?", (psid,))
        row = cur.fetchone()
        return dict(row) if row else None


def schedule_profit_share_for_order(payment_order_id: str) -> dict[str, Any] | None:
    """Record a held share. Do not call WeChat until share_after_at."""
    order = get_payment_order(payment_order_id)
    if not order or order.get("status") != "paid":
        return None
    existing = _existing_profit_share(payment_order_id)
    if existing:
        return existing
    share_after = hold_deadline(order.get("paid_at"))

    org_id = order.get("org_id")
    if org_id:
        scheduled = _schedule_org_share(payment_order_id, order, org_id, share_after)
        if scheduled:
            return scheduled

    referrer_user_id = order.get("referrer_user_id")
    if referrer_user_id:
        scheduled = _schedule_learner_share(payment_order_id, order, referrer_user_id, share_after)
        if scheduled:
            return scheduled

    # Direct sale (or zero-rate channel): still freeze 7 days, then unfreeze to platform.
    return _insert_held_share(
        payment_order_id=payment_order_id,
        org_id=None,
        referrer_user_id=None,
        beneficiary_kind="platform",
        rate_bps=0,
        share_fen=0,
        share_after=share_after,
    )


def request_profit_share_for_order(payment_order_id: str) -> dict[str, Any] | None:
    """Back-compat name: schedule only, never submit immediately."""
    return schedule_profit_share_for_order(payment_order_id)


def _schedule_org_share(
    payment_order_id: str, order: dict[str, Any], org_id: str, share_after: datetime
) -> dict[str, Any] | None:
    with db_cursor() as cur:
        cur.execute("SELECT * FROM organizations WHERE id=?", (org_id,))
        org = cur.fetchone()
    if not org:
        return None
    org = dict(org)
    paid_before = org_paid_user_count(org_id, before_order_id=payment_order_id)
    rate_bps = match_commission_rate_bps(org_id, paid_before)
    amount_fen = int(order.get("amount_fen") or 0)
    share_fen = amount_fen * rate_bps // 10000 if rate_bps > 0 else 0
    if share_fen <= 0:
        return None
    return _insert_held_share(
        payment_order_id=payment_order_id,
        org_id=org_id,
        referrer_user_id=None,
        beneficiary_kind="org",
        rate_bps=rate_bps,
        share_fen=share_fen,
        share_after=share_after,
    )


def _schedule_learner_share(
    payment_order_id: str, order: dict[str, Any], referrer_user_id: str, share_after: datetime
) -> dict[str, Any] | None:
    invite_count = count_learner_invites(referrer_user_id)
    rate_bps = match_learner_rate_bps(invite_count)
    amount_fen = int(order.get("amount_fen") or 0)
    share_fen = amount_fen * rate_bps // 10000 if rate_bps > 0 else 0
    if share_fen <= 0:
        return None
    return _insert_held_share(
        payment_order_id=payment_order_id,
        org_id=None,
        referrer_user_id=referrer_user_id,
        beneficiary_kind="learner",
        rate_bps=rate_bps,
        share_fen=share_fen,
        share_after=share_after,
    )


def cancel_open_share(payment_order_id: str) -> dict[str, Any] | None:
    """Cancel a not-yet-submitted share so a refund can proceed.

    Returns the cancelled row, or None if there was no open share.
    Raises ValueError if WeChat split is already in flight / finished.
    """
    with db_cursor() as cur:
        cur.execute(
            "SELECT * FROM profit_share_orders WHERE payment_order_id=?",
            (payment_order_id,),
        )
        row = cur.fetchone()
        if not row:
            return None
        row = dict(row)
        state = str(row.get("wx_state") or "")
        if state in BLOCK_REFUND_STATES:
            raise ValueError("订单已过账期或正在分账，无法退款")
        if state == "cancelled":
            return row
        cur.execute(
            """
            UPDATE profit_share_orders
            SET wx_state='cancelled', error_message='refund_before_share', updated_at=?
            WHERE payment_order_id=? AND wx_state IN ('held','pending','pending_manual','failed')
            RETURNING *
            """,
            (now_iso(), payment_order_id),
        )
        updated = cur.fetchone()
        if not updated:
            raise ValueError("订单已过账期或正在分账，无法退款")
        return dict(updated)


def restore_cancelled_share(payment_order_id: str) -> None:
    """If WeChat refund was rejected, put a cancelled hold back to held."""
    with db_cursor() as cur:
        cur.execute(
            """
            UPDATE profit_share_orders
            SET wx_state='held', error_message=NULL, updated_at=?
            WHERE payment_order_id=? AND wx_state='cancelled'
              AND COALESCE(error_message,'') = 'refund_before_share'
            """,
            (now_iso(), payment_order_id),
        )


def _receiver_for_row(row: dict[str, Any]) -> tuple[str | None, str | None, Any]:
    kind = row.get("beneficiary_kind") or "org"
    if kind == "org" and row.get("org_id"):
        with db_cursor() as cur:
            cur.execute("SELECT * FROM organizations WHERE id=?", (row["org_id"],))
            org = cur.fetchone()
        if not org:
            return None, None, None
        org = dict(org)
        return org.get("wx_receiver_type"), org.get("wx_receiver_account"), lambda: _ensure_org_receiver(org)
    if kind == "learner" and row.get("referrer_user_id"):
        with db_cursor() as cur:
            cur.execute("SELECT wx_mp_openid FROM users WHERE id=?", (row["referrer_user_id"],))
            urow = cur.fetchone()
        openid = ((dict(urow).get("wx_mp_openid") if urow else None) or "").strip()
        if not openid:
            return None, None, None
        return "PERSONAL_OPENID", openid, lambda: _ensure_personal_receiver(openid)
    return None, None, None


def _mark_share(
    psid: str,
    *,
    wx_state: str,
    wx_order_id: str | None = None,
    error_message: str | None = None,
    retry_minutes: int | None = None,
) -> None:
    with db_cursor() as cur:
        if retry_minutes and retry_minutes > 0:
            cur.execute(
                """
                UPDATE profit_share_orders
                SET wx_state=?,
                    wx_order_id=COALESCE(?, wx_order_id),
                    error_message=?,
                    share_after_at=NOW() + (? * INTERVAL '1 minute'),
                    updated_at=?
                WHERE id=?
                """,
                (wx_state, wx_order_id, error_message, retry_minutes, now_iso(), psid),
            )
        else:
            cur.execute(
                """
                UPDATE profit_share_orders
                SET wx_state=?,
                    wx_order_id=COALESCE(?, wx_order_id),
                    error_message=?,
                    updated_at=?
                WHERE id=?
                """,
                (wx_state, wx_order_id, error_message, now_iso(), psid),
            )


def _unfreeze_remaining(transaction_id: str, out_no: str, description: str) -> dict[str, Any]:
    payload = {
        "transaction_id": transaction_id,
        "out_order_no": out_no,
        "description": description[:80],
    }
    return _request("POST", "/v3/profitsharing/orders/unfreeze", payload)


def _submit_claimed_row(row: dict[str, Any]) -> None:
    psid = row["id"]
    order = get_payment_order(row["payment_order_id"])
    if not order or order.get("status") != "paid":
        _mark_share(psid, wx_state="cancelled", error_message="payment_not_paid")
        return
    tx = (order.get("wx_transaction_id") or "").strip()
    kind = row.get("beneficiary_kind") or "org"
    share_fen = int(row.get("share_fen") or 0)
    receiver_type, receiver_account, ensure_receiver = _receiver_for_row(row)

    if not configured():
        _mark_share(
            psid,
            wx_state="pending_manual",
            error_message="微信支付未配置，仅记录应分金额",
            retry_minutes=60,
        )
        return

    if not tx:
        _mark_share(psid, wx_state="held", error_message="缺少微信 transaction_id，稍后重试", retry_minutes=5)
        return

    out_no = row.get("wx_order_id") or f"PS{uuid.uuid4().hex[:16].upper()}"
    try:
        if kind == "platform" or share_fen <= 0:
            _unfreeze_remaining(tx, out_no, "7天账期完结")
            _mark_share(psid, wx_state="finished", wx_order_id=out_no, error_message=None)
            return
        if not receiver_type or not receiver_account:
            _mark_share(
                psid,
                wx_state="pending_manual",
                error_message="未配置微信分账接收方，仅记录应分金额",
                retry_minutes=30,
            )
            return
        if ensure_receiver:
            ensure_receiver()
        description = "机构渠道分账" if kind == "org" else "学员邀请分账"
        payload = {
            "appid": WECHAT_PAY_APP_ID,
            "transaction_id": tx,
            "out_order_no": out_no,
            "receivers": [
                {
                    "type": receiver_type,
                    "account": receiver_account,
                    "amount": share_fen,
                    "description": description,
                }
            ],
            "unfreeze_unsplit": True,
        }
        data = _request("POST", "/v3/profitsharing/orders", payload)
        state = "processing"
        if str(data.get("state") or "").upper() in ("FINISHED", "SUCCESS"):
            state = "finished"
        _mark_share(psid, wx_state=state, wx_order_id=out_no, error_message=None)
    except Exception as exc:
        log.warning("profit sharing submit failed %s: %s", psid, exc)
        _mark_share(
            psid,
            wx_state="failed",
            wx_order_id=out_no,
            error_message=str(exc)[:500],
            retry_minutes=15,
        )


def _claim_due_share() -> dict[str, Any] | None:
    with db_cursor() as cur:
        cur.execute(
            """
            SELECT ps2.id
            FROM profit_share_orders ps2
            JOIN payment_orders po ON po.id = ps2.payment_order_id
            WHERE po.status='paid'
              AND (
                ps2.wx_state IN ('held','pending','failed')
                OR (ps2.wx_state='submitting' AND ps2.updated_at < NOW() - INTERVAL '2 minutes')
                OR (
                  ps2.wx_state='pending_manual'
                  AND (
                    ps2.beneficiary_kind='platform'
                    OR (
                      ps2.beneficiary_kind='org'
                      AND EXISTS (
                        SELECT 1 FROM organizations o
                        WHERE o.id = ps2.org_id
                          AND COALESCE(o.wx_receiver_account,'') <> ''
                      )
                    )
                    OR (
                      ps2.beneficiary_kind='learner'
                      AND EXISTS (
                        SELECT 1 FROM users u
                        WHERE u.id = ps2.referrer_user_id
                          AND COALESCE(u.wx_mp_openid,'') <> ''
                      )
                    )
                  )
                )
              )
              AND ps2.share_after_at IS NOT NULL
              AND ps2.share_after_at <= NOW()
            ORDER BY ps2.share_after_at ASC, ps2.created_at ASC
            LIMIT 1
            FOR UPDATE OF ps2 SKIP LOCKED
            """,
        )
        claimed = cur.fetchone()
        if not claimed:
            return None
        cur.execute(
            """
            UPDATE profit_share_orders
            SET wx_state='submitting', updated_at=?
            WHERE id=?
            RETURNING *
            """,
            (now_iso(), claimed["id"]),
        )
        row = cur.fetchone()
        return dict(row) if row else None


def submit_due_shares(limit: int = 20) -> int:
    """Submit held shares whose 7-day window has closed."""
    submitted = 0
    for _ in range(max(1, limit)):
        row = _claim_due_share()
        if not row:
            break
        _submit_claimed_row(row)
        submitted += 1
    return submitted


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
                _mark_share(row["id"], wx_state=new_state, error_message=err)
                updated += 1
        except Exception as exc:
            log.warning("sync profit share %s failed: %s", row.get("id"), exc)
    return updated


def retry_pending_shares(limit: int = 20) -> int:
    """Submit shares that are due (hold elapsed) and not yet finished."""
    sync_profit_share_statuses(limit=limit)
    return submit_due_shares(limit=limit)


def tick(limit: int = 20) -> int:
    """Periodic: sync in-flight splits, then submit due holds."""
    try:
        sync_profit_share_statuses(limit=limit)
    except Exception:
        log.exception("sync profit share statuses failed")
    try:
        return submit_due_shares(limit=limit)
    except Exception:
        log.exception("submit due profit shares failed")
        return 0
