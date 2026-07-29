"""Workspace ORM models (domain v2 dual-read).

Maps the existing ``workspace_heads`` / ``workspace_snapshots`` tables, with the
new optional ``enrollment_id`` on the head for v2 scoping.
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import BigInteger, DateTime, ForeignKey, Integer, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from services.db.base import Base


class WorkspaceHead(Base):
    __tablename__ = "workspace_heads"

    camp_id: Mapped[str] = mapped_column(Text, primary_key=True)
    learner_id: Mapped[str] = mapped_column(Text, primary_key=True)
    snapshot_id: Mapped[str | None] = mapped_column(Text)
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    enrollment_id: Mapped[str | None] = mapped_column(
        Text, ForeignKey("enrollment_records.id")
    )


class WorkspaceSnapshot(Base):
    __tablename__ = "workspace_snapshots"

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    camp_id: Mapped[str] = mapped_column(Text, nullable=False)
    learner_id: Mapped[str] = mapped_column(Text, nullable=False)
    parent_id: Mapped[str | None] = mapped_column(Text)
    manifest_key: Mapped[str] = mapped_column(Text, nullable=False)
    object_prefix: Mapped[str] = mapped_column(Text, nullable=False)
    size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    file_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_by_job_id: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
