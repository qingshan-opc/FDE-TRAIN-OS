"""Cross-day gate + unlock-node hiding tests (M6 — require live PostgreSQL).

Covers the course navigation progression work in
``services/orchestrator/app.py``:

  - Day N is locked until Day N-1's learner-visible nodes are all passed
    (``_day_unlocked`` / ``get_day`` 403 / ``list_days`` ``locked`` field).
  - The internal ``unlock`` node never appears in ``get_day``'s ``nodes``
    list, even on days whose YAML still declares one (Day 3+).
  - ``complete_node`` auto-passes ``unlock`` once every visible node is
    passed, and reports ``day_complete`` / ``next_day`` so the frontend can
    auto-advance to the next Day.
"""

from __future__ import annotations

import types
import uuid

import pytest
from sqlalchemy import text


def _fake_request(user_id: str, camp_id: str):
    """A minimal stand-in for FastAPI's ``Request`` — the orchestrator route
    functions only ever read ``request.state.user`` / ``request.state.camp_id``,
    so a bare namespace is enough to call them directly (no HTTP needed)."""
    from services.shared import AuthUser

    state = types.SimpleNamespace(
        user=AuthUser(id=user_id, email=f"{user_id}@fde.local", role="learner"),
        camp_id=camp_id,
    )
    return types.SimpleNamespace(state=state)


@pytest.fixture
def learner(require_postgres):
    """A throwaway learner + camp (with an active enrollment), cleaned up after."""
    from services.db import session_scope
    from services.shared.seed import hash_password, now_iso

    uid = str(uuid.uuid4())
    suffix = uid[:8]
    camp_id = f"testcamp-gate-{suffix}"
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
                "email": f"gate-{suffix}@fde.local",
                "ph": hash_password("x" + suffix),
                "dn": f"Gate {suffix}",
                "ts": now_iso(),
            },
        )
        s.execute(
            text("INSERT INTO camps (id, name, version) VALUES (:id, :name, 'v0.3')"),
            {"id": camp_id, "name": f"Gate Test {camp_id}"},
        )
        s.execute(
            text("INSERT INTO enrollments (user_id, camp_id, status) VALUES (:u, :c, 'active')"),
            {"u": uid, "c": camp_id},
        )

    yield uid, camp_id

    with session_scope() as s:
        s.execute(text("DELETE FROM node_progress WHERE learner_id=:u"), {"u": uid})
        s.execute(text("DELETE FROM quiz_attempts WHERE learner_id=:u"), {"u": uid})
        s.execute(text("DELETE FROM practice_responses WHERE learner_id=:u"), {"u": uid})
        s.execute(text("DELETE FROM capsule_progress WHERE learner_id=:u"), {"u": uid})
        s.execute(text("DELETE FROM enrollments WHERE user_id=:u"), {"u": uid})
        s.execute(text("DELETE FROM camps WHERE id=:id"), {"id": camp_id})
        s.execute(text("DELETE FROM users WHERE id=:u"), {"u": uid})


def _satisfy_learn_gate(learner_id: str, camp_id: str, day: int) -> None:
    """Pre-seed capsule_progress + submitted practice_responses so a direct
    ``complete_node("d{day}-learn", ...)`` call (bypassing the UI, as these
    gate tests do) passes the M7 learn-completion gate — mirrors what
    CapsuleReader does client-side (open every capsule, submit every
    required practice) before it lets the learner click "完成学习"."""
    from services.db import session_scope
    from services.orchestrator.app import _capsule_ids, _capsule_practice_required, _load_day_package

    data, _ = _load_day_package(day, camp_id, learner_id)
    learn = data.get("learn") or {}
    capsules = learn.get("capsules") or []
    if not capsules:
        return
    ids = _capsule_ids(capsules)
    with session_scope() as s:
        for cid in ids:
            s.execute(
                text(
                    """
                    INSERT INTO capsule_progress (learner_id, camp_id, day, capsule_id, opened_at)
                    VALUES (:u, :c, :d, :cap, NOW())
                    ON CONFLICT (learner_id, camp_id, day, capsule_id) DO NOTHING
                    """
                ),
                {"u": learner_id, "c": camp_id, "d": day, "cap": cid},
            )
        for capsule, cid in zip(capsules, ids):
            if not _capsule_practice_required(capsule):
                continue
            s.execute(
                text(
                    """
                    INSERT INTO practice_responses
                      (id, learner_id, camp_id, day, capsule_id, response_text, status, submitted_at, updated_at)
                    VALUES (:id, :u, :c, :d, :cap, 'ok', 'submitted', NOW(), NOW())
                    ON CONFLICT (learner_id, camp_id, day, capsule_id) DO UPDATE
                      SET status='submitted', submitted_at=NOW()
                    """
                ),
                {"id": str(uuid.uuid4()), "u": learner_id, "c": camp_id, "d": day, "cap": cid},
            )


