"""Enrollment application service.

Orchestrates the enrollment repository + session state so callers (e.g. the auth
API) don't need to know the ORM details. Uses its own SQLAlchemy session per
call via ``session_scope`` unless one is injected.
"""

from __future__ import annotations

from contextlib import nullcontext

from sqlalchemy import text
from sqlalchemy.orm import Session

from services.db import session_scope
from services.repositories.course_repository import CourseRepository
from services.repositories.enrollment_repository import EnrollmentRepository


class EnrollmentService:
    def __init__(self, session: Session | None = None) -> None:
        # If a session is injected we operate within it; otherwise each method
        # opens its own transactional scope.
        self._session = session

    def _scope(self):
        if self._session is not None:
            return nullcontext(self._session)
        return session_scope()

    def list_for_user(self, user_id: str) -> list[dict]:
        with self._scope() as session:
            return EnrollmentRepository(session).list_for_user_enriched(user_id)

    def enroll(self, user_id: str, offering_id: str, status: str = "active") -> dict:
        with self._scope() as session:
            rec = EnrollmentRepository(session).get_or_create(user_id, offering_id, status)
            return {"enrollment_id": rec.id, "offering_id": rec.offering_id, "status": rec.status}

    def switch_active_enrollment(self, user_id: str, enrollment_id: str) -> dict:
        """Set the learner's active enrollment.

        Validates ownership, records it on every live (non-revoked) session row
        for the user, and returns the resolved offering + camp for backward
        compatibility with the legacy camp scoping.
        """
        with self._scope() as session:
            repo = EnrollmentRepository(session)
            rec = repo.get(enrollment_id)
            if rec is None or rec.user_id != user_id:
                raise ValueError("enrollment not found for user")
            course_repo = CourseRepository(session)
            offering = course_repo.get_offering(rec.offering_id)
            camp_id = offering.camp_id if offering else None
            # Persist active enrollment onto the user's live sessions.
            session.execute(
                text(
                    """
                    UPDATE sessions
                    SET active_enrollment_id = :eid,
                        camp_id = COALESCE(:camp_id, camp_id)
                    WHERE user_id = :uid AND revoked_at IS NULL
                    """
                ),
                {"eid": enrollment_id, "camp_id": camp_id, "uid": user_id},
            )
            return {
                "enrollment_id": enrollment_id,
                "offering_id": rec.offering_id,
                "camp_id": camp_id,
                "status": rec.status,
            }
