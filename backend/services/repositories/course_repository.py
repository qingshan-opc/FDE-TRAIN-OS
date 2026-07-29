"""Course / offering repository (SQLAlchemy Session)."""

from __future__ import annotations

from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from services.models.course import Course, CourseOffering, CourseVersion


class CourseRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    # --- courses -----------------------------------------------------------
    def get_course_by_slug(self, slug: str) -> Course | None:
        return self.session.scalar(select(Course).where(Course.slug == slug))

    def get_course(self, course_id: str) -> Course | None:
        return self.session.get(Course, course_id)

    def get_or_create_course(
        self, slug: str, title: str, description: str | None = None, status: str = "active"
    ) -> Course:
        existing = self.get_course_by_slug(slug)
        if existing:
            return existing
        course = Course(
            id=str(uuid4()), slug=slug, title=title, description=description, status=status
        )
        self.session.add(course)
        self.session.flush()
        return course

    # --- versions ----------------------------------------------------------
    def get_version(self, version_id: str) -> CourseVersion | None:
        return self.session.get(CourseVersion, version_id)

    def link_version_to_course(self, version_id: str, course_id: str) -> CourseVersion | None:
        version = self.get_version(version_id)
        if version and version.course_id != course_id:
            version.course_id = course_id
            self.session.flush()
        return version

    def latest_published_version_for_camp(self, camp_id: str) -> CourseVersion | None:
        return self.session.scalar(
            select(CourseVersion)
            .where(CourseVersion.camp_id == camp_id, CourseVersion.status == "published")
            .order_by(CourseVersion.published_at.desc().nullslast(), CourseVersion.created_at.desc())
        )

    # --- offerings ---------------------------------------------------------
    def get_offering(self, offering_id: str) -> CourseOffering | None:
        return self.session.get(CourseOffering, offering_id)

    def get_offering_by_camp(self, camp_id: str) -> CourseOffering | None:
        return self.session.scalar(
            select(CourseOffering)
            .where(CourseOffering.camp_id == camp_id)
            .order_by(CourseOffering.created_at.desc())
        )

    def get_or_create_offering(
        self,
        *,
        title: str,
        course_version_id: str | None = None,
        camp_id: str | None = None,
        teacher_id: str | None = None,
        status: str = "active",
        kb_config: dict | None = None,
    ) -> CourseOffering:
        if camp_id:
            existing = self.get_offering_by_camp(camp_id)
            if existing:
                return existing
        offering = CourseOffering(
            id=str(uuid4()),
            title=title,
            course_version_id=course_version_id,
            camp_id=camp_id,
            teacher_id=teacher_id,
            status=status,
            kb_config_json=kb_config or {},
        )
        self.session.add(offering)
        self.session.flush()
        return offering
