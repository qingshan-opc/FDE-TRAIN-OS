"""Billing API — checkout, notify, sync (WeChat + Alipay)."""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Any, Literal

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel, Field

_PKG_ROOT = Path(__file__).resolve().parents[2]
if str(_PKG_ROOT) not in sys.path:
    sys.path.insert(0, str(_PKG_ROOT))
from services.shared.config import ROOT as _ROOT  # noqa: E402

from services.billing import alipay_pay, profit_sharing, wechat_pay  # noqa: E402
from services.partners.service import get_user_attribution  # noqa: E402
from services.referral.service import get_user_referral  # noqa: E402
from services.shared import db_cursor, init_schema  # noqa: E402
from services.shared.config import FDE_ENV  # noqa: E402
from services.shared.middleware import require_user  # noqa: E402

router = APIRouter(tags=["billing"])
init_schema()

PayChannel = Literal["wechat", "alipay"]
PayMode = Literal["auto", "native", "jsapi"]


class CheckoutBody(BaseModel):
    offering_id: str
    channel: PayChannel = Field(default="wechat")
    # auto: backend decides (jsapi when WeChat + openid available and client asks jsapi)
    pay_mode: PayMode = Field(default="auto")


def _channel_configured(channel: PayChannel) -> bool:
    if channel == "alipay":
        return alipay_pay.configured()
    return wechat_pay.configured()


def _sync_by_channel(order: dict[str, Any]) -> str:
    channel = order.get("pay_channel") or "wechat"
    if channel == "alipay":
        return alipay_pay.sync_order_status(order["id"])
    return wechat_pay.sync_order_status(order["id"])


def _checkout_payload(
    *,
    order: dict[str, Any],
    channel: PayChannel,
    pay_mode: str,
    reused: bool,
) -> dict[str, Any]:
    code_url = order.get("code_url")
    out: dict[str, Any] = {
        "order_id": order["id"],
        "out_trade_no": order["out_trade_no"],
        "amount_fen": int(order["amount_fen"]),
        "code_url": None if wechat_pay.is_jsapi_code_url(code_url) else code_url,
        "pay_channel": channel,
        "pay_mode": pay_mode,
        "dev_mode": not _channel_configured(channel),
        "status": order.get("status") or "pending",
        "reused": reused,
    }
    if channel == "wechat" and pay_mode == "jsapi":
        prepay_id = wechat_pay.prepay_id_from_code_url(code_url)
        if prepay_id:
            out["jsapi_params"] = wechat_pay.build_jsapi_pay_params(prepay_id)
        elif FDE_ENV != "prod" and not _channel_configured(channel):
            out["jsapi_params"] = wechat_pay.build_jsapi_pay_params(f"dev-{order['out_trade_no']}")
    return out


