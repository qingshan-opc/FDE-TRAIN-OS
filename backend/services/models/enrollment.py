"""Enrollment + per-learner progress ORM models (domain v2).

- ``EnrollmentRecord`` is the v2 enrollment (user -> offering).
- ``NodeProgress``, ``LearningAttempt`` (quiz_attempts) and ``Evidence`` are the
  existing per-learner tables, now carrying an optional ``enrollment_id`` for
  dual-read against the legacy ``camp_id`` scoping.
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import (
    DateTime,
    Float,
    ForeignKey,
    Integer,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from services.db.base import Base


class EnrollmentRecord(Base):
    __tablename__ = "enrollment_records"

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    # user_id -> legacy users table (DB-enforced FK; users is not an ORM model).
    user_id: Mapped[str] = mapped_column(Text, nullable=False)
    offering_id: Mapped[str] = mapped_column(
        Text, ForeignKey("course_offerings.id", ondelete="CASCADE"), nullable=False
    )
    status: Mapped[str] = mapped_column(Text, nullable=False, default="active")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    offering: Mapped["CourseOffering"] = relationship()  # noqa: F821

    __table_args__ = (UniqueConstraint("user_id", "offering_id", name="enrollment_records_user_offering_key"),)


class NodeProgress(Base):
    __tablename__ = "node_progress"

    learner_id: Mapped[str] = mapped_column(Text, primary_key=True)
    camp_id: Mapped[str] = mapped_column(Text, primary_key=True)
    day: Mapped[int] = mapped_column(Integer, primary_key=True)
    node_id: Mapped[str] = mapped_column(Text, primary_key=True)
    status: Mapped[str] = mapped_column(Text, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    enrollment_id: Mapped[str | None] = mapped_column(
        Text, ForeignKey("enrollment_records.id")
    )


class LearningAttempt(Base):
    """Maps the legacy ``quiz_attempts`` table (a learning attempt on a node)."""

    __tablename__ = "quiz_attempts"

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    learner_id: Mapped[str] = mapped_column(Text, nullable=False)
    camp_id: Mapped[str] = mapped_column(Text, nullable=False)
    day: Mapped[int] = mapped_column(Integer, nullable=False)
    node_id: Mapped[str] = mapped_column(Text, nullable=False)
    score: Mapped[float | None] = mapped_column(Float)
    # ``pass`` is a Python keyword — expose as ``pass_flag`` mapped to column "pass".
    pass_flag: Mapped[int | None] = mapped_column("pass", Integer)
    passed: Mapped[bool | None] = mapped_column()
    answers_json: Mapped[str | None] = mapped_column(Text)
    answers_jsonb: Mapped[dict | None] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    enrollment_id: Mapped[str | None] = mapped_column(
        Text, ForeignKey("enrollment_records.id")
    )


class Evidence(Base):
    __tablename__ = "evidence"

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    ts: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    learner_id: Mapped[str] = mapped_column(Text, nullable=False)
    camp_version: Mapped[str | None] = mapped_column(Text)
    day: Mapped[int | None] = mapped_column(Integer)
    node_id: Mapped[str | None] = mapped_column(Text)
    kind: Mapped[str | None] = mapped_column(Text)
    payload_json: Mapped[str | None] = mapped_column(Text)
    capability_tags: Mapped[str | None] = mapped_column(Text)
    payload_jsonb: Mapped[dict | None] = mapped_column(JSONB)
    capability_tags_jsonb: Mapped[dict | None] = mapped_column(JSONB)
    enrollment_id: Mapped[str | None] = mapped_column(
        Text, ForeignKey("enrollment_records.id")
    )
