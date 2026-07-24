"""API contract / RBAC — against running fde-api (:8760)."""

from __future__ import annotations

import httpx
import pytest


@pytest.fixture
def client(api_base: str, require_api):
    with httpx.Client(base_url=api_base, timeout=30.0) as c:
        yield c


def _login(client: httpx.Client, email: str, password: str) -> tuple[httpx.Client, str]:
    r = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    csrf = r.json().get("csrf") or client.cookies.get("fde_csrf")
    assert csrf
    return client, csrf


def test_login_no_auto_enroll_unknown_camp(client: httpx.Client):
    r = client.post(
        "/api/v1/auth/login",
        json={"email": "demo@fde.local", "password": "demo1234", "camp_id": "camp-does-not-exist"},
    )
    assert r.status_code == 403
    assert "未加入" in r.text or "营期" in r.text


def test_learner_author_evidence_forbidden(client: httpx.Client):
    _, csrf = _login(client, "demo@fde.local", "demo1234")
    # cookie session — CSRF required for writes; GET still authz
    r = client.get("/api/v1/author/evidence")
    assert r.status_code == 403


def test_unauthenticated_evidence_write_401(client: httpx.Client):
    r = client.post(
        "/api/v1/evidence",
        json={
            "day": 1,
            "node_id": "d1-learn",
            "kind": "capsule",
            "payload": {},
            "capability_tags": [],
        },
    )
    # CSRF may fire first when no cookie; or 401
    assert r.status_code in (401, 403)


def test_capsule_progress_uses_session_learner(client: httpx.Client):
    _, csrf = _login(client, "demo@fde.local", "demo1234")
    me = client.get("/api/v1/auth/me").json()
    r = client.post(
        "/api/v1/capsules/progress",
        headers={"X-CSRF-Token": csrf},
        json={"camp_id": me["camp_id"], "day": 1, "capsule_id": "test-cap-rbac", "learner_id": "someone-else"},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["learner_id"] == me["user"]["id"]
    assert body["learner_id"] != "someone-else"


def test_csrf_blocks_cookie_write_without_header(client: httpx.Client):
    _login(client, "demo@fde.local", "demo1234")
    r = client.post(
        "/api/v1/capsules/progress",
        json={"day": 1, "capsule_id": "no-csrf"},
    )
    assert r.status_code == 403
    assert "CSRF" in r.text or "csrf" in r.text.lower()


def test_livez_readyz(client: httpx.Client):
    assert client.get("/livez").json()["status"] == "ok"
    ready = client.get("/readyz")
    assert ready.status_code == 200
    assert ready.json()["checks"]["postgres"] == "ok"
    assert ready.json()["checks"]["minio"] == "ok"


def test_agent_job_rejects_body_learner_spoof(client: httpx.Client):
    _, csrf = _login(client, "demo@fde.local", "demo1234")
    me = client.get("/api/v1/auth/me").json()
    # clear active jobs for learner so concurrency guard does not 429
    from services.shared.db import db_cursor

    with db_cursor() as cur:
        cur.execute(
            """
            UPDATE jobs SET status='cancelled', updated_at=NOW()
            WHERE learner_id=? AND kind='agent_job'
              AND status IN ('queued','hydrating','running','evaluating','snapshotting')
            """,
            (me["user"]["id"],),
        )
    r = client.post(
        "/api/v1/agent/jobs",
        headers={"X-CSRF-Token": csrf},
        json={
            "prompt": "做一个线索落地页 index.html 带 cta",
            "force_stub": True,
            "learner_id": "attacker-id",
            "camp_id": me["camp_id"],
        },
    )
    assert r.status_code == 200, r.text
    job = client.get(f"/api/v1/agent/jobs/{r.json()['job_id']}").json()
    assert job.get("learner_id") == me["user"]["id"] or (job.get("payload") or {}).get("learner_id") == me["user"]["id"]
