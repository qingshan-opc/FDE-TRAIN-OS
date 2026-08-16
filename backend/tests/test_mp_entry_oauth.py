"""Learner poster scan: replay consumed OAuth callback instead of '授权已过期'."""

from __future__ import annotations

import time
import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

import pytest


@pytest.fixture(scope="module", autouse=True)
def _bootstrap(require_postgres):
    from services.migrations_runner.__main__ import run_migrations
    from services.shared.seed import seed_defaults

    run_migrations()
    seed_defaults()
    yield


def _make_learner() -> dict:
    from services.shared import db_cursor, now_iso
    from services.shared.seed import hash_password

    uid = str(uuid.uuid4())
    email = f"mp-{uuid.uuid4().hex[:8]}@fde.local"
    with db_cursor() as cur:
        cur.execute(
            """
            INSERT INTO users (id, email, password_hash, display_name, role, created_at)
            VALUES (?,?,?,?,?,?)
            """,
            (uid, email, hash_password("x"), "扫码学员", "learner", now_iso()),
        )
    return {"id": uid, "email": email}


def _insert_state(*, status: str, next_path: str, user_id: str | None, consumed: bool, expired: bool) -> str:
    from services.shared import db_cursor, now_iso
    from services.wechat_mp import entry as mp_entry

    mp_entry._ensure_next_col()
    sid = uuid.uuid4().hex[:16]
    now = datetime.now(timezone.utc)
    exp = now - timedelta(minutes=1) if expired else now + timedelta(minutes=15)
    consumed_at = now_iso() if consumed else None
    with db_cursor() as cur:
        cur.execute(
            """
            INSERT INTO wechat_login_states
              (id, created_at, expires_at, consumed_at, user_id, status, next_path)
            VALUES (?,?,?,?,?,?,?)
            """,
            (sid, now_iso(), exp.isoformat(), consumed_at, user_id, status, next_path),
        )
    return sid


def test_replay_consumed_shop_callback_does_not_call_wechat():
    from services.wechat_mp import entry as mp_entry

    learner = _make_learner()
    sid = _insert_state(
        status="done",
        next_path="/app/shop",
        user_id=learner["id"],
        consumed=True,
        expired=False,
    )
    with patch.object(mp_entry, "_exchange_code", side_effect=AssertionError("must not exchange")):
        user, nxt = mp_entry.complete_oauth_entry("used-code", sid)
    assert user.id == learner["id"]
    assert nxt == "/app/shop"


def test_expired_unused_state_restarts_to_saved_next():
    from services.wechat_mp import entry as mp_entry

    sid = _insert_state(
        status="pending",
        next_path="/app/shop",
        user_id=None,
        consumed=False,
        expired=True,
    )
    with pytest.raises(mp_entry.OauthRestart) as exc:
        mp_entry.complete_oauth_entry("any", sid)
    assert exc.value.next_path == "/app/shop"


def test_reuse_pending_state_keeps_same_id():
    from services.wechat_mp import entry as mp_entry

    if not mp_entry.entry_configured():
        pytest.skip("WeChat app id not configured in test env")
    url1, state = mp_entry.create_oauth_authorize_url(next_path="/app/shop")
    url2, reused = mp_entry.create_oauth_authorize_url(next_path="/app/shop", reuse_state=state)
    assert reused == state
    assert "state=" + state in url1
    assert "state=" + reused in url2
    time.sleep(0)
