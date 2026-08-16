"""Partner portal API — dashboard + WeChat receiver bind."""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Any
from fastapi import APIRouter, HTTPException, Request, Response
from fastapi.responses import HTMLResponse
from pydantic import BaseModel

_PKG_ROOT = Path(__file__).resolve().parents[2]
if str(_PKG_ROOT) not in sys.path:
    sys.path.insert(0, str(_PKG_ROOT))
from services.shared.config import ROOT as _ROOT  # noqa: E402

from services.billing import profit_sharing  # noqa: E402
from services.partner import wechat_bind  # noqa: E402
from services.partners import service as partners  # noqa: E402
from services.shared import (  # noqa: E402
    AuthUser,
    authenticate,
    create_access_token,
    create_refresh_session,
    db_cursor,
    init_schema,
    verify_password,
    write_audit,
)
from services.shared.config import FDE_PUBLIC_BASE_URL  # noqa: E402
from services.shared.auth_constants import set_auth_cookies  # noqa: E402
from services.shared.middleware import require_user  # noqa: E402

router = APIRouter(tags=["partner"])
init_schema()


class PartnerLoginBody(BaseModel):
    email: str
    password: str


class PartnerActivateBody(BaseModel):
    code: str
    org_name: str | None = None


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
    """Partner APIs: org linkage via org_accounts (not frontend role)."""
    from services.auth.session_context import list_partner_orgs

    user = require_user(request)
    orgs = list_partner_orgs(user.id)
    requested = (request.query_params.get("org_id") or "").strip() or None
    org_id: str | None = None
    if requested:
        if user.role == "admin" or any(o["id"] == requested for o in orgs):
            org_id = requested
        else:
            raise HTTPException(403, "无权访问该机构")
    elif orgs:
        org_id = orgs[0]["id"]
    elif user.role == "admin":
        org_id = None
    if not org_id:
        raise HTTPException(403, "未关联机构")
    return user, org_id


@router.post("/api/v1/partner/auth/login")
def partner_login(body: PartnerLoginBody, request: Request, response: Response) -> dict[str, Any]:
    from services.auth.session_context import attach_session_context
    from services.shared import user_camps

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
        if not user:
            raise HTTPException(401, "邮箱或密码错误")
        if user.role not in ("partner", "admin") and not _partner_org_id(user.id):
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

    # Partner-as-learner: attach camp when enrolled
    camps = user_camps(user.id)
    camp_id = camps[0]["id"] if camps else None
    sid, refresh = create_refresh_session(
        user.id,
        camp_id,
        user_agent=request.headers.get("user-agent"),
        ip=request.client.host if request.client else None,
        exclusive=True,
    )
    access = create_access_token(user, camp_id, session_id=sid)
    csrf = secrets.token_urlsafe(24)
    _set_auth_cookies(response, access, refresh, csrf)
    org_id = _partner_org_id(user.id)
    write_audit("partner.login", actor_id=user.id, details={"org_id": org_id})
    receiver = None
    if org_id:
        receiver = wechat_bind.receiver_status(partners.get_organization(org_id))
    return attach_session_context(
        {
            "token": access,
            "csrf": csrf,
            "user": {"id": user.id, "email": user.email, "role": user.role, "display_name": user.display_name},
            "camp_id": camp_id,
            "camps": user_camps(user.id),
            "org_id": org_id,
            "receiver": receiver,
        },
        user,
    )


@router.post("/api/v1/partner/activate")
def partner_activate(body: PartnerActivateBody, request: Request) -> dict[str, Any]:
    """Redeem a one-time activation code → create org for current WeChat/user session."""
    from services.auth.session_context import attach_session_context

    user = require_user(request)
    try:
        result = partners.activate_partner_with_code(
            user_id=user.id,
            code=body.code,
            org_name=body.org_name,
        )
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    write_audit(
        "partner.activate",
        actor_id=user.id,
        resource_type="organization",
        resource_id=result.get("org_id"),
        details={"code": result.get("activation_code"), "invite_code": result.get("invite_code")},
    )
    org_id = str(result.get("org_id") or "")
    receiver = wechat_bind.receiver_status(partners.get_organization(org_id)) if org_id else None
    return attach_session_context(
        {
            "org": result.get("org"),
            "org_id": org_id,
            "invite_code": result.get("invite_code"),
            "receiver": receiver,
            "user": {"id": user.id, "email": user.email, "role": user.role, "display_name": user.display_name},
        },
        user,
    )


