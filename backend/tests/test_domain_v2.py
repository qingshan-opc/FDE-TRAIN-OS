"""Domain model v2 integration tests (require live PostgreSQL).

Covers:
  - seed_domain_v2 creates the fde-two-week course + a camp-v03 offering
  - a single user can hold two distinct enrollments (two offerings)
  - node progress is isolated per enrollment_id when it is set
"""

from __future__ import annotations

import uuid

import pytest
from sqlalchemy import text


@pytest.fixture(scope="module", autouse=True)
def _bootstrap(require_postgres):
    """Ensure schema + baseline seed exist before the domain v2 tests run."""
    from services.migrations_runner.__main__ import run_migrations
    from services.shared.seed import seed_defaults

    run_migrations()
    seed_defaults()
    yield


def test_seed_creates_course_and_offering():
    from services.db import session_scope
    from services.models.course import Course, CourseOffering
    from services.shared.seed_domain_v2 import seed_domain_v2

    summary = seed_domain_v2()
    assert summary["course_id"]
    assert summary["offering_id"]

    with session_scope() as s:
        course = s.query(Course).filter(Course.slug == "fde-two-week").one_or_none()
        assert course is not None
        offering = s.get(CourseOffering, summary["offering_id"])
        assert offering is not None
        assert offering.camp_id == "camp-v03"


def _make_user(session, suffix: str) -> str:
    from services.shared.seed import hash_password, now_iso

    uid = str(uuid.uuid4())
    session.execute(
        text(
            """
            INSERT INTO users (id, email, password_hash, display_name, role, created_at)
            VALUES (:id, :email, :ph, :dn, 'learner', :ts)
            """
        ),
        {
            "id": uid,
            "email": f"dv2-{suffix}@fde.local",
            "ph": hash_password("x" + suffix),
            "dn": f"DV2 {suffix}",
            "ts": now_iso(),
        },
    )
    return uid


def test_user_can_hold_two_enrollments():
    from services.db import session_scope
    from services.repositories import CourseRepository, EnrollmentRepository

    suffix = uuid.uuid4().hex[:8]
    created = {"users": [], "offerings": [], "courses": [], "enrollments": []}
    try:
        with session_scope() as s:
            uid = _make_user(s, suffix)
            created["users"].append(uid)
            crepo = CourseRepository(s)
            erepo = EnrollmentRepository(s)

            course_a = crepo.get_or_create_course(f"dv2-a-{suffix}", "DV2 Course A")
            course_b = crepo.get_or_create_course(f"dv2-b-{suffix}", "DV2 Course B")
            created["courses"] += [course_a.id, course_b.id]

            off_a = crepo.get_or_create_offering(title="Offering A", camp_id=None)
            off_b = crepo.get_or_create_offering(title="Offering B", camp_id=None)
            created["offerings"] += [off_a.id, off_b.id]

            enr_a = erepo.get_or_create(uid, off_a.id)
            enr_b = erepo.get_or_create(uid, off_b.id)
            created["enrollments"] += [enr_a.id, enr_b.id]

            rows = erepo.list_for_user(uid)
            assert len(rows) == 2
            assert {r.offering_id for r in rows} == {off_a.id, off_b.id}
    finally:
        _cleanup(created)


def test_progress_isolation_by_enrollment():
    from services.db import session_scope
    from services.repositories import CourseRepository, EnrollmentRepository
    from services.repositories.progress_repository import ProgressRepository

    suffix = uuid.uuid4().hex[:8]
    created = {"users": [], "offerings": [], "courses": [], "enrollments": [], "progress": []}
    camp_a = f"testcamp-A-{suffix}"
    camp_b = f"testcamp-B-{suffix}"
    try:
        with session_scope() as s:
            uid = _make_user(s, suffix)
            created["users"].append(uid)
            crepo = CourseRepository(s)
            erepo = EnrollmentRepository(s)
            prepo = ProgressRepository(s)

            off_a = crepo.get_or_create_offering(title="Iso A", camp_id=None)
            off_b = crepo.get_or_create_offering(title="Iso B", camp_id=None)
            created["offerings"] += [off_a.id, off_b.id]
            enr_a = erepo.get_or_create(uid, off_a.id)
            enr_b = erepo.get_or_create(uid, off_b.id)
            created["enrollments"] += [enr_a.id, enr_b.id]

            prepo.set_status(uid, camp_a, 1, "d1-quiz", "passed", enrollment_id=enr_a.id)
            prepo.set_status(uid, camp_b, 1, "d1-quiz", "passed", enrollment_id=enr_b.id)
            created["progress"] += [(uid, camp_a), (uid, camp_b)]

            # Each enrollment sees only its own passed node.
            assert prepo.count_passed(uid, camp_a, 1, enrollment_id=enr_a.id) == 1
            assert prepo.count_passed(uid, camp_b, 1, enrollment_id=enr_b.id) == 1
            # Cross-enrollment query is isolated.
            assert prepo.count_passed(uid, camp_a, 1, enrollment_id=enr_b.id) == 0
            # get_status honors the enrollment filter.
            assert prepo.get_status(uid, camp_a, 1, "d1-quiz", enrollment_id=enr_a.id) == "passed"
            assert prepo.get_status(uid, camp_a, 1, "d1-quiz", enrollment_id=enr_b.id) is None
    finally:
        _cleanup(created)


def _cleanup(created: dict) -> None:
    from services.db import session_scope

    with session_scope() as s:
        for uid, camp in created.get("progress", []):
            s.execute(
                text("DELETE FROM node_progress WHERE learner_id=:u AND camp_id=:c"),
                {"u": uid, "c": camp},
            )
        for eid in created.get("enrollments", []):
            s.execute(text("DELETE FROM enrollment_records WHERE id=:id"), {"id": eid})
        for oid in created.get("offerings", []):
            s.execute(text("DELETE FROM course_offerings WHERE id=:id"), {"id": oid})
        for cid in created.get("courses", []):
            s.execute(text("DELETE FROM courses WHERE id=:id"), {"id": cid})
        for uid in created.get("users", []):
            s.execute(text("DELETE FROM users WHERE id=:id"), {"id": uid})
