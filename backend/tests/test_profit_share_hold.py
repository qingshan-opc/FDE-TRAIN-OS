"""7-day WeChat profit-share hold + refund window."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

import pytest


@pytest.fixture(scope="module", autouse=True)
def _bootstrap(require_postgres):
    from services.migrations_runner.__main__ import run_migrations
    from services.shared.seed import seed_defaults

    run_migrations()
    seed_defaults()
    yield


def _ctx(*, with_org: bool = True):
    from services.shared import db_cursor, now_iso
    from services.shared.seed import hash_password
    suffix = uuid.uuid4().hex[:8]
    user_id = str(uuid.uuid4())
    camp_id = f"testcamp-hold-{suffix}"
    version_id = str(uuid.uuid4())
    offering_id = str(uuid.uuid4())
    order_id = f"po-{uuid.uuid4().hex[:16]}"
    org_id = f"org-hold-{suffix}" if with_org else None
    with db_cursor() as cur:
        cur.execute(
            """
            INSERT INTO users (id, email, password_hash, display_name, role, created_at)
            VALUES (?,?,?,?,?,?)
            """,
            (user_id, f"hold-{suffix}@fde.local", hash_password("x"), f"Hold {suffix}", "learner", now_iso()),
        )
        cur.execute("INSERT INTO camps (id, name, version) VALUES (?,?, 'v0.3')", (camp_id, f"Hold Camp {suffix}"))
        cur.execute(
            """
            INSERT INTO course_versions (id, camp_id, version_tag, status, title, created_at)
            VALUES (?,?,?,?,?,NOW())
            """,
            (version_id, camp_id, f"v-{suffix}", "published", "Hold Course"),
        )
        cur.execute(
            """
            INSERT INTO course_offerings (id, course_version_id, camp_id, title, status, price_fen, created_at)
            VALUES (?,?,?,?, 'active', 198000, NOW())
            """,
            (offering_id, version_id, camp_id, "Hold Offering"),
        )
        if org_id:
            cur.execute(
                """
                INSERT INTO organizations (id, name, status, created_at, updated_at)
                VALUES (?,?, 'active', NOW(), NOW())
                """,
                (org_id, f"Hold Org {suffix}"),
            )
            cur.execute(
                """
                INSERT INTO commission_tiers (id, org_id, min_paid_users, rate_bps, created_at)
                VALUES (?,?, 0, 3000, NOW())
                """,
                (f"ct-hold-{suffix}", org_id),
            )
    return {
        "user_id": user_id,
        "camp_id": camp_id,
        "version_id": version_id,
        "offering_id": offering_id,
        "order_id": order_id,
        "org_id": org_id,
    }


def _cleanup(ctx: dict) -> None:
    from services.shared import db_cursor
    with db_cursor() as cur:
        cur.execute("DELETE FROM profit_share_orders WHERE payment_order_id=?", (ctx["order_id"],))
        cur.execute("DELETE FROM payment_orders WHERE id=?", (ctx["order_id"],))
        cur.execute("DELETE FROM enrollment_records WHERE offering_id=?", (ctx["offering_id"],))
        cur.execute("DELETE FROM enrollments WHERE camp_id=?", (ctx["camp_id"],))
        cur.execute("DELETE FROM course_offerings WHERE id=?", (ctx["offering_id"],))
        cur.execute("DELETE FROM course_versions WHERE id=?", (ctx["version_id"],))
        cur.execute("DELETE FROM camps WHERE id=?", (ctx["camp_id"],))
        if ctx.get("org_id"):
            cur.execute("DELETE FROM commission_tiers WHERE org_id=?", (ctx["org_id"],))
            cur.execute("DELETE FROM organizations WHERE id=?", (ctx["org_id"],))
        cur.execute("DELETE FROM users WHERE id=?", (ctx["user_id"],))


def _insert_paid_order(ctx: dict, *, org_id: str | None = None, paid_at: str | None = None) -> None:
    from services.shared import db_cursor, now_iso
    paid = paid_at or now_iso()
    with db_cursor() as cur:
        cur.execute(
            """
            INSERT INTO payment_orders
              (id, out_trade_no, user_id, offering_id, org_id, amount_fen, status,
               wx_transaction_id, paid_at, pay_channel, created_at, updated_at)
            VALUES (?,?,?,?,?,?, 'paid', ?, ?, 'wechat', ?, ?)
            """,
            (
                ctx["order_id"],
                f"FDE{uuid.uuid4().hex[:12].upper()}",
                ctx["user_id"],
                ctx["offering_id"],
                org_id,
                198000,
                f"TX{uuid.uuid4().hex[:10]}",
                paid,
                paid,
                paid,
            ),
        )


def test_schedule_holds_seven_days_and_skips_submit():
    from services.billing import profit_sharing

    ctx = _ctx()
    try:
        _insert_paid_order(ctx, org_id=ctx["org_id"])
        row = profit_sharing.schedule_profit_share_for_order(ctx["order_id"])
        assert row is not None
        assert row["wx_state"] == "held"
        assert int(row["share_fen"]) == 59400
        after = profit_sharing.as_utc(row["share_after_at"])
        paid = profit_sharing.as_utc(datetime.now(timezone.utc))
        assert after is not None
        delta = after - paid
        assert timedelta(days=6, hours=12) < delta < timedelta(days=7, hours=12)
        again = profit_sharing._existing_profit_share(ctx["order_id"])
        assert again and again["wx_state"] == "held"
    finally:
        _cleanup(ctx)


def test_due_share_submits_to_wechat(monkeypatch):
    from services.billing import profit_sharing
    from services.shared import db_cursor

    calls: list[tuple[str, str]] = []

    monkeypatch.setattr(profit_sharing, "configured", lambda: True)

    def _fake_request(method: str, path: str, payload=None):
        calls.append((method, path))
        return {"state": "PROCESSING"}

    monkeypatch.setattr(profit_sharing, "_request", _fake_request)
    monkeypatch.setattr(profit_sharing, "_ensure_org_receiver", lambda org: None)

    ctx = _ctx()
    try:
        with db_cursor() as cur:
            cur.execute(
                """
                UPDATE organizations
                SET wx_receiver_type='PERSONAL_OPENID', wx_receiver_account='o-test-openid'
                WHERE id=?
                """,
                (ctx["org_id"],),
            )
        _insert_paid_order(ctx, org_id=ctx["org_id"])
        profit_sharing.schedule_profit_share_for_order(ctx["order_id"])
        with db_cursor() as cur:
            cur.execute(
                "UPDATE profit_share_orders SET share_after_at=NOW() - INTERVAL '1 minute' WHERE payment_order_id=?",
                (ctx["order_id"],),
            )
        with db_cursor() as cur:
            cur.execute(
                """
                UPDATE profit_share_orders
                SET share_after_at=NOW() - INTERVAL '1 minute', wx_state='submitting', updated_at=NOW()
                WHERE payment_order_id=?
                RETURNING *
                """,
                (ctx["order_id"],),
            )
            claimed = dict(cur.fetchone())
        profit_sharing._submit_claimed_row(claimed)
        row = profit_sharing._existing_profit_share(ctx["order_id"])
        assert row and row["wx_state"] in ("processing", "finished")
        assert any(path.endswith("/v3/profitsharing/orders") for _, path in calls)
    finally:
        _cleanup(ctx)


def test_null_share_after_at_does_not_submit(monkeypatch):
    """NULL share_after_at must never be treated as immediately due."""
    from services.billing import profit_sharing
    from services.shared import db_cursor

    calls: list[tuple[str, str]] = []
    monkeypatch.setattr(profit_sharing, "configured", lambda: True)

    def _fake_request(method: str, path: str, payload=None):
        calls.append((method, path))
        return {"state": "PROCESSING"}

    monkeypatch.setattr(profit_sharing, "_request", _fake_request)
    monkeypatch.setattr(profit_sharing, "_ensure_org_receiver", lambda org: None)

    ctx = _ctx()
    try:
        with db_cursor() as cur:
            cur.execute(
                """
                UPDATE organizations
                SET wx_receiver_type='PERSONAL_OPENID', wx_receiver_account='o-test-openid'
                WHERE id=?
                """,
                (ctx["org_id"],),
            )
        _insert_paid_order(ctx, org_id=ctx["org_id"])
        profit_sharing.schedule_profit_share_for_order(ctx["order_id"])
        with db_cursor() as cur:
            cur.execute(
                """
                UPDATE profit_share_orders
                SET share_after_at=NULL, wx_state='held', updated_at=NOW()
                WHERE payment_order_id=?
                """,
                (ctx["order_id"],),
            )
        submitted = profit_sharing.submit_due_shares(limit=5)
        assert submitted == 0
        assert not any(path.endswith("/v3/profitsharing/orders") for _, path in calls)
        row = profit_sharing._existing_profit_share(ctx["order_id"])
        assert row and row["wx_state"] == "held"
        assert row.get("share_after_at") is None
    finally:
        _cleanup(ctx)


def test_refund_within_window_cancels_hold():
    from services.billing import profit_sharing, refunds
    from services.shared import db_cursor

    ctx = _ctx()
    try:
        _insert_paid_order(ctx, org_id=ctx["org_id"])
        profit_sharing.schedule_profit_share_for_order(ctx["order_id"])
        updated = refunds.request_refund(ctx["order_id"], reason="测试退款")
        assert updated.get("status") == "refunded"
        share = profit_sharing._existing_profit_share(ctx["order_id"])
        assert share and share["wx_state"] == "cancelled"
        with db_cursor() as cur:
            cur.execute(
                "SELECT status FROM enrollment_records WHERE user_id=? AND offering_id=?",
                (ctx["user_id"], ctx["offering_id"]),
            )
            enr = cur.fetchone()
        # refund finalizes access drop; enroll may not exist if fulfill wasn't called
        if enr:
            assert dict(enr)["status"] == "dropped"
    finally:
        _cleanup(ctx)


def test_refund_blocked_after_seven_days():
    from services.billing import profit_sharing, refunds

    ctx = _ctx()
    try:
        old = (datetime.now(timezone.utc) - timedelta(days=8)).isoformat()
        _insert_paid_order(ctx, org_id=ctx["org_id"], paid_at=old)
        profit_sharing.schedule_profit_share_for_order(ctx["order_id"])
        with pytest.raises(refunds.RefundError, match="已满7天"):
            refunds.request_refund(ctx["order_id"])
        share = profit_sharing._existing_profit_share(ctx["order_id"])
        assert share and share["wx_state"] == "held"
    finally:
        _cleanup(ctx)


def test_refund_blocked_after_share_finished():
    from services.billing import profit_sharing, refunds
    from services.shared import db_cursor

    ctx = _ctx()
    try:
        _insert_paid_order(ctx, org_id=ctx["org_id"])
        profit_sharing.schedule_profit_share_for_order(ctx["order_id"])
        with db_cursor() as cur:
            cur.execute(
                "UPDATE profit_share_orders SET wx_state='finished', updated_at=NOW() WHERE payment_order_id=?",
                (ctx["order_id"],),
            )
        with pytest.raises(refunds.RefundError, match="无法退款"):
            refunds.request_refund(ctx["order_id"])
    finally:
        _cleanup(ctx)
