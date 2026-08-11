"""Domain v2 seed + backfill.

Bridges the legacy camp-centric data into the v2 Course / Offering / Enrollment
model, idempotently:

  1. Create the ``fde-two-week`` course from ``camp-v03``.
  2. Link (or create) a published ``course_version`` to that course.
  3. Create a ``course_offering`` bound to ``camp-v03`` + that version.
  4. Create ``enrollment_records`` for every existing legacy enrollment.
  5. Backfill ``enrollment_id`` on ``node_progress`` (and ``evidence`` for
     single-enrollment learners) where it is currently NULL.

Safe to run repeatedly. Intended for dev/seed and post-migration bootstrap; it
does nothing destructive.
"""

from __future__ import annotations

import json
import logging
from typing import Any
from uuid import uuid4

from sqlalchemy import select, text

from services.db import session_scope
from services.models.rubric import RubricCriterion, RubricDefinition
from services.repositories.course_repository import CourseRepository
from services.repositories.enrollment_repository import EnrollmentRepository
from services.repositories.progress_repository import ProgressRepository

log = logging.getLogger("fde.seed_v2")

from services.shared.config import DEFAULT_CAMP_ID

COURSE_SLUG = "fde-two-week"


def seed_domain_v2(camp_id: str = DEFAULT_CAMP_ID) -> dict[str, Any]:
    summary: dict[str, Any] = {
        "camp_id": camp_id,
        "course_id": None,
        "course_version_id": None,
        "offering_id": None,
        "enrollments_created": 0,
        "node_progress_backfilled": 0,
        "evidence_backfilled": 0,
    }

    with session_scope() as session:
        # 0) camp must exist (seed_defaults creates camp-v03 first)
        camp = session.execute(
            text("SELECT id, name FROM camps WHERE id = :id"), {"id": camp_id}
        ).first()
        if not camp:
            log.warning("seed_domain_v2: camp %s not found; skipping", camp_id)
            return summary

        course_repo = CourseRepository(session)
        enroll_repo = EnrollmentRepository(session)
        progress_repo = ProgressRepository(session)

        # 1) course
        course = course_repo.get_or_create_course(
            slug=COURSE_SLUG,
            title=camp.name or "FDE 两周课",
            description="FDE 两周训练营（由 camp-v03 迁移生成）",
        )
        summary["course_id"] = course.id

        # 2) course_version selection:
        # Prefer the version already bound to an active offering (so bootstrap
        # cannot flip learners onto a stale seed that merely has more day rows).
        # Only when no offering exists / current version has zero packages, pick
        # the richest published version.
        existing_offering = session.execute(
            text(
                """
                SELECT o.id AS id, o.course_version_id AS cv,
                       (SELECT COUNT(*) FROM day_packages dp
                        WHERE dp.course_version_id = o.course_version_id) AS pkgs
                FROM course_offerings o
                WHERE o.camp_id = :camp AND o.status = 'active'
                ORDER BY o.created_at DESC NULLS LAST
                LIMIT 1
                """
            ),
            {"camp": camp_id},
        ).first()

        version_id = None
        if existing_offering and existing_offering.cv and int(existing_offering.pkgs or 0) > 0:
            version_id = existing_offering.cv
        else:
            version = session.execute(
                text(
                    """
                    SELECT cv.id AS id, COUNT(dp.id) AS pkgs
                    FROM course_versions cv
                    LEFT JOIN day_packages dp ON dp.course_version_id = cv.id
                    WHERE cv.camp_id = :camp
                    GROUP BY cv.id, cv.status, cv.published_at, cv.created_at
                    ORDER BY pkgs DESC,
                             (cv.status = 'published') DESC,
                             cv.published_at DESC NULLS LAST,
                             cv.created_at DESC
                    LIMIT 1
                    """
                ),
                {"camp": camp_id},
            ).first()
            version_id = version.id if version else None

        if version_id:
            course_repo.link_version_to_course(version_id, course.id)
        summary["course_version_id"] = version_id

        if version_id:
            try:
                summary["rubrics"] = seed_rubric_definitions(version_id, session=session)
            except Exception as exc:
                log.warning("seed_rubric_definitions skipped for %s: %s", version_id, exc)

        # 3) offering bound to the camp + version.
        # Do NOT re-point an existing offering that already has packages — that
        # previously yanked learners from fde-v07 (good Day1) back to v0.7 after
        # bootstrap seeded extra week-3 stub days onto the stale version.
        offering = course_repo.get_or_create_offering(
            title=course.title,
            course_version_id=version_id,
            camp_id=camp_id,
        )
        current_pkgs = session.execute(
            text("SELECT COUNT(*) AS c FROM day_packages WHERE course_version_id = :cv"),
            {"cv": offering.course_version_id},
        ).scalar()
        if (
            version_id
            and offering.course_version_id != version_id
            and int(current_pkgs or 0) == 0
        ):
            offering.course_version_id = version_id
            session.flush()
        summary["offering_id"] = offering.id

        # 4) enrollment_records from legacy enrollments
        legacy = session.execute(
            text(
                """
                SELECT user_id FROM enrollments
                WHERE camp_id = :camp AND status = 'active'
                """
            ),
            {"camp": camp_id},
        ).all()
        created = 0
        learner_ids: list[str] = []
        for row in legacy:
            uid = row.user_id
            learner_ids.append(uid)
            before = enroll_repo.get_by_user_and_offering(uid, offering.id)
            rec = enroll_repo.get_or_create(uid, offering.id)
            if before is None:
                created += 1
            # 5a) backfill node_progress for this learner/camp
            summary["node_progress_backfilled"] += progress_repo.backfill_enrollment_id(
                uid, camp_id, rec.id
            )
            # 5b) backfill evidence only for learners with a single enrollment
            enr_count = len(enroll_repo.list_for_user(uid))
            if enr_count == 1:
                res = session.execute(
                    text(
                        """
                        UPDATE evidence
                        SET enrollment_id = :eid
                        WHERE learner_id = :uid AND enrollment_id IS NULL
                        """
                    ),
                    {"eid": rec.id, "uid": uid},
                )
                summary["evidence_backfilled"] += res.rowcount or 0
        summary["enrollments_created"] = created

    log.info("seed_domain_v2 done: %s", summary)
    return summary