@router.get("/api/v1/partner/activate/entry")
def partner_activate_entry() -> dict[str, Any]:
    """Public entry URL + QR target for partner activation (mp-entry)."""
    from urllib.parse import quote

    base = FDE_PUBLIC_BASE_URL.rstrip("/")
    next_path = "/partner/activate"
    entry_url = (
        f"{base}/api/v1/auth/wechat/mp-entry"
        f"?next={quote(next_path, safe='')}"
    )
    return {"entry_url": entry_url, "next": next_path}


@router.get("/api/v1/partner/dashboard")
def dashboard(request: Request) -> dict[str, Any]:
    user, org_id = _require_partner(request)
    org = partners.get_organization(org_id)
    if not org:
        raise HTTPException(404, "机构不存在")
    try:
        profit_sharing.tick(limit=20)
    except Exception:
        pass
    stats = partners.org_dashboard_stats(org_id)
    return {
        "org": org,
        "stats": stats,
        "user": {"id": user.id, "email": user.email},
        "receiver": wechat_bind.receiver_status(org),
    }


@router.get("/api/v1/partner/attributions")
def partner_attributions(request: Request) -> dict[str, Any]:
    _, org_id = _require_partner(request)
    return {"items": partners.list_org_attributions(org_id, limit=200)}


def _enroll_url(code: str) -> str:
    from urllib.parse import quote

    base = FDE_PUBLIC_BASE_URL.rstrip("/")
    return (
        f"{base}/api/v1/auth/wechat/mp-entry"
        f"?next={quote('/app/shop', safe='')}"
        f"&invite={quote(str(code).strip(), safe='')}"
    )


def _register_url(code: str) -> str:
    from urllib.parse import quote

    base = FDE_PUBLIC_BASE_URL.rstrip("/")
    return f"{base}/login?invite={quote(str(code).strip(), safe='')}"


@router.get("/api/v1/partner/offerings")
def partner_offerings(request: Request) -> dict[str, Any]:
    """Read-only catalog for partner marketing posters."""
    _, org_id = _require_partner(request)
    org = partners.get_organization(org_id) or {}
    with db_cursor() as cur:
        cur.execute(
            """
            SELECT co.id, co.title, co.price_fen, co.status,
                   c.title AS course_title, c.slug AS course_slug,
                   c.description AS course_description,
                   co.course_version_id
            FROM course_offerings co
            LEFT JOIN course_versions cv ON cv.id = co.course_version_id
            LEFT JOIN courses c ON c.id = cv.course_id
            WHERE co.price_fen > 0 AND co.status IN ('active','upcoming')
            ORDER BY co.created_at DESC
            """
        )
        items = [dict(r) for r in cur.fetchall()]
        for it in items:
            vid = it.pop("course_version_id", None)
            modules: list[dict[str, Any]] = []
            if vid:
                cur.execute(
                    """
                    SELECT day AS day_index, title
                    FROM day_packages
                    WHERE course_version_id=?
                    ORDER BY day
                    """,
                    (vid,),
                )
                modules = [dict(r) for r in cur.fetchall()]
                if not modules:
                    cur.execute(
                        """
                        SELECT day_index, title FROM course_modules
                        WHERE course_version_id=?
                        ORDER BY sort_order, day_index
                        """,
                        (vid,),
                    )
                    modules = [dict(r) for r in cur.fetchall()]
            it["modules"] = modules
            it["module_count"] = len(modules)
            it["description"] = it.pop("course_description", None) or ""
            it["cover_image"] = "/landing/hero.png"
            it["gallery"] = [
                "/landing/story-task.png",
                "/landing/story-agent.png",
                "/landing/story-cert.png",
            ]
    return {"items": items, "org": {"id": org_id, "name": org.get("name")}}


