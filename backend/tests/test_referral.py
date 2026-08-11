"""Unit tests for learner referral tier matching and bind rules."""

from __future__ import annotations

import uuid

import pytest


def test_match_learner_rate_bps_tiers():
    from services.referral.service import LEARNER_REFERRAL_TIERS, match_learner_rate_bps

    assert LEARNER_REFERRAL_TIERS == [(0, 2000), (5, 2500), (10, 3000)]
    assert match_learner_rate_bps(0) == 2000
    assert match_learner_rate_bps(4) == 2000
    assert match_learner_rate_bps(5) == 2500
    assert match_learner_rate_bps(9) == 2500
    assert match_learner_rate_bps(10) == 3000
    assert match_learner_rate_bps(100) == 3000


@pytest.fixture(scope="module", autouse=True)
def _bootstrap(require_postgres):
    from services.migrations_runner.__main__ import run_migrations
    from services.shared.seed import seed_defaults

    run_migrations()
    seed_defaults()
    yield


def _make_learner(suffix: str) -> str:
    from services.shared import db_cursor, now_iso
    from services.shared.seed import hash_password

    uid = str(uuid.uuid4())
    with db_cursor() as cur:
        cur.execute(
            """
            INSERT INTO users (id, email, password_hash, display_name, role, created_at)
            VALUES (?,?,?,?,?,?)
            """,
            (uid, f"ref-{suffix}@fde.local", hash_password("x"), f"Ref {suffix}", "learner", now_iso()),
        )
    return uid


def test_bind_learner_rejects_self_invite():
    from services.referral.service import bind_learner_invite_code, ensure_learner_invite_code

    referrer = _make_learner("self")
    code_row = ensure_learner_invite_code(referrer)
    with pytest.raises(ValueError, match="自己的邀请码"):
        bind_learner_invite_code(referrer, code_row["code"])


def test_bind_learner_one_time():
    from services.referral.service import bind_learner_invite_code, ensure_learner_invite_code, get_user_referral

    referrer = _make_learner("ref-a")
    invitee = _make_learner("inv-a")
    code = ensure_learner_invite_code(referrer)["code"]
    bound = bind_learner_invite_code(invitee, code)
    assert bound["referrer_user_id"] == referrer
    assert get_user_referral(invitee) is not None
    other = _make_learner("inv-b")
    with pytest.raises(ValueError, match="已绑定"):
        bind_learner_invite_code(other, code)


def test_org_attribution_blocks_learner_bind():
    from services.partners.service import bind_invite_code, list_invite_codes
    from services.referral.service import bind_learner_invite_code, ensure_learner_invite_code

    referrer = _make_learner("ref-org-block")
    invitee = _make_learner("inv-org-block")
    org_codes = list_invite_codes("org-platform")
    assert org_codes, "seed org invite required"
    bind_invite_code(invitee, org_codes[0]["code"])
    learner_code = ensure_learner_invite_code(referrer)["code"]
    with pytest.raises(ValueError, match="机构"):
        bind_learner_invite_code(invitee, learner_code)
