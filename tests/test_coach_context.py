"""M5 coach context / diagnosis tests (require live PostgreSQL).

Covers:
- ``build_coach_context`` resolves course_version/day_tags/node rubric scoped
  to one camp+learner+day+node (never a global/unscoped tag set).
- Recent quiz/lab failures are picked up from the DB and drive ``fail_count``.
- ``build_diagnosis`` produces a structured, Chinese, LLM-free diagnosis in
  every case (no lingzhi/anyCode call involved at all) — the M5 offline
  degradation guarantee.
"""

from __future__ import annotations

import json
import uuid

import pytest
from sqlalchemy import text


@pytest.fixture
def scoped_camp(require_postgres):
    """One learner + camp + published course_version/day_package/offering/
    enrollment — enough to exercise the full context-resolution path."""
    from services.db import session_scope
    from services.shared.seed import hash_password, now_iso

    uid = str(uuid.uuid4())
    suffix = uid[:8]
    camp_id = f"testcamp-cc-{suffix}"
    version_id = str(uuid.uuid4())
    offering_id = str(uuid.uuid4())
    enrollment_id = str(uuid.uuid4())

    package_json = {
        "day": 1,
        "title": "Day1",
        "learn": {"lingzhi_tags": ["camp:v0.3", "day:1", "topic:fde-role"]},
        "nodes": [{"type": "learn", "title": "L"}, {"type": "lab", "title": "Lab"}],
        "lab": {
            "runner": "agent",
            "rubric": [{"check": "file_exists", "args": {"path": "index.html"}}],
        },
    }

    with session_scope() as s:
        s.execute(
            text(
                "INSERT INTO users (id, email, password_hash, display_name, role, created_at) "
                "VALUES (:id, :email, :ph, :dn, 'learner', :ts)"
            ),
            {"id": uid, "email": f"cc-{suffix}@fde.local", "ph": hash_password("x" + suffix), "dn": f"CC {suffix}", "ts": now_iso()},
        )
        s.execute(text("INSERT INTO camps (id, name, version) VALUES (:id, :name, 'v0.3')"), {"id": camp_id, "name": f"Coach Ctx {camp_id}"})
        s.execute(
            text(
                "INSERT INTO course_versions (id, camp_id, version_tag, status, title, created_at) "
                "VALUES (:id, :camp, 'v1', 'published', 'Test Course', NOW())"
            ),
            {"id": version_id, "camp": camp_id},
        )
        s.execute(
            text(
                "INSERT INTO day_packages (id, course_version_id, day, title, package_json) "
                "VALUES (:id, :cv, 1, 'Day1', (:pkg)::jsonb)"
            ),
            {"id": str(uuid.uuid4()), "cv": version_id, "pkg": json.dumps(package_json, ensure_ascii=False)},
        )
        s.execute(
            text(
                "INSERT INTO course_offerings (id, course_version_id, camp_id, title, status) "
                "VALUES (:id, :cv, :camp, 'Offering', 'active')"
            ),
            {"id": offering_id, "cv": version_id, "camp": camp_id},
        )
        s.execute(
            text("INSERT INTO enrollment_records (id, user_id, offering_id, status) VALUES (:id, :uid, :off, 'active')"),
            {"id": enrollment_id, "uid": uid, "off": offering_id},
        )

    yield {"learner_id": uid, "camp_id": camp_id, "course_version_id": version_id, "enrollment_id": enrollment_id}

    with session_scope() as s:
        s.execute(text("DELETE FROM mentor_reviews WHERE learner_id=:u"), {"u": uid})
        s.execute(text("DELETE FROM coach_turns WHERE learner_id=:u"), {"u": uid})
        s.execute(text("DELETE FROM submissions WHERE learner_id=:u"), {"u": uid})
        s.execute(text("DELETE FROM quiz_attempts WHERE learner_id=:u"), {"u": uid})
        s.execute(text("DELETE FROM enrollment_records WHERE id=:id"), {"id": enrollment_id})
        s.execute(text("DELETE FROM course_offerings WHERE id=:id"), {"id": offering_id})
        s.execute(text("DELETE FROM day_packages WHERE course_version_id=:cv"), {"cv": version_id})
        s.execute(text("DELETE FROM course_versions WHERE id=:id"), {"id": version_id})
        s.execute(text("DELETE FROM camps WHERE id=:id"), {"id": camp_id})
        s.execute(text("DELETE FROM users WHERE id=:u"), {"u": uid})


def test_context_resolves_course_version_and_authorized_day_tags(scoped_camp):
    from services.application.coach_context import build_coach_context

    ctx = build_coach_context(
        camp_id=scoped_camp["camp_id"],
        learner_id=scoped_camp["learner_id"],
        day=1,
        node_id="d1-lab",
    )

    assert ctx["course_version_id"] == scoped_camp["course_version_id"]
    assert ctx["enrollment_id"] == scoped_camp["enrollment_id"]
    # Authorized tags come from this course_version/day's package — never a
    # global/unscoped tag set.
    assert ctx["day_tags"] == ["camp:v0.3", "day:1", "topic:fde-role"]
    assert ctx["node"]["kind"] == "lab"
    assert ctx["node"]["rubric"], "rubric should be enriched from the day package"
    assert ctx["node"]["rubric"][0]["title_zh"] == "文件存在"


