"""Refunds — 7-day window, before WeChat profit sharing."""

from __future__ import annotations

import logging
import uuid
from datetime import datetime
from typing import Any

from services.billing import profit_sharing, wechat_pay
from services.shared import db_cursor, now_iso
from services.shared.config import FDE_ENV

log = logging.getLogger("fde.billing.refund")


class RefundError(ValueError):
    pass


def refund_eligibility(order: dict[str, Any], *, now: datetime | None = None) -> tuple[bool, str]:
    status = str(order.get("status") or "")
    if status == "refunded":
        return False, "订单已退款"
    if status == "refunding":
        return False, "退款处理中"
    if status != "paid":
        return False, "订单状态不可退款"
    share = profit_sharing._existing_profit_share(order["id"])
    if share and str(share.get("wx_state") or "") in profit_sharing.BLOCK_REFUND_STATES:
        return False, "已过7天账期并已分账，无法退款"
    if not profit_sharing.refund_window_open(order, now=now):
        return False, "已满7天，无法退款"
    return True, ""


def refund_until_iso(order: dict[str, Any]) -> str | None:
    paid = profit_sharing.as_utc(order.get("paid_at"))
    if not paid:
        return None
    return profit_sharing.hold_deadline(paid).isoformat()


def _revoke_access(order: dict[str, Any]) -> None:
    user_id = order.get("user_id")
    offering_id = order.get("offering_id")
    if not user_id or not offering_id:
        return
    with db_cursor() as cur:
        cur.execute(
            """
            UPDATE enrollment_records
            SET status='dropped'
            WHERE user_id=? AND offering_id=? AND status='active'
            """,
            (user_id, offering_id),
        )
        cur.execute("SELECT camp_id FROM course_offerings WHERE id=?", (offering_id,))
        row = cur.fetchone()
        camp_id = dict(row).get("camp_id") if row else None
        if camp_id:
            cur.execute(
                """
                UPDATE enrollments
                SET status='dropped'
                WHERE user_id=? AND camp_id=? AND status='active'
                """,
                (user_id, camp_id),
            )


def finalize_refunded(order_id: str, *, refund_id: str | None = None, refund_fen: int | None = None) -> dict[str, Any]:
    order = wechat_pay.get_payment_order(order_id)
    if not order:
        raise RefundError("订单不存在")
    if order.get("status") == "refunded":
        return order
    with db_cursor() as cur:
        cur.execute(
            """
            UPDATE payment_orders
            SET status='refunded',
                refunded_at=COALESCE(refunded_at, ?),
                refund_fen=COALESCE(?, refund_fen, amount_fen),
                wx_refund_id=COALESCE(?, wx_refund_id),
                updated_at=?
            WHERE id=? AND status IN ('paid','refunding')
            """,
            (now_iso(), refund_fen, refund_id, now_iso(), order_id),
        )
    order = wechat_pay.get_payment_order(order_id) or order
    try:
        _revoke_access(order)
    except Exception:
        log.exception("revoke access after refund failed for %s", order_id)
    return wechat_pay.get_payment_order(order_id) or order


def _mark_refunding(order_id: str, out_refund_no: str) -> None:
    with db_cursor() as cur:
        cur.execute(
            """
            UPDATE payment_orders
            SET status='refunding', out_refund_no=?, updated_at=?
            WHERE id=? AND status='paid'
            """,
            (out_refund_no, now_iso(), order_id),
        )


def _restore_paid(order_id: str) -> None:
    with db_cursor() as cur:
        cur.execute(
            """
            UPDATE payment_orders
            SET status='paid', out_refund_no=NULL, updated_at=?
            WHERE id=? AND status='refunding'
            """,
            (now_iso(), order_id),
        )


def request_refund(order_id: str, *, reason: str = "用户退款", actor_id: str | None = None) -> dict[str, Any]:
    order = wechat_pay.get_payment_order(order_id)
    if not order:
        raise RefundError("订单不存在")
    ok, msg = refund_eligibility(order)
    if not ok:
        raise RefundError(msg)

    try:
        profit_sharing.cancel_open_share(order_id)
    except ValueError as exc:
        raise RefundError(str(exc)) from exc

    out_refund_no = order.get("out_refund_no") or f"RF{uuid.uuid4().hex[:16].upper()}"
    _mark_refunding(order["id"], out_refund_no)
    channel = order.get("pay_channel") or "wechat"
    amount_fen = int(order.get("amount_fen") or 0)

    try:
        if channel == "alipay":
            from services.billing import alipay_pay

            if alipay_pay.configured():
                data = alipay_pay.create_refund(order, out_refund_no=out_refund_no, reason=reason)
                fund = str(data.get("fund_change") or "").upper()
                if fund in ("Y", "SUCCESS") or data.get("gmt_refund_pay") or data.get("refund_fee"):
                    return finalize_refunded(order["id"], refund_id=data.get("trade_no"), refund_fen=amount_fen)
            elif FDE_ENV != "prod":
                return finalize_refunded(order["id"], refund_id=f"DEV-RF-{order['id'][:8]}", refund_fen=amount_fen)
            else:
                raise RefundError("支付宝未配置，无法退款")
        else:
            if wechat_pay.configured():
                data = wechat_pay.create_refund(order, out_refund_no=out_refund_no, reason=reason)
                status = str(data.get("status") or "").upper()
                refund_id = data.get("refund_id")
                with db_cursor() as cur:
                    cur.execute(
                        "UPDATE payment_orders SET wx_refund_id=COALESCE(?, wx_refund_id), updated_at=? WHERE id=?",
                        (refund_id, now_iso(), order["id"]),
                    )
                if status in ("SUCCESS", "CLOSED"):
                    if status == "SUCCESS":
                        return finalize_refunded(order["id"], refund_id=refund_id, refund_fen=amount_fen)
                    raise RefundError("微信退款已关闭")
                # PROCESSING: wait for notify
                return wechat_pay.get_payment_order(order["id"]) or order
            if FDE_ENV != "prod":
                return finalize_refunded(order["id"], refund_id=f"DEV-RF-{order['id'][:8]}", refund_fen=amount_fen)
            raise RefundError("微信支付未配置，无法退款")
    except RefundError:
        _restore_paid(order["id"])
        profit_sharing.restore_cancelled_share(order["id"])
        raise
    except Exception as exc:
        log.exception("refund API failed for %s", order_id)
        _restore_paid(order["id"])
        profit_sharing.restore_cancelled_share(order["id"])
        raise RefundError(f"退款请求失败：{exc}") from exc
