"""Partner portal API — read-only dashboard."""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel

_ROOT = Path(__file__).resolve().parents[2]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from services.partners import service as partners  # noqa: E402
from services.shared import (  # noqa: E402
    AuthUser,
    authenticate,
    create_access_token,
    create_refresh_session,
    db_cursor,
    init_schema,
    now_iso,
    verify_password,
    write_audit,
)
from services.shared.config import FDE_ENV  # noqa: E402
from services.shared.auth_constants import set_auth_cookies  # noqa: E402
from services.shared.middleware import require_user  # noqa: E402

router = APIRouter(tags=["partner"])
init_schema()


class PartnerLoginBody(BaseModel):
    email: str
    password: str


def _set_auth_cookies(resp: Response, access: str, refresh: str, csrf: str) -> None:
    set_auth_cookies(resp, access, refresh, csrf)


def _partner_org_id(user_id: str) -> str | None:
    with db_cursor() as cur:
        cur.execute(
            """
            SELECT oa.org_id FROM org_accounts oa
            JOIN users u ON LOWER(u.email) = LOWER(oa.email)
            WHERE u.id=? AND oa.status='active'
            LIMIT 1
            """,
            (user_id,),
        )
        row = cur.fetchone()
        return row["org_id"] if row else None


def _require_partner(request: Request) -> tuple[AuthUser, str]:
    user = require_user(request)
    if user.role != "partner" and user.role != "admin":
        raise HTTPException(403, "需要机构账号")
    org_id = _partner_org_id(user.id)
    if not org_id and user.role == "admin":
        org_id = request.query_params.get("org_id")
    if not org_id:
        raise HTTPException(403, "未关联机构")
    return user, org_id


@router.post("/api/v1/partner/auth/login")
def partner_login(body: PartnerLoginBody, request: Request, response: Response) -> dict[str, Any]:
    email = body.email.strip().lower()
    with db_cursor() as cur:
        cur.execute(
            """
            SELECT oa.*, u.id AS user_id, u.role
            FROM org_accounts oa
            JOIN users u ON LOWER(u.email) = LOWER(oa.email)
            WHERE LOWER(oa.email)=? AND oa.status='active'
            """,
            (email,),
        )
        row = cur.fetchone()
    if not row:
        user = authenticate(email, body.password)
        if not user or user.role not in ("partner", "admin"):
            raise HTTPException(401, "邮箱或密码错误")
    else:
        row = dict(row)
        if not verify_password(body.password, row["password_hash"]):
            raise HTTPException(401, "邮箱或密码错误")
        user = AuthUser(
            id=row["user_id"],
            email=email,
            role=row.get("role") or "partner",
            display_name=row.get("display_name"),
        )
    import secrets

    access = create_access_token(user, None)
    _, refresh = create_refresh_session(
        user.id,
        None,
        user_agent=request.headers.get("user-agent"),
        ip=request.client.host if request.client else None,
    )
    csrf = secrets.token_urlsafe(24)
    _set_auth_cookies(response, access, refresh, csrf)
    org_id = _partner_org_id(user.id)
    write_audit("partner.login", actor_id=user.id, details={"org_id": org_id})
    return {
        "token": access,
        "csrf": csrf,
        "user": {"id": user.id, "email": user.email, "role": user.role, "display_name": user.display_name},
        "org_id": org_id,
    }


@router.get("/api/v1/partner/dashboard")
def dashboard(request: Request) -> dict[str, Any]:
    user, org_id = _require_partner(request)
    org = partners.get_organization(org_id)
    if not org:
        raise HTTPException(404, "机构不存在")
    stats = partners.org_dashboard_stats(org_id)
    return {"org": org, "stats": stats, "user": {"id": user.id, "email": user.email}}


@router.get("/api/v1/partner/attributions")
def partner_attributions(request: Request) -> dict[str, Any]:
    _, org_id = _require_partner(request)
    return {"items": partners.list_org_attributions(org_id, limit=200)}


@router.get("/api/v1/partner/profit-shares")
def partner_profit_shares(request: Request) -> dict[str, Any]:
    _, org_id = _require_partner(request)
    with db_cursor() as cur:
        cur.execute(
            """
            SELECT ps.*, po.out_trade_no, po.amount_fen, po.paid_at, u.email AS user_email
            FROM profit_share_orders ps
            JOIN payment_orders po ON po.id = ps.payment_order_id
            JOIN users u ON u.id = po.user_id
            WHERE ps.org_id=?
            ORDER BY ps.created_at DESC
            LIMIT 200
            """,
            (org_id,),
        )
        items = [dict(r) for r in cur.fetchall()]
    return {"items": items}
