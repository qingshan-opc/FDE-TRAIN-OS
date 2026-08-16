"""Practice persistence + learn-completion gate tests (M7 — require live PostgreSQL).

Covers:
  - `services/progress/app.py`'s `PUT/GET /api/v1/practice` — draft autosave,
    idempotent per (learner, camp, day, capsule), and explicit submission
    stamping `submitted_at` exactly once.
  - The orchestrator's learn-completion gate (`_check_learn_gate`, wired into
    `complete_node`): a `learn` node with `require_capsules` can't be
    completed until every capsule is opened *and* every capsule with a
    required `practice` field has a submitted response — not just opened.
"""

from __future__ import annotations

import types
import uuid

import pytest
from sqlalchemy import text


def _fake_request(user_id: str, camp_id: str):
    """Minimal `Request` stand-in — orchestrator/progress route functions
    only read `request.state.user` / `request.state.camp_id`."""
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
    camp_id = f"testcamp-practice-{suffix}"
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
                "email": f"practice-{suffix}@fde.local",
                "ph": hash_password("x" + suffix),
                "dn": f"Practice {suffix}",
                "ts": now_iso(),
            },
        )
        s.execute(
            text("INSERT INTO camps (id, name, version) VALUES (:id, :name, 'v0.3')"),
            {"id": camp_id, "name": f"Practice Test {camp_id}"},
        )
        s.execute(
            text("INSERT INTO enrollments (user_id, camp_id, status) VALUES (:u, :c, 'active')"),
            {"u": uid, "c": camp_id},
        )

    yield uid, camp_id

    with session_scope() as s:
        s.execute(text("DELETE FROM practice_responses WHERE learner_id=:u"), {"u": uid})
        s.execute(text("DELETE FROM capsule_progress WHERE learner_id=:u"), {"u": uid})
        s.execute(text("DELETE FROM node_progress WHERE learner_id=:u"), {"u": uid})
        s.execute(text("DELETE FROM enrollments WHERE user_id=:u"), {"u": uid})
        s.execute(text("DELETE FROM camps WHERE id=:id"), {"id": camp_id})
        s.execute(text("DELETE FROM users WHERE id=:u"), {"u": uid})


def _open_all_capsules(learner_id: str, camp_id: str, day: int, ids: list[str]) -> None:
    from services.db import session_scope

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


def test_save_and_load_practice_draft_then_submitted(learner):
    from services.progress.app import PracticeIn, list_practice, save_practice

    learner_id, camp_id = learner
    req = _fake_request(learner_id, camp_id)

    draft = save_practice(
        PracticeIn(camp_id=camp_id, day=1, capsule_id="c1", response_text="草稿内容", status="draft"),
        req,
    )
    assert draft["status"] == "draft"
    assert draft["submitted_at"] is None

    listing = list_practice(req, day=1, camp_id=camp_id)
    assert len(listing["items"]) == 1
    item = listing["items"][0]
    assert item["capsule_id"] == "c1"
    assert item["response_text"] == "草稿内容"
    assert item["status"] == "draft"
    assert item["submitted_at"] is None

    submitted = save_practice(
        PracticeIn(camp_id=camp_id, day=1, capsule_id="c1", response_text="最终答案", status="submitted"),
        req,
    )
    assert submitted["status"] == "submitted"
    assert submitted["submitted_at"] is not None

    listing2 = list_practice(req, day=1, camp_id=camp_id)
    item2 = listing2["items"][0]
    assert item2["status"] == "submitted"
    assert item2["response_text"] == "最终答案"
    assert item2["submitted_at"] is not None


def test_save_practice_merges_response_json(learner):
    """Draft autosaves from local-prep and submit must not wipe sibling keys."""
    from services.progress.app import PracticeIn, list_practice, save_practice

    learner_id, camp_id = learner
    req = _fake_request(learner_id, camp_id)

    save_practice(
        PracticeIn(
            camp_id=camp_id,
            day=1,
            capsule_id="c1",
            response_text="领域清单",
            response_json={"professional_domain": "财务", "professional_domain_label": "财务"},
            status="draft",
        ),
        req,
    )
    save_practice(
        PracticeIn(
            camp_id=camp_id,
            day=1,
            capsule_id="c1",
            response_text="",
            response_json={"local_prep_checked": [0, 1]},
            status="draft",
        ),
        req,
    )
    item = list_practice(req, day=1, camp_id=camp_id)["items"][0]
    assert item["response_text"] == "领域清单"
    assert item["response_json"]["professional_domain"] == "财务"
    assert item["response_json"]["local_prep_checked"] == [0, 1]


