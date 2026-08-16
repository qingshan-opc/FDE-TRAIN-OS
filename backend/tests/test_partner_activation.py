"""Partner activation codes — author issues, learner redeems → org portal."""

from __future__ import annotations

import uuid

import pytest


@pytest.fixture(scope="module", autouse=True)
def _bootstrap(require_postgres):
    from services.migrations_runner.__main__ import run_migrations
    from services.shared.seed import seed_defaults

    run_migrations()
    seed_defaults()
    yield


def _make_learner(*, suffix: str | None = None) -> dict:
    from services.shared import db_cursor, now_iso
    from services.shared.seed import hash_password

    suffix = suffix or uuid.uuid4().hex[:8]
    user_id = str(uuid.uuid4())
    email = f"act-{suffix}@fde.local"
    with db_cursor() as cur:
        cur.execute(
            """
            INSERT INTO users (id, email, password_hash, display_name, role, created_at)
            VALUES (?,?,?,?,?,?)
            """,
            (user_id, email, hash_password("x"), f"Act {suffix}", "learner", now_iso()),
        )
    return {"id": user_id, "email": email, "display_name": f"Act {suffix}"}


def test_activation_code_create_and_redeem():
    from services.auth.session_context import build_session_context, list_partner_orgs
    from services.partners import service as partners
    from services.shared import AuthUser

    pac = partners.create_activation_code(created_by=None, note="测试渠道")
    assert pac["code"]
    assert pac["status"] == "active"
    code = pac["code"]

    learner = _make_learner()
    result = partners.activate_partner_with_code(
        user_id=learner["id"],
        code=code,
        org_name="测试机构A",
    )
    assert result["org_id"]
    assert result["invite_code"]
    assert result["org"]["name"] == "测试机构A"

    orgs = list_partner_orgs(learner["id"])
    assert len(orgs) == 1
    assert orgs[0]["id"] == result["org_id"]

    user = AuthUser(id=learner["id"], email=learner["email"], role="learner", display_name=learner["display_name"])
    ctx = build_session_context(user)
    kinds = {p["kind"] for p in ctx["portals"]}
    assert "learner" in kinds
    assert "partner" in kinds
    assert ctx["default_home"] == "/app/courses"

    # reuse fails
    with pytest.raises(ValueError, match="已使用|已失效"):
        partners.activate_partner_with_code(user_id=_make_learner()["id"], code=code)


def test_activation_rejects_invalid_and_already_partner():
    from services.partners import service as partners

    with pytest.raises(ValueError, match="无效"):
        partners.activate_partner_with_code(user_id=_make_learner()["id"], code="NOTEXIST")

    pac = partners.create_activation_code(created_by=None)
    learner = _make_learner()
    partners.activate_partner_with_code(user_id=learner["id"], code=pac["code"])

    pac2 = partners.create_activation_code(created_by=None)
    with pytest.raises(ValueError, match="已是机构"):
        partners.activate_partner_with_code(user_id=learner["id"], code=pac2["code"])


def test_activation_default_tier_30_percent():
    from services.partners import service as partners

    pac = partners.create_activation_code(created_by=None)
    learner = _make_learner()
    result = partners.activate_partner_with_code(user_id=learner["id"], code=pac["code"])
    tiers = partners.list_commission_tiers(result["org_id"])
    assert tiers
    assert int(tiers[0]["min_paid_users"]) == 0
    assert int(tiers[0]["rate_bps"]) == 3000
