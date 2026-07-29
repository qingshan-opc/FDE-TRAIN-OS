"""Billing API — checkout, notify, sync."""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

_PKG_ROOT = Path(__file__).resolve().parents[2]
if str(_PKG_ROOT) not in sys.path:
    sys.path.insert(0, str(_PKG_ROOT))
from services.shared.config import ROOT as _ROOT  # noqa: E402

from services.billing import profit_sharing, wechat_pay  # noqa: E402
from services.partners.service import get_user_attribution  # noqa: E402
from services.shared import db_cursor, init_schema  # noqa: E402
from services.shared.config import FDE_ENV  # noqa: E402
from services.shared.middleware import require_user  # noqa: E402

router = APIRouter(tags=["billing"])
init_schema()


class CheckoutBody(BaseModel):
    offering_id: str


@router.post("/api/v1/billing/checkout")
def checkout(body: CheckoutBody, request: Request) -> dict[str, Any]:
    user = require_user(request)
    with db_cursor() as cur:
        cur.execute(
            """
            SELECT co.id, co.price_fen, co.title, co.camp_id, cv.course_id, c.title AS course_title
            FROM course_offerings co
            LEFT JOIN course_versions cv ON cv.id = co.course_version_id
            LEFT JOIN courses c ON c.id = cv.course_id
            WHERE co.id=?
            """,
            (body.offering_id,),
        )
        offering = cur.fetchone()
        if not offering:
            raise HTTPException(404, "课程 offering 不存在")
        offering = dict(offering)
        price = int(offering.get("price_fen") or 0)
        if price <= 0:
            raise HTTPException(400, "该课程暂未开放付费")
        cur.execute(
            """
            SELECT 1 FROM payment_orders
            WHERE user_id=? AND offering_id=? AND status='paid'
            """,
            (user.id, body.offering_id),
        )
        if cur.fetchone():
            raise HTTPException(409, "您已购买该课程")
        cur.execute(
            """
            SELECT 1 FROM enrollment_records WHERE user_id=? AND offering_id=?
            """,
            (user.id, body.offering_id),
        )
        if cur.fetchone():
            raise HTTPException(409, "您已拥有该课程")
    attr = get_user_attribution(user.id)
    org_id = attr.get("org_id") if attr else None
    title = offering.get("title") or offering.get("course_title") or "FDE 课程"
    try:
        order = wechat_pay.create_payment_order(
            user.id, body.offering_id, price, org_id, f"购买 {title}"
        )
    except RuntimeError as exc:
        raise HTTPException(503, str(exc)) from exc
    return {
        "order_id": order["id"],
        "out_trade_no": order["out_trade_no"],
        "amount_fen": order["amount_fen"],
        "code_url": order.get("code_url"),
        "dev_mode": not wechat_pay.configured(),
        "status": order.get("status"),
    }


@router.get("/api/v1/billing/orders/{order_id}")
def get_order(order_id: str, request: Request) -> dict[str, Any]:
    user = require_user(request)
    order = wechat_pay.get_payment_order(order_id)
    if not order or order.get("user_id") != user.id:
        raise HTTPException(404, "订单不存在")
    status = order.get("status")
    if status == "pending":
        status = wechat_pay.sync_order_status(order_id)
        order = wechat_pay.get_payment_order(order_id) or order
        order["status"] = status
    return {"order": order}


@router.post("/api/v1/billing/orders/{order_id}/sync")
def sync_order(order_id: str, request: Request) -> dict[str, Any]:
    user = require_user(request)
    order = wechat_pay.get_payment_order(order_id)
    if not order or order.get("user_id") != user.id:
        raise HTTPException(404, "订单不存在")
    status = wechat_pay.sync_order_status(order_id)
    profit_sharing.retry_pending_shares()
    order = wechat_pay.get_payment_order(order_id)
    return {"status": status, "order": order}


@router.post("/api/v1/billing/wechat/notify")
async def wechat_notify(request: Request) -> dict[str, str]:
    body = await request.body()
    headers = dict(request.headers)
    result = wechat_pay.handle_notify(headers, body)
    if not result.ok and result.error and result.error != "duplicate":
        raise HTTPException(400, result.error or "notify failed")
    return {"code": "SUCCESS", "message": "成功"}


@router.post("/api/v1/billing/dev/mark-paid/{order_id}")
def dev_mark_paid(order_id: str, request: Request) -> dict[str, Any]:
    if FDE_ENV == "prod":
        raise HTTPException(404)
    user = require_user(request)
    order = wechat_pay.get_payment_order(order_id)
    if not order or order.get("user_id") != user.id:
        raise HTTPException(404, "订单不存在")
    updated = wechat_pay.mark_order_paid(order_id, f"DEV-{order_id[:8]}")
    return {"order": updated}


@router.get("/api/v1/billing/offerings")
def list_purchasable_offerings(request: Request) -> dict[str, Any]:
    user = require_user(request)
    with db_cursor() as cur:
        cur.execute(
            """
            SELECT co.id, co.title, co.price_fen, co.camp_id, co.status,
                   c.title AS course_title, c.slug AS course_slug
            FROM course_offerings co
            LEFT JOIN course_versions cv ON cv.id = co.course_version_id
            LEFT JOIN courses c ON c.id = cv.course_id
            WHERE co.price_fen > 0 AND co.status IN ('active','upcoming')
            ORDER BY co.created_at DESC
            """
        )
        items = [dict(r) for r in cur.fetchall()]
        for it in items:
            cur.execute(
                "SELECT 1 FROM payment_orders WHERE user_id=? AND offering_id=? AND status='paid'",
                (user.id, it["id"]),
            )
            it["purchased"] = bool(cur.fetchone())
            cur.execute(
                "SELECT 1 FROM enrollment_records WHERE user_id=? AND offering_id=?",
                (user.id, it["id"]),
            )
            it["enrolled"] = bool(cur.fetchone())
    return {"items": items}