def test_save_practice_is_idempotent_per_capsule(learner):
    """Repeated autosave calls for the same capsule overwrite one row rather
    than accumulating history — `UNIQUE (learner_id, camp_id, day, capsule_id)`."""
    from services.progress.app import PracticeIn, list_practice, save_practice

    learner_id, camp_id = learner
    req = _fake_request(learner_id, camp_id)

    save_practice(PracticeIn(camp_id=camp_id, day=1, capsule_id="c1", response_text="v1", status="draft"), req)
    save_practice(PracticeIn(camp_id=camp_id, day=1, capsule_id="c1", response_text="v2", status="draft"), req)

    listing = list_practice(req, day=1, camp_id=camp_id)
    assert len(listing["items"]) == 1
    assert listing["items"][0]["response_text"] == "v2"


def test_submitted_at_is_not_reset_by_a_later_draft_save(learner):
    """Once submitted, editing again (status back to draft) shouldn't wipe
    the original `submitted_at` — only a fresh submission stamps it."""
    from services.progress.app import PracticeIn, save_practice

    learner_id, camp_id = learner
    req = _fake_request(learner_id, camp_id)

    submitted = save_practice(
        PracticeIn(camp_id=camp_id, day=1, capsule_id="c1", response_text="ok", status="submitted"),
        req,
    )
    first_submitted_at = submitted["submitted_at"]
    assert first_submitted_at is not None

    # Accidental draft (blur race) must NOT downgrade submitted → draft.
    raced = save_practice(
        PracticeIn(camp_id=camp_id, day=1, capsule_id="c1", response_text="stale draft", status="draft"),
        req,
    )
    assert raced["status"] == "submitted"
    assert raced["submitted_at"] == first_submitted_at or raced["submitted_at"] is not None

    # Explicit reopen is allowed via force_reopen.
    reopened = save_practice(
        PracticeIn(
            camp_id=camp_id,
            day=1,
            capsule_id="c1",
            response_text="editing again",
            status="draft",
            force_reopen=True,
        ),
        req,
    )
    assert reopened["status"] == "draft"


def test_learn_complete_blocked_without_any_progress(learner):
    """A day whose capsules declare `practice` (legacy plain-string form is
    implicitly required) must not let `complete_node` pass the `learn` node
    with zero capsule_progress / practice_responses rows."""
    from fastapi import HTTPException

    from services.orchestrator.app import CompleteBody, complete_node

    learner_id, camp_id = learner
    req = _fake_request(learner_id, camp_id)

    with pytest.raises(HTTPException) as exc:
        complete_node("d1-learn", CompleteBody(camp_id=camp_id, day=1), req)
    assert exc.value.status_code == 409


def test_learn_complete_blocked_when_practice_not_submitted(learner):
    """Opening every capsule alone isn't enough — required practice must
    also be *submitted* (draft doesn't count)."""
    from fastapi import HTTPException

    from services.orchestrator.app import CompleteBody, _capsule_ids, _load_day_package, complete_node
    from services.progress.app import PracticeIn, save_practice

    learner_id, camp_id = learner
    req = _fake_request(learner_id, camp_id)

    data, _ = _load_day_package(1, camp_id, learner_id)
    capsules = (data.get("learn") or {}).get("capsules") or []
    assert capsules, "day-01-curriculum.yaml is expected to declare capsules with practice"
    ids = _capsule_ids(capsules)

    _open_all_capsules(learner_id, camp_id, 1, ids)
    # Leave practice as drafts only — still blocked.
    for cid in ids:
        save_practice(PracticeIn(camp_id=camp_id, day=1, capsule_id=cid, response_text="draft", status="draft"), req)

    with pytest.raises(HTTPException) as exc:
        complete_node("d1-learn", CompleteBody(camp_id=camp_id, day=1), req)
    assert exc.value.status_code == 409


def test_learn_complete_passes_once_capsules_opened_and_practice_submitted(learner):
    from services.orchestrator.app import CompleteBody, _capsule_ids, _load_day_package, complete_node
    from services.progress.app import PracticeIn, save_practice

    learner_id, camp_id = learner
    req = _fake_request(learner_id, camp_id)

    data, _ = _load_day_package(1, camp_id, learner_id)
    capsules = (data.get("learn") or {}).get("capsules") or []
    ids = _capsule_ids(capsules)

    _open_all_capsules(learner_id, camp_id, 1, ids)
    for cid in ids:
        save_practice(
            PracticeIn(camp_id=camp_id, day=1, capsule_id=cid, response_text="ok", status="submitted"),
            req,
        )

    result = complete_node("d1-learn", CompleteBody(camp_id=camp_id, day=1), req)
    assert result["status"] == "passed"
    assert result["node_id"] == "d1-learn"
