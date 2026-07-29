"""Enrollment repository (SQLAlchemy Session)."""

from __future__ import annotations

from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from services.models.course import Course, CourseOffering, CourseVersion
from services.models.enrollment import EnrollmentRecord


class EnrollmentRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def get(self, enrollment_id: str) -> EnrollmentRecord | None:
        return self.session.get(EnrollmentRecord, enrollment_id)

    def get_by_user_and_offering(self, user_id: str, offering_id: str) -> EnrollmentRecord | None:
        return self.session.scalar(
            select(EnrollmentRecord).where(
                EnrollmentRecord.user_id == user_id,
                EnrollmentRecord.offering_id == offering_id,
            )
        )

    def get_or_create(
        self, user_id: str, offering_id: str, status: str = "active"
    ) -> EnrollmentRecord:
        existing = self.get_by_user_and_offering(user_id, offering_id)
        if existing:
            return existing
        rec = EnrollmentRecord(
            id=str(uuid4()), user_id=user_id, offering_id=offering_id, status=status
        )
        self.session.add(rec)
        self.session.flush()
        return rec

    def list_for_user(self, user_id: str) -> list[EnrollmentRecord]:
        return list(
            self.session.scalars(
                select(EnrollmentRecord)
                .where(EnrollmentRecord.user_id == user_id)
                .order_by(EnrollmentRecord.created_at.asc())
            )
        )

    def list_for_user_enriched(self, user_id: str) -> list[dict]:
        """Return enrollments joined with offering + course titles."""
        rows = self.session.execute(
            select(
                EnrollmentRecord,
                CourseOffering,
                CourseVersion,
                Course,
            )
            .join(CourseOffering, EnrollmentRecord.offering_id == CourseOffering.id)
            .join(
                CourseVersion,
                CourseOffering.course_version_id == CourseVersion.id,
                isouter=True,
            )
            .join(Course, CourseVersion.course_id == Course.id, isouter=True)
            .where(EnrollmentRecord.user_id == user_id)
            .order_by(EnrollmentRecord.created_at.asc())
        ).all()
        out: list[dict] = []
        for enr, offering, version, course in rows:
            out.append(
                {
                    "enrollment_id": enr.id,
                    "status": enr.status,
                    "created_at": enr.created_at.isoformat() if enr.created_at else None,
                    "offering_id": offering.id,
                    "offering_title": offering.title,
                    "camp_id": offering.camp_id,
                    "course_version_id": version.id if version else None,
                    "course_id": course.id if course else None,
                    "course_title": course.title if course else offering.title,
                }
            )
        return out