def test_context_falls_back_to_camp_day_tags_without_course_version(require_postgres):
    from services.application.coach_context import build_coach_context
    from services.db import session_scope
    from services.shared.seed import hash_password, now_iso

    uid = str(uuid.uuid4())
    suffix = uid[:8]
    camp_id = f"testcamp-cc-nocv-{suffix}"
    with session_scope() as s:
        s.execute(
            text(
                "INSERT INTO users (id, email, password_hash, display_name, role, created_at) "
                "VALUES (:id, :email, :ph, :dn, 'learner', :ts)"
            ),
            {"id": uid, "email": f"cc-nocv-{suffix}@fde.local", "ph": hash_password("x" + suffix), "dn": "NoCV", "ts": now_iso()},
        )
        s.execute(text("INSERT INTO camps (id, name, version) VALUES (:id, :name, 'v0.3')"), {"id": camp_id, "name": camp_id})

    try:
        ctx = build_coach_context(camp_id=camp_id, learner_id=uid, day=2, node_id=None)
        assert ctx["course_version_id"] is None
        assert ctx["node"] is None
        assert ctx["day_tags"] == [f"camp:{camp_id}", "day:2"]
        assert ctx["fail_count"] == 0
    finally:
        with session_scope() as s:
            s.execute(text("DELETE FROM camps WHERE id=:id"), {"id": camp_id})
            s.execute(text("DELETE FROM users WHERE id=:u"), {"u": uid})


def test_context_picks_up_recent_quiz_and_lab_failures(scoped_camp):
    from services.application.coach_context import build_coach_context
    from services.db import session_scope

    with session_scope() as s:
        s.execute(
            text(
                "INSERT INTO quiz_attempts (id, learner_id, camp_id, day, node_id, score, pass, created_at) "
                "VALUES (:id, :u, :c, 1, 'd1-quiz', 0.3, 0, NOW())"
            ),
            {"id": str(uuid.uuid4()), "u": scoped_camp["learner_id"], "c": scoped_camp["camp_id"]},
        )
        s.execute(
            text(
                "INSERT INTO submissions (id, camp_id, learner_id, day, node_id, eval_json, status, created_at) "
                "VALUES (:id, :c, :u, 1, 'd1-lab', (:ev)::jsonb, 'failed', NOW())"
            ),
            {
                "id": str(uuid.uuid4()),
                "c": scoped_camp["camp_id"],
                "u": scoped_camp["learner_id"],
                "ev": json.dumps(
                    {
                        "pass": False,
                        "score": 0.0,
                        "checks": [
                            {"id": "file_exists", "ok": False, "detail": "missing", "args": {"path": "index.html"}}
                        ],
                    }
                ),
            },
        )

    ctx = build_coach_context(
        camp_id=scoped_camp["camp_id"], learner_id=scoped_camp["learner_id"], day=1, node_id="d1-lab"
    )
    assert len(ctx["quiz_failures"]) == 1
    assert ctx["fail_count"] == 2  # 1 quiz fail + 1 lab fail
    assert ctx["latest_eval"]["pass"] is False
    assert ctx["latest_submission_id"]


def test_diagnosis_offline_mode_never_calls_llm_and_flags_failed_check(scoped_camp):
    """Offline diagnosis must work purely from rubric-enriched eval data —
    no lingzhi/anyCode dependency at all."""
    from services.application.coach_context import build_coach_context, build_diagnosis

    ctx = build_coach_context(
        camp_id=scoped_camp["camp_id"], learner_id=scoped_camp["learner_id"], day=1, node_id="d1-lab"
    )
    # Simulate a failed lab eval directly on the context (no DB write needed —
    # build_diagnosis is a pure function of the context dict).
    ctx["latest_eval"] = {
        "pass": False,
        "checks": [
            {
                "id": "file_exists",
                "ok": False,
                "title_zh": "文件存在",
                "suggestion": "请在工作区根目录创建并保存文件 index.html。",
            }
        ],
    }
    ctx["fail_count"] = 1

    diag = build_diagnosis(ctx)
    assert diag["mode"] == "offline"
    assert diag["next_action"] == "retry_lab"
    assert diag["next_action_zh"] == "重做 Lab"
    assert "file_exists" in diag["error_tags"]
    assert diag["diagnosis_zh"]
    assert diag["next_node_hint"] == "d1-lab"


def test_diagnosis_escalates_to_mentor_after_repeated_failures():
    from services.application.coach_context import build_diagnosis

    ctx = {"latest_eval": {}, "quiz_failures": [], "fail_count": 3, "node_id": "d1-lab"}
    diag = build_diagnosis(ctx)
    assert diag["next_action"] == "ask_mentor"
    assert diag["next_action_zh"] == "申请导师复核"


def test_diagnosis_continue_when_no_failures():
    from services.application.coach_context import build_diagnosis

    diag = build_diagnosis({"latest_eval": None, "quiz_failures": [], "fail_count": 0, "node_id": None})
    assert diag["next_action"] == "continue"
    assert diag["error_tags"] == []
    assert diag["next_node_hint"] is None
