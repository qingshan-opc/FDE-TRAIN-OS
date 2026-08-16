"""Author partner/channel management APIs."""

from __future__ import annotations

import sys
import uuid
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

_PKG_ROOT = Path(__file__).resolve().parents[2]
if str(_PKG_ROOT) not in sys.path:
    sys.path.insert(0, str(_PKG_ROOT))
from services.shared.config import ROOT as _ROOT  # noqa: E402

from services.partners import service as partners  # noqa: E402
from services.shared import _hash_password, db_cursor, now_iso, write_audit  # noqa: E402
from services.shared.middleware import require_author  # noqa: E402

router = APIRouter(tags=["partners"])


class OrgBody(BaseModel):
    name: str
    status: str = "active"
    contact_name: str | None = None
    contact_email: str | None = None
    wx_receiver_type: str | None = None
    wx_receiver_account: str | None = None
    wx_receiver_name: str | None = None


class InviteCodeBody(BaseModel):
    code: str
    offering_id: str | None = None
    max_uses: int | None = None


class TierItem(BaseModel):
    min_paid_users: int = Field(ge=0)
    rate_bps: int = Field(ge=0, le=3000)


class TiersBody(BaseModel):
    tiers: list[TierItem]


class PartnerAccountBody(BaseModel):
    email: str
    password: str
    display_name: str = "机构管理员"


class ActivationCodeBody(BaseModel):
    note: str | None = None
    code: str | None = None
    expires_at: str | None = None


@router.get("/api/v1/author/partners/orgs")
def list_orgs(request: Request) -> dict[str, Any]:
    require_author(request)
    items = partners.list_organizations()
    for org in items:
        org["stats"] = partners.org_dashboard_stats(org["id"])
    return {"items": items}


@router.get("/api/v1/author/partners/activation-codes")
def list_activation_codes(request: Request) -> dict[str, Any]:
    require_author(request)
    return {"items": partners.list_activation_codes()}


@router.post("/api/v1/author/partners/activation-codes")
def create_activation_code(body: ActivationCodeBody, request: Request) -> dict[str, Any]:
    user = require_author(request)
    try:
        item = partners.create_activation_code(
            created_by=user.id,
            note=body.note,
            expires_at=body.expires_at,
            code=body.code,
        )
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    write_audit(
        "partner.create_activation_code",
        actor_id=user.id,
        resource_type="partner_activation_code",
        resource_id=item.get("id"),
        details={"code": item.get("code")},
    )
    return {"activation_code": item}


@router.post("/api/v1/author/partners/orgs")
def create_org(body: OrgBody, request: Request) -> dict[str, Any]:
    user = require_author(request)
    org = partners.create_organization(body.model_dump())
    write_audit("partner.create_org", actor_id=user.id, resource_type="organization", resource_id=org.get("id"))
    return {"org": org}


@router.put("/api/v1/author/partners/orgs/{org_id}")
def update_org(org_id: str, body: OrgBody, request: Request) -> dict[str, Any]:
    user = require_author(request)
    org = partners.update_organization(org_id, body.model_dump())
    if not org:
        raise HTTPException(404, "机构不存在")
    write_audit("partner.update_org", actor_id=user.id, resource_type="organization", resource_id=org_id)
    return {"org": org}


@router.get("/api/v1/author/partners/orgs/{org_id}/invite-codes")
def list_codes(org_id: str, request: Request) -> dict[str, Any]:
    require_author(request)
    return {"items": partners.list_invite_codes(org_id)}


@router.post("/api/v1/author/partners/orgs/{org_id}/invite-codes")
def create_code(org_id: str, body: InviteCodeBody, request: Request) -> dict[str, Any]:
    user = require_author(request)
    if not partners.get_organization(org_id):
        raise HTTPException(404, "机构不存在")
    try:
        ic = partners.create_invite_code(org_id, body.code, user.id, offering_id=body.offering_id, max_uses=body.max_uses)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    return {"invite_code": ic}


@router.get("/api/v1/author/partners/orgs/{org_id}/tiers")
def get_tiers(org_id: str, request: Request) -> dict[str, Any]:
    require_author(request)
    return {"items": partners.list_commission_tiers(org_id)}


@router.put("/api/v1/author/partners/orgs/{org_id}/tiers")
def set_tiers(org_id: str, body: TiersBody, request: Request) -> dict[str, Any]:
    user = require_author(request)
    if not partners.get_organization(org_id):
        raise HTTPException(404, "机构不存在")
    try:
        items = partners.set_commission_tiers(org_id, [t.model_dump() for t in body.tiers])
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    write_audit("partner.set_tiers", actor_id=user.id, resource_type="organization", resource_id=org_id)
    return {"items": items}


@router.get("/api/v1/author/partners/orgs/{org_id}/attributions")
def list_attributions(org_id: str, request: Request) -> dict[str, Any]:
    require_author(request)
    return {"items": partners.list_org_attributions(org_id)}


@router.post("/api/v1/author/partners/orgs/{org_id}/accounts")
def create_partner_account(org_id: str, body: PartnerAccountBody, request: Request) -> dict[str, Any]:
    user = require_author(request)
    if not partners.get_organization(org_id):
        raise HTTPException(404, "机构不存在")
    email = body.email.strip().lower()
    with db_cursor() as cur:
        cur.execute("SELECT id FROM users WHERE email=?", (email,))
        if cur.fetchone():
            raise HTTPException(409, "邮箱已被占用")
        uid = str(uuid.uuid4())
        cur.execute(
            "INSERT INTO users (id, email, password_hash, display_name, role, created_at) VALUES (?,?,?,?,?,?)",
            (uid, email, _hash_password(body.password), body.display_name, "partner", now_iso()),
        )
        aid = f"oa-{uuid.uuid4().hex[:12]}"
        cur.execute(
            """
            INSERT INTO org_accounts (id, org_id, email, password_hash, display_name, status, created_at)
            VALUES (?,?,?,?,?,?,?)
            """,
            (aid, org_id, email, _hash_password(body.password), body.display_name, "active", now_iso()),
        )
    write_audit("partner.create_account", actor_id=user.id, resource_type="organization", resource_id=org_id)
    return {"email": email, "org_id": org_id}
