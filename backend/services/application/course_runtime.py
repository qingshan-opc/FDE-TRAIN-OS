"""Course runtime helpers — dual-read day packages from the DB (domain v2).

The orchestrator historically loads a day's package from YAML contract files.
With domain v2 a day's package can also live in the DB as
``day_packages.package_json`` for a specific ``course_version``. These helpers
resolve the right course version for a learner/camp/enrollment and return the
stored package so the orchestrator can prefer the DB and fall back to YAML.

Everything here is read-only and self-contained (opens its own SQLAlchemy
session), so it is safe to call from the request path without threading a
session through.
"""

from __future__ import annotations

from typing import Any

from sqlalchemy import text

from services.db import session_scope


def resolve_course_version_for_enrollment(enrollment_id: str) -> str | None:
    """enrollment -> offering -> course_version_id."""
    if not enrollment_id:
        return None
    with session_scope() as session:
        row = session.execute(
            text(
                """
                SELECT o.course_version_id AS cv
                FROM enrollment_records e
                JOIN course_offerings o ON o.id = e.offering_id
                WHERE e.id = :eid
                """
            ),
            {"eid": enrollment_id},
        ).first()
        return row.cv if row else None


def resolve_course_version_for_camp_learner(camp_id: str, learner_id: str | None) -> str | None:
    """Best-effort: the learner's newest offering in this camp -> its version.

    Falls back to ``None`` so callers can try the camp-level published version.
    """
    if not (camp_id and learner_id):
        return None
    with session_scope() as session:
        row = session.execute(
            text(
                """
                SELECT o.course_version_id AS cv
                FROM enrollment_records e
                JOIN course_offerings o ON o.id = e.offering_id
                WHERE e.user_id = :uid AND o.camp_id = :camp
                ORDER BY e.created_at DESC
                LIMIT 1
                """
            ),
            {"uid": learner_id, "camp": camp_id},
        ).first()
        return row.cv if row else None


def resolve_published_version_for_camp(camp_id: str) -> str | None:
    """Prefer the active offering's version (what learners actually take), then
    fall back to newest published course_version for the camp."""
    if not camp_id:
        return None
    with session_scope() as session:
        offering = session.execute(
            text(
                """
                SELECT course_version_id AS cv
                FROM course_offerings
                WHERE camp_id = :camp AND status = 'active'
                  AND course_version_id IS NOT NULL
                ORDER BY created_at DESC NULLS LAST
                LIMIT 1
                """
            ),
            {"camp": camp_id},
        ).first()
        if offering and offering.cv:
            return offering.cv
        row = session.execute(
            text(
                """
                SELECT id FROM course_versions
                WHERE camp_id = :camp AND status = 'published'
                ORDER BY published_at DESC NULLS LAST, created_at DESC
                LIMIT 1
                """
            ),
            {"camp": camp_id},
        ).first()
        return row.id if row else None


def load_day_package(course_version_id: str, day: int) -> dict[str, Any] | None:
    """Return the stored ``package_json`` for a (course_version, day), or None."""
    if not course_version_id:
        return None
    with session_scope() as session:
        row = session.execute(
            text(
                """
                SELECT package_json FROM day_packages
                WHERE course_version_id = :cv AND day = :day
                """
            ),
            {"cv": course_version_id, "day": int(day)},
        ).first()
        if not row:
            return None
        pkg = row.package_json
        if isinstance(pkg, dict):
            return pkg
        return None


def get_day_data(
    camp_id: str,
    day: int,
    *,
    learner_id: str | None = None,
    enrollment_id: str | None = None,
) -> tuple[dict[str, Any], str] | None:
    """Dual-read a day package from the DB.

    Resolution order for the course version:
      1. explicit enrollment_id
      2. learner's newest offering in this camp
      3. camp's published course_version

    Returns ``(package_dict, source_label)`` when a package with nodes is found,
    otherwise ``None`` so the caller can fall back to YAML.
    """
    version_id = (
        resolve_course_version_for_enrollment(enrollment_id)
        or resolve_course_version_for_camp_learner(camp_id, learner_id)
        or resolve_published_version_for_camp(camp_id)
    )
    if not version_id:
        return None
    pkg = load_day_package(version_id, day)
    if not pkg or not pkg.get("nodes"):
        return None
    return pkg, f"db:course_version:{version_id[:8]}:day-{int(day):02d}"