def _complete(learner_id: str, camp_id: str, day: int, node_id: str) -> dict:
    from services.orchestrator.app import CompleteBody, complete_node

    if node_id.endswith("-learn"):
        _satisfy_learn_gate(learner_id, camp_id, day)
    req = _fake_request(learner_id, camp_id)
    return complete_node(node_id, CompleteBody(camp_id=camp_id, day=day), req)


def _complete_day1(learner_id: str, camp_id: str) -> dict:
    """day-01-curriculum.yaml has no `unlock` node (removed per M6 scope)."""
    result: dict = {}
    for kind in ("learn", "quiz", "lab", "project", "review"):
        result = _complete(learner_id, camp_id, 1, f"d1-{kind}")
    return result


def _complete_day2(learner_id: str, camp_id: str) -> dict:
    """day-02-curriculum.yaml also has no `unlock` node."""
    result: dict = {}
    for kind in ("learn", "quiz", "lab", "project", "review"):
        result = _complete(learner_id, camp_id, 2, f"d2-{kind}")
    return result


def test_day1_always_unlocked(learner):
    from services.orchestrator.app import _day_unlocked

    learner_id, camp_id = learner
    assert _day_unlocked(learner_id, camp_id, 1) is True


def test_day2_locked_before_day1_complete(learner):
    from fastapi import HTTPException

    from services.orchestrator.app import _day_unlocked, get_day, list_days

    learner_id, camp_id = learner
    assert _day_unlocked(learner_id, camp_id, 2) is False

    req = _fake_request(learner_id, camp_id)
    with pytest.raises(HTTPException) as exc:
        get_day(camp_id, 2, req)
    assert exc.value.status_code == 403

    listing = list_days(camp_id, req)
    by_day = {d.day: d for d in listing["days"]}
    assert by_day[1].locked is False
    assert by_day[2].locked is True


def test_day2_unlocked_after_day1_all_passed(learner):
    from services.orchestrator.app import _day_unlocked, get_day, list_days

    learner_id, camp_id = learner
    last = _complete_day1(learner_id, camp_id)
    assert last["day_complete"] is True
    assert last["next_day"] == 2

    assert _day_unlocked(learner_id, camp_id, 2) is True

    req = _fake_request(learner_id, camp_id)
    pkg = get_day(camp_id, 2, req)
    assert pkg.day == 2

    listing = list_days(camp_id, req)
    by_day = {d.day: d for d in listing["days"]}
    assert by_day[2].locked is False


def test_unlock_node_not_in_get_day_nodes(learner):
    """Day 3's YAML still declares an `unlock` node — verify it's filtered
    from the learner-facing package even though the backend still tracks it."""
    from services.orchestrator.app import get_day

    learner_id, camp_id = learner
    _complete_day1(learner_id, camp_id)
    _complete_day2(learner_id, camp_id)

    req = _fake_request(learner_id, camp_id)
    pkg = get_day(camp_id, 3, req)
    kinds = {n.kind for n in pkg.nodes}
    ids = {n.id for n in pkg.nodes}
    assert "unlock" not in kinds
    assert "d3-unlock" not in ids
    assert kinds == {"learn", "quiz", "lab", "project", "review"}


def test_unlock_auto_completed_and_day_advances(learner):
    """Completing every visible Day 3 node should silently pass the hidden
    `unlock` node and report day_complete/next_day for auto-advance."""
    from services.db import session_scope
    from services.orchestrator.app import _day_unlocked

    learner_id, camp_id = learner
    _complete_day1(learner_id, camp_id)
    _complete_day2(learner_id, camp_id)

    result: dict = {}
    for kind in ("learn", "quiz", "lab", "project", "review"):
        result = _complete(learner_id, camp_id, 3, f"d3-{kind}")

    assert result["day_complete"] is True
    assert result["next_day"] == 4
    # unlock is hidden — never surfaced as the node to advance to.
    assert result["unlocked"] is None

    with session_scope() as s:
        row = s.execute(
            text(
                "SELECT status FROM node_progress WHERE learner_id=:u AND camp_id=:c AND day=3 AND node_id='d3-unlock'"
            ),
            {"u": learner_id, "c": camp_id},
        ).mappings().first()
        assert row is not None
        assert row["status"] == "passed"

    assert _day_unlocked(learner_id, camp_id, 4) is True


def test_complete_node_day_complete_flags_before_last_node(learner):
    learner_id, camp_id = learner
    for kind in ("learn", "quiz", "lab", "project"):
        result = _complete(learner_id, camp_id, 1, f"d1-{kind}")
        assert result["day_complete"] is False
        assert result["next_day"] is None

    result = _complete(learner_id, camp_id, 1, "d1-review")
    assert result["day_complete"] is True
    assert result["next_day"] == 2