@router.post("/api/v1/billing/checkout")
def checkout(body: CheckoutBody, request: Request) -> dict[str, Any]:
    user = require_user(request)
    channel: PayChannel = body.channel or "wechat"
    # Soft-hide Alipay for everyone except the allowlisted demo/partner account.
    if channel == "alipay" and (user.email or "").strip().lower() != "partner@fde.local":
        raise HTTPException(403, "支付宝暂未开放")
    # Frontend sends pay_mode=jsapi inside WeChat; desktop keeps native QR.
    want_jsapi = channel == "wechat" and body.pay_mode == "jsapi"

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
        # Reuse recent pending order only when amount still matches current offering price.
        # Otherwise a price change (e.g. ¥1 → ¥1980) would keep charging the old QR/JSAPI amount.
        if want_jsapi:
            cur.execute(
                """
                SELECT id, out_trade_no, amount_fen, code_url, status, org_id, referrer_user_id, pay_channel
                FROM payment_orders
                WHERE user_id=? AND offering_id=? AND status='pending'
                  AND COALESCE(pay_channel, 'wechat')=?
                  AND amount_fen=?
                  AND created_at > NOW() - INTERVAL '2 hours'
                  AND code_url LIKE ?
                ORDER BY created_at DESC
                LIMIT 1
                """,
                (user.id, body.offering_id, channel, price, "jsapi:%"),
            )
        else:
            cur.execute(
                """
                SELECT id, out_trade_no, amount_fen, code_url, status, org_id, referrer_user_id, pay_channel
                FROM payment_orders
                WHERE user_id=? AND offering_id=? AND status='pending'
                  AND COALESCE(pay_channel, 'wechat')=?
                  AND amount_fen=?
                  AND created_at > NOW() - INTERVAL '2 hours'
                  AND code_url IS NOT NULL AND code_url <> ''
                  AND code_url NOT LIKE ?
                ORDER BY created_at DESC
                LIMIT 1
                """,
                (user.id, body.offering_id, channel, price, "jsapi:%"),
            )
        pending = cur.fetchone()
        # Invalidate stale pending rows for this offering whose amount no longer matches.
        cur.execute(
            """
            UPDATE payment_orders
            SET status='expired', updated_at=NOW()
            WHERE user_id=? AND offering_id=? AND status='pending' AND amount_fen<>?
            """,
            (user.id, body.offering_id, price),
        )

    attr = get_user_attribution(user.id)
    org_id = attr.get("org_id") if attr else None
    referrer_user_id = None
    if not org_id:
        ref = get_user_referral(user.id)
        if ref:
            referrer_user_id = ref.get("referrer_user_id")

    pay_mode_out = "jsapi" if want_jsapi else "native"

    if pending:
        pending = dict(pending)
        stored_org = pending.get("org_id")
        stored_ref = pending.get("referrer_user_id")
        if stored_org != org_id or stored_ref != referrer_user_id:
            with db_cursor() as cur:
                cur.execute(
                    """
                    UPDATE payment_orders
                    SET org_id=?, referrer_user_id=?, updated_at=NOW()
                    WHERE id=? AND status='pending'
                    """,
                    (org_id, referrer_user_id, pending["id"]),
                )
        return _checkout_payload(order=pending, channel=channel, pay_mode=pay_mode_out, reused=True)

    title = offering.get("title") or offering.get("course_title") or "FDE 课程"
    description = f"购买 {title}"
    try:
        if channel == "alipay":
            order = alipay_pay.create_payment_order(
                user.id,
                body.offering_id,
                price,
                org_id,
                description,
                referrer_user_id=referrer_user_id,
            )
            pay_mode_out = "native"
        elif want_jsapi:
            openid = wechat_pay.get_user_wx_mp_openid(user.id)
            if not openid:
                from services.wechat_mp import entry as mp_entry
                from urllib.parse import quote

                next_path = "/app/shop"
                oauth_url = (
                    f"/api/v1/auth/wechat/mp-entry?next={quote(next_path, safe='')}"
                    if mp_entry.entry_configured()
                    else None
                )
                raise HTTPException(
                    status_code=409,
                    detail={
                        "code": "need_wechat_oauth",
                        "message": "微信内支付需要先完成微信授权登录",
                        "oauth_url": oauth_url,
                    },
                )
            order = wechat_pay.create_payment_order(
                user.id,
                body.offering_id,
                price,
                org_id,
                description,
                referrer_user_id=referrer_user_id,
                trade_type="jsapi",
                openid=openid,
            )
            pay_mode_out = "jsapi"
        else:
            order = wechat_pay.create_payment_order(
                user.id,
                body.offering_id,
                price,
                org_id,
                description,
                referrer_user_id=referrer_user_id,
                trade_type="native",
            )
            pay_mode_out = "native"
    except HTTPException:
        raise
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(503, str(exc)) from exc
    return _checkout_payload(order=order, channel=channel, pay_mode=pay_mode_out, reused=False)


@router.get("/api/v1/billing/orders/{order_id}")
def get_order(order_id: str, request: Request) -> dict[str, Any]:
    user = require_user(request)
    order = wechat_pay.get_payment_order(order_id)
    if not order or order.get("user_id") != user.id:
        raise HTTPException(404, "订单不存在")
    status = order.get("status")
    if status == "pending":
        status = _sync_by_channel(order)
        order = wechat_pay.get_payment_order(order_id) or order
        order["status"] = status
    return {"order": order}


@router.post("/api/v1/billing/orders/{order_id}/sync")
def sync_order(order_id: str, request: Request) -> dict[str, Any]:
    user = require_user(request)
    order = wechat_pay.get_payment_order(order_id)
    if not order or order.get("user_id") != user.id:
        raise HTTPException(404, "订单不存在")
    status = _sync_by_channel(order)
    if (order.get("pay_channel") or "wechat") == "wechat":
        profit_sharing.retry_pending_shares()
        profit_sharing.sync_profit_share_statuses()
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


@router.post("/api/v1/billing/alipay/notify")
async def alipay_notify(request: Request) -> PlainTextResponse:
    """Alipay async notify — must reply plain text `success` / `failure`."""
    form = await request.form()
    params = {str(k): str(v) for k, v in form.items()}
    result = alipay_pay.handle_notify(params)
    if not result.ok and result.error and result.error != "duplicate":
        return PlainTextResponse("failure", status_code=200)
    return PlainTextResponse("success")


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
                   co.course_version_id,
                   c.title AS course_title, c.slug AS course_slug,
                   c.description AS course_description
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
            vid = it.pop("course_version_id", None)
            modules: list[dict[str, Any]] = []
            if vid:
                cur.execute(
                    """
                    SELECT day_index, title
                    FROM course_modules
                    WHERE course_version_id=?
                    ORDER BY sort_order, day_index
                    LIMIT 12
                    """,
                    (vid,),
                )
                modules = [dict(r) for r in cur.fetchall()]
            it["modules"] = modules
            it["module_count"] = len(modules)
            # Prefer richer catalog description; thin migration stubs are OK for UI fallback
            it["description"] = it.pop("course_description", None) or ""
            it["cover_image"] = "/landing/hero.png"
            if (it.get("course_slug") or "").startswith("fde"):
                it["cover_image"] = "/landing/hero.png"
                it["gallery"] = [
                    "/landing/story-task.png",
                    "/landing/story-agent.png",
                    "/landing/story-cert.png",
                ]
            else:
                it["gallery"] = [
                    "/landing/story-task.png",
                    "/landing/story-agent.png",
                    "/landing/story-cert.png",
                ]
    return {"items": items}
