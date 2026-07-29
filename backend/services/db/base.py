"""SQLAlchemy 2.0 declarative base for the FDE domain model."""

from __future__ import annotations

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Shared declarative base. All ORM models inherit from this."""

    pass
