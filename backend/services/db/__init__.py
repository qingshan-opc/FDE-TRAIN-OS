"""SQLAlchemy 2.0 engine + session factory for the FDE domain model.

This lives alongside the legacy ``services.shared.db`` psycopg pool (which the
existing services keep using). New v2 repositories/application code use the
SQLAlchemy ``Session`` returned by :func:`get_session` / :func:`session_scope`.
Both talk to the same PostgreSQL database.
"""

from __future__ import annotations

from contextlib import contextmanager
from typing import Generator

from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import Session, sessionmaker

from services.db.base import Base
from services.shared.config import DATABASE_URL, require_database_url

__all__ = [
    "Base",
    "get_engine",
    "get_sessionmaker",
    "get_session",
    "session_scope",
    "sqlalchemy_url",
]

_engine: Engine | None = None
_SessionLocal: sessionmaker[Session] | None = None


def sqlalchemy_url(url: str | None = None) -> str:
    """Return a SQLAlchemy-compatible URL that uses the psycopg (v3) driver.

    The rest of the app stores a plain ``postgresql://...`` DSN (psycopg pool).
    SQLAlchemy would default that to psycopg2, which is not installed, so we
    normalise to the ``postgresql+psycopg`` dialect.
    """
    value = require_database_url(url if url is not None else DATABASE_URL)
    if value.startswith("postgresql+"):
        return value
    if value.startswith("postgresql://"):
        return "postgresql+psycopg://" + value[len("postgresql://") :]
    if value.startswith("postgres://"):
        return "postgresql+psycopg://" + value[len("postgres://") :]
    return value


def get_engine() -> Engine:
    global _engine
    if _engine is None:
        _engine = create_engine(
            sqlalchemy_url(),
            pool_pre_ping=True,
            pool_size=5,
            max_overflow=10,
            future=True,
        )
    return _engine


def get_sessionmaker() -> sessionmaker[Session]:
    global _SessionLocal
    if _SessionLocal is None:
        _SessionLocal = sessionmaker(
            bind=get_engine(), autoflush=False, expire_on_commit=False, future=True
        )
    return _SessionLocal


# Backwards-friendly alias mirroring common SQLAlchemy naming.
def SessionLocal() -> Session:  # noqa: N802 - factory call style
    return get_sessionmaker()()


def get_session() -> Session:
    """Return a new SQLAlchemy Session. Caller is responsible for closing it.

    Prefer :func:`session_scope` for a transactional context manager, or use
    this directly (e.g. as a FastAPI dependency) and close in a ``finally``.
    """
    return get_sessionmaker()()


@contextmanager
def session_scope() -> Generator[Session, None, None]:
    """Transactional scope: commit on success, rollback on error, always close."""
    session = get_sessionmaker()()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
