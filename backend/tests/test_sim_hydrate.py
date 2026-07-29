"""Sim adapter_state is persisted to PG and can be loaded into a fresh adapter."""

from __future__ import annotations

import json

import httpx
import pytest


@pytest.fixture
def client(api_base: str, require_api):
    with httpx.Client(base_url=api_base, timeout=30.0) as c:
        yield c


def test_sim_adapter_state_roundtrip(client: httpx.Client, require_postgres):
    r = client.post(
        "/api/v1/auth/login",
        json={"email": "demo@fde.local", "password": "demo1234", "camp_id": "camp-v03"},
    )
    assert r.status_code == 200, r.text
    csrf = r.json().get("csrf") or client.cookies.get("fde_csrf")

    created = client.post(
        "/api/v1/sim/sessions",
        headers={"X-CSRF-Token": csrf},
        json={"sim_kind": "server", "task_spec": {"title": "hydrate-test"}, "learner_seed": {}},
    )
    assert created.status_code == 200, created.text
    sid = created.json()["session_id"]

    act = client.post(
        f"/api/v1/sim/sessions/{sid}/actions",
        headers={"X-CSRF-Token": csrf},
        json={"type": "terminal.exec", "payload": {"cmd": "nginx -t"}},
    )
    assert act.status_code == 200, act.text

    from services.shared import db_cursor
    from sim.registry import create

    with db_cursor() as cur:
        cur.execute("SELECT state_json FROM sim_sessions WHERE id=?", (sid,))
        row = cur.fetchone()
    assert row
    state = row["state_json"]
    if isinstance(state, str):
        state = json.loads(state)
    assert isinstance(state.get("adapter_state"), dict), state
    assert "nginx -t" in (state["adapter_state"].get("history") or [])

    # Fresh adapter instance (no process cache) hydrates from dumped state
    adapter = create("server")
    adapter.load_state(sid, state["adapter_state"])
    result = adapter.evaluate(
        sid,
        [{"check": "command_sequence", "args": {"contains": ["nginx -t"]}}],
    )
    assert result.get("pass") is True, result
