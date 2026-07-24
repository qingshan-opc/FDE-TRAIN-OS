"""Alembic environment for the FDE domain model.

Targets the SQLAlchemy metadata in ``services.models`` and reads the DB URL from
the application config (``DATABASE_URL``), normalised to the psycopg driver. The
hand-written SQL under ``./migrations`` remains the applied source of truth; this
env exists for autogenerate/diff workflows.
"""

from __future__ import annotations

import sys
from logging.config import fileConfig
from pathlib import Path

from alembic import context
from sqlalchemy import engine_from_config, pool

_ROOT = Path(__file__).resolve().parents[1]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from services.db import sqlalchemy_url  # noqa: E402
import services.models  # noqa: E402,F401  (register all models on Base.metadata)
from services.db.base import Base  # noqa: E402

config = context.config
if config.config_file_name is not None:
    try:
        fileConfig(config.config_file_name)
    except Exception:
        pass

# Inject the runtime DB URL (psycopg driver).
config.set_main_option("sqlalchemy.url", sqlalchemy_url())

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    context.configure(
        url=sqlalchemy_url(),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    section = config.get_section(config.config_ini_section) or {}
    section["sqlalchemy.url"] = sqlalchemy_url()
    connectable = engine_from_config(
        section, prefix="sqlalchemy.", poolclass=pool.NullPool
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection, target_metadata=target_metadata, compare_type=True
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
