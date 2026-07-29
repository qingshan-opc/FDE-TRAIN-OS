"""Certificate ORM models (domain v2)."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from services.db.base import Base


class CertificateTemplate(Base):
    __tablename__ = "certificate_templates"

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    course_id: Mapped[str | None] = mapped_column(
        Text, ForeignKey("courses.id", ondelete="SET NULL")
    )
    name: Mapped[str] = mapped_column(Text, nullable=False)
    body_template: Mapped[str | None] = mapped_column(Text)
    config_json: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    issuances: Mapped[list["CertificateIssuance"]] = relationship(back_populates="template")


class CertificateIssuance(Base):
    __tablename__ = "certificate_issuances"

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    template_id: Mapped[str | None] = mapped_column(
        Text, ForeignKey("certificate_templates.id", ondelete="SET NULL")
    )
    # user_id -> legacy users table (DB-enforced FK; users is not an ORM model).
    user_id: Mapped[str] = mapped_column(Text, nullable=False)
    enrollment_id: Mapped[str | None] = mapped_column(
        Text, ForeignKey("enrollment_records.id", ondelete="SET NULL")
    )
    serial: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    payload_json: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    issued_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    template: Mapped["CertificateTemplate | None"] = relationship(back_populates="issuances")
