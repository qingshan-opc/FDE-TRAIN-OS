"""PostgreSQL connection pool — no SQLite runtime path."""

from __future__ import annotations

import logging
from contextlib import contextmanager
from typing import Any, Generator, Iterator

from services.shared.config import DATABASE_URL, DB_STATEMENT_TIMEOUT_MS, ensure_dirs, require_database_url

log = logging.getLogger("fde.db")

_pool = None


def get_pool():
    global _pool
    if _pool is not None:
        return _pool
    require_database_url()
    from psycopg_pool import ConnectionPool
    from psycopg.rows import dict_row

    _pool = ConnectionPool(
        conninfo=DATABASE_URL,
        min_size=1,
        max_size=20,
        kwargs={"row_factory": dict_row, "options": f"-c statement_timeout={DB_STATEMENT_TIMEOUT_MS}"},
        open=True,
    )
    return _pool


def close_pool() -> None:
    global _pool
    if _pool is not None:
        _pool.close()
        _pool = None


class _PgCursor:
    def __init__(self, cur):
        self._cur = cur

    def execute(self, sql: str, params: tuple | list | None = None):
        q = sql.replace("?", "%s")
        self._cur.execute(q, params or ())
        return self

    def executemany(self, sql: str, seq):
        q = sql.replace("?", "%s")
        self._cur.executemany(q, seq)
        return self

    def fetchone(self):
        return self._cur.fetchone()

    def fetchall(self):
        return self._cur.fetchall()

    def __getattr__(self, name):
        return getattr(self._cur, name)


@contextmanager
def db_conn() -> Generator[Any, None, None]:
    ensure_dirs()
    pool = get_pool()
    with pool.connection() as conn:
        yield conn
        conn.commit()


@contextmanager
def db_cursor() -> Generator[Any, None, None]:
    with db_conn() as conn:
        with conn.cursor() as cur:
            yield _PgCursor(cur)


def healthcheck() -> dict[str, Any]:
    try:
        with db_cursor() as cur:
            cur.execute("SELECT 1 AS ok")
            row = cur.fetchone()
        return {"ok": True, "backend": "postgresql", "row": row}
    except Exception as exc:
        return {"ok": False, "backend": "postgresql", "error": str(exc)}
