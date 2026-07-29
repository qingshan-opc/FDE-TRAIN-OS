"""Learning resource ORM models (domain v2)."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import BigInteger, DateTime, ForeignKey, Integer, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from services.db.base import Base


class ResourcePack(Base):
    __tablename__ = "resource_packs"

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    course_version_id: Mapped[str | None] = mapped_column(
        Text, ForeignKey("course_versions.id", ondelete="CASCADE")
    )
    name: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    resources: Mapped[list["LearningResource"]] = relationship(
        back_populates="pack", cascade="all, delete-orphan"
    )


class LearningResource(Base):
    __tablename__ = "learning_resources"

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    pack_id: Mapped[str | None] = mapped_column(
        Text, ForeignKey("resource_packs.id", ondelete="CASCADE")
    )
    course_version_id: Mapped[str | None] = mapped_column(
        Text, ForeignKey("course_versions.id", ondelete="CASCADE")
    )
    day_index: Mapped[int | None] = mapped_column(Integer)
    kind: Mapped[str] = mapped_column(Text, nullable=False)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    object_key: Mapped[str | None] = mapped_column(Text)
    url: Mapped[str | None] = mapped_column(Text)
    meta_json: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    pack: Mapped["ResourcePack | None"] = relationship(back_populates="resources")


class SubmissionAttachment(Base):
    __tablename__ = "submission_attachments"

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    # submission_id -> legacy submissions table (DB-enforced FK; not an ORM model).
    submission_id: Mapped[str] = mapped_column(Text, nullable=False)
    object_key: Mapped[str] = mapped_column(Text, nullable=False)
    filename: Mapped[str | None] = mapped_column(Text)
    content_type: Mapped[str | None] = mapped_column(Text)
    size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
