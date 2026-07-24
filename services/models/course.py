"""Course catalog + curriculum ORM models (domain v2).

Maps the tables created in migrations 002 (course_versions, day_packages) and
004 (courses, course_offerings, course_modules, learning_nodes).
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from services.db.base import Base


class Course(Base):
    __tablename__ = "courses"

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    slug: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(Text, nullable=False, default="active")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    versions: Mapped[list["CourseVersion"]] = relationship(
        back_populates="course", cascade="all, delete-orphan"
    )


class CourseVersion(Base):
    __tablename__ = "course_versions"

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    # camp_id/created_by reference legacy tables (camps/users) that are not ORM
    # models; the DB still enforces those FKs (see migrations). Kept as plain
    # columns here so SQLAlchemy metadata stays self-contained.
    camp_id: Mapped[str | None] = mapped_column(Text)
    course_id: Mapped[str | None] = mapped_column(Text, ForeignKey("courses.id"))
    version_tag: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(Text, nullable=False, default="draft")
    title: Mapped[str] = mapped_column(Text, nullable=False)
    source: Mapped[str | None] = mapped_column(Text)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_by: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    course: Mapped["Course | None"] = relationship(back_populates="versions")
    modules: Mapped[list["CourseModule"]] = relationship(
        back_populates="course_version", cascade="all, delete-orphan"
    )
    offerings: Mapped[list["CourseOffering"]] = relationship(back_populates="course_version")

    __table_args__ = (UniqueConstraint("camp_id", "version_tag", name="course_versions_camp_id_version_tag_key"),)


class CourseOffering(Base):
    __tablename__ = "course_offerings"

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    course_version_id: Mapped[str | None] = mapped_column(
        Text, ForeignKey("course_versions.id", ondelete="SET NULL")
    )
    # camp_id/teacher_id -> legacy camps/users (DB-enforced FK; not ORM models).
    camp_id: Mapped[str | None] = mapped_column(Text)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    starts_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(Text, nullable=False, default="active")
    teacher_id: Mapped[str | None] = mapped_column(Text)
    kb_config_json: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    course_version: Mapped["CourseVersion | None"] = relationship(back_populates="offerings")


class CourseModule(Base):
    __tablename__ = "course_modules"

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    course_version_id: Mapped[str] = mapped_column(
        Text, ForeignKey("course_versions.id", ondelete="CASCADE"), nullable=False
    )
    day_index: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    config_json: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)

    course_version: Mapped["CourseVersion"] = relationship(back_populates="modules")
    nodes: Mapped[list["LearningNode"]] = relationship(
        back_populates="module", cascade="all, delete-orphan"
    )

    __table_args__ = (UniqueConstraint("course_version_id", "day_index", name="course_modules_version_day_key"),)


class LearningNode(Base):
    __tablename__ = "learning_nodes"

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    module_id: Mapped[str] = mapped_column(
        Text, ForeignKey("course_modules.id", ondelete="CASCADE"), nullable=False
    )
    node_key: Mapped[str] = mapped_column(Text, nullable=False)
    kind: Mapped[str] = mapped_column(Text, nullable=False)
    title: Mapped[str] = mapped_column(Text, nullable=False, default="")
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    config_json: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)

    module: Mapped["CourseModule"] = relationship(back_populates="nodes")

    __table_args__ = (UniqueConstraint("module_id", "node_key", name="learning_nodes_module_node_key"),)