def ensure_enrollment_record(user_id: str, camp_id: str) -> str | None:
    """Idempotently create a v2 ``enrollment_records`` row for a learner who
    just joined ``camp_id`` via the legacy invite/login path (which only
    writes the old ``enrollments`` table).

    Without this, ``/api/v1/me/enrollments`` (backing the CoursePicker) stays
    empty for a freshly invited learner until the next full
    :func:`seed_domain_v2` backfill pass runs on process boot. Safe to call on
    every login/invite — cheap lookups, no-op if the record already exists.
    """
    with session_scope() as session:
        course_repo = CourseRepository(session)
        enroll_repo = EnrollmentRepository(session)
        offering = course_repo.get_offering_by_camp(camp_id)
        if offering is None:
            camp = session.execute(
                text("SELECT id, name FROM camps WHERE id = :id"), {"id": camp_id}
            ).first()
            if not camp:
                return None
            course = course_repo.get_or_create_course(
                slug=f"camp-{camp_id}", title=camp.name or camp_id
            )
            offering = course_repo.get_or_create_offering(title=course.title, camp_id=camp_id)
        rec = enroll_repo.get_or_create(user_id, offering.id)
        return rec.id


def seed_rubric_definitions(course_version_id: str, *, session: Any = None) -> dict[str, Any]:
    """Upsert ``rubric_definitions`` + ``rubric_criteria`` for every day's
    ``lab.rubric`` in a course version, sourced from the canonical Chinese
    check registry (:mod:`services.shared.rubric_registry`).

    Idempotent: keyed by ``(course_version_id, node_key)`` so re-publishing
    or re-running this simply refreshes the criteria in place (old criteria
    for that rubric are replaced, not accumulated).

    Pass an existing SQLAlchemy ``session`` to run inside a caller's
    transaction (e.g. from ``seed_domain_v2`` or an author publish endpoint);
    omitted, this opens and commits its own ``session_scope()``.
    """
    from contextlib import nullcontext

    from services.shared.rubric_registry import REGISTRY

    summary = {"course_version_id": course_version_id, "rubrics": 0, "criteria": 0}
    scope = nullcontext(session) if session is not None else session_scope()
    with scope as s:
        rows = s.execute(
            text("SELECT day, title, package_json FROM day_packages WHERE course_version_id = :cv"),
            {"cv": course_version_id},
        ).all()
        for row in rows:
            pkg = row.package_json
            if isinstance(pkg, str):
                pkg = json.loads(pkg)
            lab = (pkg or {}).get("lab") or {}
            rubric_items = lab.get("rubric") or []
            if not rubric_items:
                continue

            node_key = f"d{row.day}-lab"
            title = f"{row.title or f'Day {row.day}'} · Lab 评测"
            config = {"sim_kind": lab.get("sim_kind"), "agent": bool(lab.get("agent"))}

            existing = s.scalar(
                select(RubricDefinition).where(
                    RubricDefinition.course_version_id == course_version_id,
                    RubricDefinition.node_key == node_key,
                )
            )
            if existing:
                existing.title = title
                existing.runner = lab.get("runner")
                existing.config_json = config
                for crit in list(existing.criteria):
                    s.delete(crit)
                s.flush()
                rubric_def = existing
            else:
                rubric_def = RubricDefinition(
                    id=str(uuid4()),
                    course_version_id=course_version_id,
                    node_key=node_key,
                    title=title,
                    runner=lab.get("runner"),
                    config_json=config,
                )
                s.add(rubric_def)
                s.flush()
            summary["rubrics"] += 1

            for i, item in enumerate(rubric_items):
                if not isinstance(item, dict):
                    continue
                check_id = str(item.get("check") or "")
                spec = REGISTRY.get(check_id)
                weight = float(item.get("weight") or (spec.weight if spec else 1.0))
                s.add(
                    RubricCriterion(
                        id=str(uuid4()),
                        rubric_id=rubric_def.id,
                        check_id=check_id,
                        args_json=item.get("args") or {},
                        weight=weight,
                        sort_order=i,
                    )
                )
                summary["criteria"] += 1
        s.flush()
    log.info("seed_rubric_definitions(%s): %s", course_version_id, summary)
    return summary


if __name__ == "__main__":
    logging.basicConfig(level="INFO")
    print(seed_domain_v2())
