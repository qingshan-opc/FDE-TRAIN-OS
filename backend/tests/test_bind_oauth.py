"""Bind OAuth attaches the current WeChat to the logged-in user without switching session."""

from __future__ import annotations

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


def _make_learner(*, openid: str | None = None) -> dict:
    from services.shared import db_cursor, now_iso
    from services.shared.seed import hash_password

    uid = str(uuid.uuid4())
    email = f"bind-{uuid.uuid4().hex[:8]}@fde.local"
    with db_cursor() as cur:
        cur.execute(
            """
            INSERT INTO users (id, email, password_hash, display_name, role, created_at, wx_mp_openid)
            VALUES (?,?,?,?, 'learner', ?, ?)
            """,
            (uid, email, hash_password("x"), "待绑定学员", now_iso(), openid),
        )
    return {"id": uid, "email": email}


def _insert_bind_state(*, user_id: str, next_path: str, consumed: bool = False) -> str:
    from services.shared import db_cursor, now_iso
    from services.wechat_mp import bind_oauth as bind_ox

    bind_ox._ensure_cols()
    sid = uuid.uuid4().hex[:16]
    now = datetime.now(timezone.utc)
    exp = now + timedelta(minutes=15)
    consumed_at = now_iso() if consumed else None
    with db_cursor() as cur:
        cur.execute(
            """
            INSERT INTO wechat_login_states
              (id, created_at, expires_at, consumed_at, user_id, status, next_path, purpose)
            VALUES (?,?,?,?,?,?,?, 'bind')
            """,
            (sid, now_iso(), exp.isoformat(), consumed_at, user_id, "pending" if not consumed else "done", next_path),
        )
    return sid


def test_complete_bind_oauth_links_current_user_only():
    from services.shared import db_cursor
    from services.wechat_mp import bind_oauth as bind_ox
    from services.wechat_mp import entry as mp_entry

    learner = _make_learner()
    sid = _insert_bind_state(user_id=learner["id"], next_path="/app/invite")
    token = {"openid": "o-bind-current"}
    with patch.object(mp_entry, "_exchange_code", return_value=token):
        from services.wechat_mp import login as mp_login

        with patch.object(mp_login, "resolve_or_create_user", side_effect=AssertionError("must not create user")):
            result = bind_ox.complete_bind_oauth("code", sid, user_id=learner["id"])
    assert result.next_path == "/app/invite"
    assert not result.conflict
    with db_cursor() as cur:
        cur.execute("SELECT wx_mp_openid FROM users WHERE id=?", (learner["id"],))
        assert cur.fetchone()["wx_mp_openid"] == "o-bind-current"


def test_complete_bind_oauth_refuses_openid_owned_by_other():
    from services.wechat_mp import bind_oauth as bind_ox
    from services.wechat_mp import entry as mp_entry

    owner = _make_learner(openid="o-taken")
    other = _make_learner()
    sid = _insert_bind_state(user_id=other["id"], next_path="/app/invite")
    with patch.object(mp_entry, "_exchange_code", return_value={"openid": "o-taken"}):
        with pytest.raises(bind_ox.OpenidTaken) as exc:
            bind_ox.complete_bind_oauth("code", sid, user_id=other["id"])
    assert exc.value.next_path == "/app/invite"
    assert owner["id"] != other["id"]


def test_bind_oauth_replay_does_not_exchange():
    from services.wechat_mp import bind_oauth as bind_ox
    from services.wechat_mp import entry as mp_entry

    learner = _make_learner(openid="o-already")
    sid = _insert_bind_state(user_id=learner["id"], next_path="/app/profile", consumed=True)
    with patch.object(mp_entry, "_exchange_code", side_effect=AssertionError("must not exchange")):
        result = bind_ox.complete_bind_oauth("used-code", sid, user_id=learner["id"])
    assert result.already_bound is True
    assert result.next_path == "/app/profile"


def test_with_bind_flag_replaces_existing():
    from services.wechat_mp import bind_oauth as bind_ox

    assert bind_ox.with_bind_flag("/app/invite", "ok") == "/app/invite?wx_bind=ok"
    assert bind_ox.with_bind_flag("/app/invite?wx_bind=taken", "ok") == "/app/invite?wx_bind=ok"
