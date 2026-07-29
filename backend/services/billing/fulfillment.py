"""Payment fulfillment — enrollment + profit sharing trigger."""

from __future__ import annotations

import logging

from services.application import EnrollmentService
from services.billing import profit_sharing
from services.shared import _pg_upsert_enrollment, db_cursor, now_iso

log = logging.getLogger("fde.billing.fulfillment")


def fulfill_paid_order(payment_order_id: str) -> None:
    with db_cursor() as cur:
        cur.execute("SELECT * FROM payment_orders WHERE id=?", (payment_order_id,))
        order = cur.fetchone()
        if not order:
            return
        order = dict(order)
        if order.get("status") != "paid":
            return
        cur.execute(
            "SELECT 1 FROM enrollment_records WHERE user_id=? AND offering_id=?",
            (order["user_id"], order["offering_id"]),
        )
        already = cur.fetchone()
    if not already:
        try:
            EnrollmentService().enroll(order["user_id"], order["offering_id"], status="active")
        except Exception:
            log.warning("enrollment failed for order %s", payment_order_id, exc_info=True)
        with db_cursor() as cur:
            cur.execute(
                """
                SELECT co.camp_id FROM course_offerings co WHERE co.id=?
                """,
                (order["offering_id"],),
            )
            row = cur.fetchone()
            if row and row.get("camp_id"):
                _pg_upsert_enrollment(cur, order["user_id"], row["camp_id"])
            cur.execute(
                """
                UPDATE enrollment_records SET source='wechat_pay'
                WHERE user_id=? AND offering_id=?
                """,
                (order["user_id"], order["offering_id"]),
            )
    try:
        profit_sharing.request_profit_share_for_order(payment_order_id)
    except Exception:
        log.warning("profit share failed for %s", payment_order_id, exc_info=True)
