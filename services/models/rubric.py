"""Rubric ORM models (domain v2)."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from services.db.base import Base


class RubricDefinition(Base):
    __tablename__ = "rubric_definitions"

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    course_version_id: Mapped[str | None] = mapped_column(
        Text, ForeignKey("course_versions.id", ondelete="CASCADE")
    )
    node_key: Mapped[str | None] = mapped_column(Text)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    runner: Mapped[str | None] = mapped_column(Text)
    config_json: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    criteria: Mapped[list["RubricCriterion"]] = relationship(
        back_populates="rubric", cascade="all, delete-orphan"
    )


class RubricCriterion(Base):
    __tablename__ = "rubric_criteria"

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    rubric_id: Mapped[str] = mapped_column(
        Text, ForeignKey("rubric_definitions.id", ondelete="CASCADE"), nullable=False
    )
    check_id: Mapped[str] = mapped_column(Text, nullable=False)
    args_json: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    weight: Mapped[float] = mapped_column(Float, nullable=False, default=1.0)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    rubric: Mapped["RubricDefinition"] = relationship(back_populates="criteria")