@router.get("/api/v1/partner/invites")
def partner_invites(request: Request) -> dict[str, Any]:
    """Org invite codes + enroll/register URLs for poster QR."""
    _, org_id = _require_partner(request)
    org = partners.get_organization(org_id) or {}
    codes = partners.list_invite_codes(org_id)
    items = []
    for row in codes:
        code = str(row.get("code") or "")
        items.append(
            {
                "id": row.get("id"),
                "code": code,
                "status": row.get("status"),
                "max_uses": row.get("max_uses"),
                "used_count": row.get("used_count") or 0,
                "offering_id": row.get("offering_id"),
                "register_url": _register_url(code) if code else None,
                "enroll_url": _enroll_url(code) if code else None,
            }
        )
    active = next((i for i in items if i.get("status") == "active"), None)
    return {
        "org": {"id": org_id, "name": org.get("name")},
        "items": items,
        "primary": active,
    }


@router.get("/api/v1/partner/profit-shares")
def partner_profit_shares(request: Request) -> dict[str, Any]:
    _, org_id = _require_partner(request)
    try:
        profit_sharing.tick(limit=20)
    except Exception:
        pass
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


@router.get("/api/v1/partner/wechat/receiver")
def wechat_receiver(request: Request) -> dict[str, Any]:
    _, org_id = _require_partner(request)
    org = partners.get_organization(org_id)
    return wechat_bind.receiver_status(org)


@router.get("/api/v1/partner/wechat/bind-url")
def wechat_bind_url(request: Request) -> dict[str, Any]:
    user, org_id = _require_partner(request)
    try:
        data = wechat_bind.build_bind_url(org_id, user.id)
    except RuntimeError as exc:
        raise HTTPException(503, str(exc)) from exc
    write_audit("partner.wechat_bind_url", actor_id=user.id, details={"org_id": org_id})
    return data


@router.get("/api/v1/partner/wechat/bind-status")
def wechat_bind_status(request: Request, state: str) -> dict[str, Any]:
    """Poll while QR modal open — `done` becomes true after phone OAuth succeeds."""
    _, org_id = _require_partner(request)
    if not state or len(state) > 80:
        raise HTTPException(400, "invalid state")
    return wechat_bind.bind_poll_status(org_id, state)


def _bind_result_html(*, ok: bool, title: str, detail: str) -> HTMLResponse:
    """Phone WeChat landing page — do NOT redirect to SPA (no partner cookie there)."""
    color = "#16a34a" if ok else "#dc2626"
    tip = "请返回电脑端查看，页面将自动刷新显示绑定结果。" if ok else "请返回电脑端，点击「刷新二维码」后重新扫码。"
    body = f"""<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>{title}</title>
<style>
body{{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;margin:0;background:#0f172a;color:#e2e8f0;}}
.card{{max-width:420px;margin:16vh auto;padding:28px 24px;background:#1e293b;border-radius:16px;text-align:center;}}
h1{{font-size:22px;margin:0 0 12px;color:{color}}}
p{{line-height:1.6;margin:8px 0;color:#cbd5e1;font-size:15px}}
.small{{font-size:13px;color:#94a3b8}}
</style></head>
<body><div class="card">
<h1>{title}</h1>
<p>{detail}</p>
<p class="small">{tip}</p>
</div></body></html>"""
    return HTMLResponse(body, status_code=200 if ok else 400)


@router.get("/api/v1/partner/wechat/callback")
def wechat_bind_callback(
    request: Request, code: str | None = None, state: str | None = None
) -> Response:
    """WeChat OAuth redirect in phone browser — show result HTML; PC polls receiver API."""
    if not code or not state:
        return _bind_result_html(ok=False, title="绑定失败", detail="缺少微信授权参数 code/state")
    try:
        result = wechat_bind.complete_bind(code, state)
        write_audit(
            "partner.wechat_bound",
            actor_id=None,
            details={
                "org_id": result.get("org_id"),
                "masked": (result.get("receiver") or {}).get("wx_receiver_account_masked"),
            },
        )
        masked = (result.get("receiver") or {}).get("wx_receiver_account_masked") or ""
        name = (result.get("receiver") or {}).get("wx_receiver_name") or "分销收款"
        return _bind_result_html(
            ok=True,
            title="微信绑定成功",
            detail=f"收款账号已绑定：{name}（{masked}）",
        )
    except Exception as exc:
        log_msg = str(exc)[:300]
        return _bind_result_html(ok=False, title="绑定失败", detail=log_msg)
