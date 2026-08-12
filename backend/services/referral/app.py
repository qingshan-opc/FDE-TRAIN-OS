"""Learner referral API — dashboard, attributions, profit shares."""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Any
from urllib.parse import quote

from fastapi import APIRouter, HTTPException, Request

_PKG_ROOT = Path(__file__).resolve().parents[2]
if str(_PKG_ROOT) not in sys.path:
    sys.path.insert(0, str(_PKG_ROOT))
from services.shared.config import ROOT as _ROOT  # noqa: E402

from services.referral import service as referral  # noqa: E402
from services.shared import AuthUser, init_schema  # noqa: E402
from services.shared.config import FDE_PUBLIC_BASE_URL  # noqa: E402
from services.shared.middleware import require_user  # noqa: E402

router = APIRouter(tags=["referral"])
init_schema()


def _require_referrer(request: Request) -> AuthUser:
    """Personal invite/commission is open to learners and staff who also learn."""
    user = require_user(request)
    if user.role not in ("learner", "partner", "author", "admin"):
        raise HTTPException(403, "当前账号不支持邀请分佣")
    return user


def _register_url(code: str) -> str:
    base = FDE_PUBLIC_BASE_URL.rstrip("/")
    return f"{base}/login?invite={quote(str(code).strip(), safe='')}"


@router.get("/api/v1/me/referral")
def me_referral_dashboard(request: Request) -> dict[str, Any]:
    user = _require_referrer(request)
    code_row = referral.ensure_learner_invite_code(user.id)
    url = _register_url(code_row.get("code") or "")
    return referral.referral_dashboard(user.id, url)


@router.get("/api/v1/me/referral/attributions")
def me_referral_attributions(request: Request) -> dict[str, Any]:
    user = _require_referrer(request)
    return {"items": referral.list_referral_attributions(user.id, limit=200)}


@router.get("/api/v1/me/referral/profit-shares")
def me_referral_profit_shares(request: Request) -> dict[str, Any]:
    user = _require_referrer(request)
    return {"items": referral.list_referral_profit_shares(user.id, limit=200)}


@router.get("/api/v1/me/referral/invites")
def me_referral_invites(request: Request) -> dict[str, Any]:
    user = _require_referrer(request)
    code_row = referral.ensure_learner_invite_code(user.id)
    code = code_row.get("code") or ""
    return {"code": code, "register_url": _register_url(code)}
