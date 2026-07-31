"""Atomic lab completion integration tests (M3 — require live PostgreSQL).

Exercises ``services.application.lab_completion.complete_lab_attempt``
directly against the DB: one call should write submission + evidence +
node_progress (and unlock the next node) in a single transaction.
"""

from __future__ import annotations

import json
import uuid

import pytest
from sqlalchemy import text


@pytest.fixture
def learner(require_postgres):
    """A throwaway learner row + one throwaway camp per test, cleaned up after."""
    from services.db import session_scope
    from services.shared.seed import hash_password, now_iso

    uid = str(uuid.uuid4())
    suffix = uid[:8]
    camp_ids = [f"testcamp-lc-{suffix}", f"testcamp-lc-fail-{suffix}", f"testcamp-lc-idem-{suffix}"]
    with session_scope() as s:
        s.execute(
            text(
                """
                INSERT INTO users (id, email, password_hash, display_name, role, created_at)
                VALUES (:id, :email, :ph, :dn, 'learner', :ts)
                """
            ),
            {
                "id": uid,
                "email": f"lc-{suffix}@fde.local",
                "ph": hash_password("x" + suffix),
                "dn": f"LC {suffix}",
                "ts": now_iso(),
            },
        )
        for camp_id in camp_ids:
            s.execute(
                text("INSERT INTO camps (id, name, version) VALUES (:id, :name, 'v0.3')"),
                {"id": camp_id, "name": f"Lab Completion Test {camp_id}"},
            )

    yield uid

    with session_scope() as s:
        s.execute(text("DELETE FROM submissions WHERE learner_id=:u"), {"u": uid})
        s.execute(text("DELETE FROM evidence WHERE learner_id=:u"), {"u": uid})
        s.execute(text("DELETE FROM node_progress WHERE learner_id=:u"), {"u": uid})
        for camp_id in camp_ids:
            s.execute(text("DELETE FROM camps WHERE id=:id"), {"id": camp_id})
        s.execute(text("DELETE FROM users WHERE id=:u"), {"u": uid})


def _day_data():
    return {"nodes": [{"type": "lab"}, {"type": "project"}]}


def test_complete_lab_attempt_pass_writes_all_rows_and_unlocks_next(learner):
    from services.application.lab_completion import complete_lab_attempt
    from services.db import session_scope

    camp_id = f"testcamp-lc-{learner[:8]}"  # matches the `learner` fixture's pre-created camp row
    eval_result = {
        "pass": True,
        "checks": [{"id": "file_exists", "ok": True, "detail": "index.html exists=True", "args": {"path": "index.html"}}],
        "score": 1.0,
    }

    out = complete_lab_attempt(
        learner_id=learner,
        camp_id=camp_id,
        day=1,
        node_id="d1-lab",
        eval_result=eval_result,
        day_data=_day_data(),
    )

    assert out["status"] == "passed"
    assert out["submission_id"]
    assert out["evidence_id"]
    assert out["unlocked"] == "d1-project"
    # eval_result is enriched with Chinese fields on the way out.
    assert out["eval_result"]["checks"][0]["title_zh"] == "文件存在"

    with session_scope() as s:
        sub = s.execute(
            text("SELECT status FROM submissions WHERE id=:id"), {"id": out["submission_id"]}
        ).mappings().first()
        assert sub is not None
        assert sub["status"] == "passed"

        ev = s.execute(
            text("SELECT node_id, day, capability_tags FROM evidence WHERE id=:id"), {"id": out["evidence_id"]}
        ).mappings().first()
        assert ev is not None
        assert ev["node_id"] == "d1-lab"
        assert ev["day"] == 1
        tags = json.loads(ev["capability_tags"] or "[]")
        assert "capability:ai_team_command" in tags
        assert "command:day:1" in tags

        lab_progress = s.execute(
            text(
                "SELECT status FROM node_progress WHERE learner_id=:u AND camp_id=:c AND day=1 AND node_id='d1-lab'"
            ),
            {"u": learner, "c": camp_id},
        ).mappings().first()
        assert lab_progress is not None
        assert lab_progress["status"] == "passed"

        project_progress = s.execute(
            text(
                "SELECT status FROM node_progress WHERE learner_id=:u AND camp_id=:c AND day=1 AND node_id='d1-project'"
            ),
            {"u": learner, "c": camp_id},
        ).mappings().first()
        assert project_progress is not None
        assert project_progress["status"] == "available"


def test_complete_lab_attempt_fail_does_not_advance_progress(learner):
    from services.application.lab_completion import complete_lab_attempt
    from services.db import session_scope

    camp_id = f"testcamp-lc-fail-{learner[:8]}"
    eval_result = {
        "pass": False,
        "checks": [{"id": "file_exists", "ok": False, "detail": "index.html exists=False", "args": {"path": "index.html"}}],
        "score": 0.0,
    }

    out = complete_lab_attempt(
        learner_id=learner,
        camp_id=camp_id,
        day=1,
        node_id="d1-lab",
        eval_result=eval_result,
        day_data=_day_data(),
    )

    assert out["status"] == "failed"
    assert out["unlocked"] is None
    assert out["eval_result"]["checks"][0]["suggestion"]

    with session_scope() as s:
        sub = s.execute(
            text("SELECT status FROM submissions WHERE id=:id"), {"id": out["submission_id"]}
        ).mappings().first()
        assert sub["status"] == "failed"

        progress = s.execute(
            text("SELECT status FROM node_progress WHERE learner_id=:u AND camp_id=:c AND day=1 AND node_id='d1-lab'"),
            {"u": learner, "c": camp_id},
        ).mappings().first()
        # Evidence is always recorded, but node_progress is not created/advanced on a failed attempt.
        assert progress is None


def test_complete_lab_attempt_is_idempotent_per_job(learner):
    """Re-running the same (learner, camp, day, node, job) attempt updates in place."""
    from services.application.lab_completion import complete_lab_attempt
    from services.db import session_scope

    camp_id = f"testcamp-lc-idem-{learner[:8]}"
    job_id = str(uuid.uuid4())
    first = complete_lab_attempt(
        learner_id=learner,
        camp_id=camp_id,
        day=1,
        node_id="d1-lab",
        eval_result={"pass": False, "checks": [{"id": "file_exists", "ok": False}], "score": 0.0},
        job_id=job_id,
        day_data=_day_data(),
    )
    second = complete_lab_attempt(
        learner_id=learner,
        camp_id=camp_id,
        day=1,
        node_id="d1-lab",
        eval_result={"pass": True, "checks": [{"id": "file_exists", "ok": True}], "score": 1.0},
        job_id=job_id,
        day_data=_day_data(),
    )

    assert second["submission_id"] == first["submission_id"]
    assert second["status"] == "passed"

    with session_scope() as s:
        rows = s.execute(
            text("SELECT status FROM submissions WHERE learner_id=:u AND camp_id=:c"),
            {"u": learner, "c": camp_id},
        ).mappings().all()
        assert len(rows) == 1
        assert rows[0]["status"] == "passed"
