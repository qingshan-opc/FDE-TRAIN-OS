"""SQL sandbox LabRuntime — Postgres schema+role isolation, no browser creds.

Isolation model
---------------
* One shared database (`fde_sandbox` by default) — already isolated from
  platform tables since Postgres has no cross-database queries without
  dblink/fdw, so a sandbox session can never see `users`/`camps`/etc.
* Inside that database, every session gets its own schema
  (`sandbox_<hex>`) and its own login role (`sbx_<hex>`) that only has
  USAGE/CREATE on that one schema and no grants on `public` — so two
  learners sharing the sandbox database still cannot see each other's
  tables (verified: cross-role `SELECT` raises `InsufficientPrivilege`).
* The role's password never leaves this process: the browser only talks to
  the SQL-lab HTTP API (`services/sql_lab/app.py`), which looks up the
  session's credentials server-side and executes the learner's SQL itself.
"""

from __future__ import annotations

import json
import os
import re
import secrets
import time
from typing import Any
from urllib.parse import urlsplit, urlunsplit
from uuid import uuid4

from services.lab_runtime.base import LabContext, LabSession
from services.shared import db_cursor

DEFAULT_SESSION_TTL_SEC = int(os.getenv("SQL_LAB_SESSION_TTL_SEC", str(4 * 3600)))
STATEMENT_TIMEOUT_MS = int(os.getenv("SQL_LAB_STATEMENT_TIMEOUT_MS", "10000"))
SANDBOX_DB_NAME = os.getenv("SANDBOX_DB_NAME", "fde_sandbox")

_IDENT_RE = re.compile(r"^[a-zA-Z_][a-zA-Z0-9_]{0,62}$")


def _safe_ident(name: str) -> str:
    if not _IDENT_RE.match(name):
        raise ValueError(f"unsafe identifier: {name!r}")
    return name


def _platform_database_url() -> str:
    from services.shared.config import DATABASE_URL

    return DATABASE_URL


def sandbox_database_url() -> str:
    """`SANDBOX_DATABASE_URL` if set, else the platform URL with the DB name
    swapped to `fde_sandbox` on the same host — real Postgres, schema
    isolation within a dedicated sandbox database (never SQLite)."""
    explicit = os.getenv("SANDBOX_DATABASE_URL", "").strip()
    if explicit:
        return explicit
    base = _platform_database_url()
    if not base:
        return ""
    parts = urlsplit(base)
    return urlunsplit((parts.scheme, parts.netloc, f"/{SANDBOX_DB_NAME}", parts.query, parts.fragment))


def _maintenance_url(sandbox_url: str) -> str:
    """Same server/credentials, `postgres` maintenance DB — `CREATE DATABASE`
    cannot run against the database currently being connected to."""
    parts = urlsplit(sandbox_url)
    return urlunsplit((parts.scheme, parts.netloc, "/postgres", parts.query, parts.fragment))


def _dbname(url: str) -> str:
    return urlsplit(url).path.lstrip("/") or SANDBOX_DB_NAME


def ensure_sandbox_database() -> str:
    """Create the sandbox database if it doesn't exist yet (requires
    CREATEDB on the connecting role — true for the dev/compose `fde`
    superuser). Returns the sandbox connection URL."""
    import psycopg
    from psycopg import sql

    url = sandbox_database_url()
    if not url:
        raise RuntimeError("no DATABASE_URL/SANDBOX_DATABASE_URL configured")
    name = _safe_ident(_dbname(url))
    with psycopg.connect(_maintenance_url(url), connect_timeout=5, autocommit=True) as conn:
        row = conn.execute("SELECT 1 FROM pg_database WHERE datname=%s", (name,)).fetchone()
        if not row:
            conn.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(name)))
    return url


def _new_names() -> tuple[str, str, str]:
    """(session_id, schema_name, role_name) — all derived from one uuid so
    they're trivially correlated for cleanup/audit. Both names start with a
    letter so they're valid unquoted Postgres identifiers too."""
    sid = uuid4().hex
    return sid, f"sandbox_{sid}", f"sbx_{sid[:24]}"


def _admin_conn():
    import psycopg
    from psycopg.rows import dict_row

    url = ensure_sandbox_database()
    return psycopg.connect(url, connect_timeout=5, autocommit=True, row_factory=dict_row)


def _role_conn(schema: str, role: str, password: str):
    import psycopg
    from psycopg import sql
    from psycopg.rows import dict_row

    url = sandbox_database_url()
    parts = urlsplit(url)
    host_port = parts.hostname + (f":{parts.port}" if parts.port else "")
    netloc = f"{role}:{password}@{host_port}"
    role_url = urlunsplit((parts.scheme, netloc, parts.path, parts.query, parts.fragment))
    conn = psycopg.connect(role_url, connect_timeout=5, autocommit=True, row_factory=dict_row)
    conn.execute(sql.SQL("SET search_path TO {}").format(sql.Identifier(_safe_ident(schema))))
    return conn


def _provision(schema: str, role: str, password: str) -> None:
    from psycopg import sql

    schema, role = _safe_ident(schema), _safe_ident(role)
    with _admin_conn() as conn:
        conn.execute(sql.SQL("CREATE SCHEMA {}").format(sql.Identifier(schema)))
        conn.execute(
            sql.SQL("CREATE ROLE {} LOGIN PASSWORD {} CONNECTION LIMIT 5").format(
                sql.Identifier(role), sql.Literal(password)
            )
        )
        conn.execute(sql.SQL("GRANT USAGE, CREATE ON SCHEMA {} TO {}").format(sql.Identifier(schema), sql.Identifier(role)))
        conn.execute(sql.SQL("ALTER ROLE {} SET search_path = {}").format(sql.Identifier(role), sql.Identifier(schema)))
        conn.execute(sql.SQL("ALTER ROLE {} SET statement_timeout = {}").format(sql.Identifier(role), sql.Literal(STATEMENT_TIMEOUT_MS)))
        conn.execute(sql.SQL("REVOKE ALL ON SCHEMA public FROM {}").format(sql.Identifier(role)))


def _deprovision(schema: str, role: str) -> None:
    from psycopg import sql

    schema, role = _safe_ident(schema), _safe_ident(role)
    with _admin_conn() as conn:
        conn.execute(sql.SQL("DROP SCHEMA IF EXISTS {} CASCADE").format(sql.Identifier(schema)))
        conn.execute(sql.SQL("DROP ROLE IF EXISTS {}").format(sql.Identifier(role)))


def _regrant_schema(schema: str, role: str) -> None:
    from psycopg import sql

    schema, role = _safe_ident(schema), _safe_ident(role)
    with _admin_conn() as conn:
        conn.execute(sql.SQL("DROP SCHEMA IF EXISTS {} CASCADE").format(sql.Identifier(schema)))
        conn.execute(sql.SQL("CREATE SCHEMA {}").format(sql.Identifier(schema)))
        conn.execute(sql.SQL("GRANT USAGE, CREATE ON SCHEMA {} TO {}").format(sql.Identifier(schema), sql.Identifier(role)))


def _run_seed(schema: str, role: str, password: str, seed_sql: list[str]) -> None:
    if not seed_sql:
        return
    with _role_conn(schema, role, password) as conn:
        for stmt in seed_sql:
            if stmt and stmt.strip():
                conn.execute(stmt)


def _row(session_id: str) -> dict[str, Any]:
    with db_cursor() as cur:
        cur.execute("SELECT * FROM sql_lab_sessions WHERE id=?", (session_id,))
        row = cur.fetchone()
        if not row:
            raise KeyError(f"sql_lab session not found: {session_id}")
        return dict(row)


def _seed_list(row: dict[str, Any]) -> list[str]:
    raw = row.get("seed_sql_json") or []
    if isinstance(raw, str):
        raw = json.loads(raw) if raw else []
    return list(raw)


class SqlSandboxRuntime:
    """`LabRuntime` implementation backed by real Postgres schema+role
    isolation. Metadata (schema/role/expiry) is tracked in the *platform*
    DB's `sql_lab_sessions` table; the actual data lives in the separate
    `fde_sandbox` database."""

    runner = "sql_sandbox"

    def create(self, ctx: LabContext) -> LabSession:
        sid, schema, role = _new_names()
        password = secrets.token_urlsafe(24)
        seed_sql = [str(s) for s in (ctx.task_spec.get("seed_sql") or [])]
        _provision(schema, role, password)
        try:
            _run_seed(schema, role, password, seed_sql)
        except Exception:
            _deprovision(schema, role)
            raise
        with db_cursor() as cur:
            cur.execute(
                """
                INSERT INTO sql_lab_sessions
                (id, learner_id, camp_id, day, node_id, schema_name, role_name, role_password,
                 seed_sql_json, status, expires_at, created_at, updated_at)
                VALUES (?,?,?,?,?,?,?,?,?::jsonb,'active', NOW() + ((?)::text || ' seconds')::interval, NOW(), NOW())
                """,
                (
                    sid, ctx.learner_id, ctx.camp_id, ctx.day, ctx.node_id, schema, role, password,
                    json.dumps(seed_sql, ensure_ascii=False), str(DEFAULT_SESSION_TTL_SEC),
                ),
            )
        return LabSession(
            id=sid,
            runner=self.runner,
            learner_id=ctx.learner_id,
            camp_id=ctx.camp_id,
            day=ctx.day,
            node_id=ctx.node_id,
            meta={"schema": schema, "ttl_sec": DEFAULT_SESSION_TTL_SEC},
        )

    def reset(self, session_id: str) -> None:
        row = _row(session_id)
        schema, role, password = row["schema_name"], row["role_name"], row["role_password"]
        _regrant_schema(schema, role)
        _run_seed(schema, role, password, _seed_list(row))
        with db_cursor() as cur:
            cur.execute("UPDATE sql_lab_sessions SET updated_at=NOW() WHERE id=?", (session_id,))

    def action(self, session_id: str, action: str, payload: dict[str, Any]) -> dict[str, Any]:
        row = _row(session_id)
        schema, role, password = row["schema_name"], row["role_name"], row["role_password"]

        if action == "reset":
            self.reset(session_id)
            return {"status": "reset"}

        if action == "list_tables":
            with _role_conn(schema, role, password) as conn:
                cur = conn.execute(
                    "SELECT table_name FROM information_schema.tables WHERE table_schema=current_schema() ORDER BY table_name"
                )
                tables = [r["table_name"] for r in cur.fetchall()]
            return {"schema": schema, "tables": tables}

        if action == "describe":
            table = str(payload.get("table") or "")
            with _role_conn(schema, role, password) as conn:
                cur = conn.execute(
                    """
                    SELECT column_name, data_type, is_nullable, column_default
                    FROM information_schema.columns
                    WHERE table_schema=current_schema() AND table_name=%s
                    ORDER BY ordinal_position
                    """,
                    (table,),
                )
                cols = [dict(c) for c in cur.fetchall()]
            if not cols:
                raise KeyError(f"table not found in sandbox schema: {table}")
            return {"table": table, "columns": cols}

        if action in ("exec_sql", "explain"):
            raw_sql = str(payload.get("sql") or "").strip()
            if not raw_sql:
                raise ValueError("sql is required")
            run_sql = f"EXPLAIN {raw_sql}" if action == "explain" else raw_sql
            started = time.perf_counter()
            with _role_conn(schema, role, password) as conn:
                cur = conn.execute(run_sql)
                columns = [d.name for d in (cur.description or [])]
                rows = [dict(r) for r in cur.fetchall()] if cur.description is not None else []
                rowcount = cur.rowcount
            duration_ms = round((time.perf_counter() - started) * 1000, 2)
            with db_cursor() as pcur:
                pcur.execute("UPDATE sql_lab_sessions SET updated_at=NOW() WHERE id=?", (session_id,))
            return {"columns": columns, "rows": rows, "rowcount": rowcount, "duration_ms": duration_ms}

        raise ValueError(f"unknown sql sandbox action: {action}")

    def evaluate(self, session_id: str, rubric: list[dict[str, Any]]) -> dict[str, Any]:
        from psycopg import sql as _sql

        row = _row(session_id)
        schema, role, password = row["schema_name"], row["role_name"], row["role_password"]
        checks: list[dict[str, Any]] = []
        with _role_conn(schema, role, password) as conn:
            for rule in rubric:
                cid = rule.get("check", "")
                args = rule.get("args") or {}
                ok, detail = False, ""
                try:
                    if cid == "table_exists":
                        table = args.get("table", "")
                        r = conn.execute(
                            "SELECT 1 FROM information_schema.tables WHERE table_schema=current_schema() AND table_name=%s",
                            (table,),
                        ).fetchone()
                        ok = bool(r)
                        detail = f"table {table!r} exists={ok}"
                    elif cid == "column_exists":
                        table, column = args.get("table", ""), args.get("column", "")
                        r = conn.execute(
                            "SELECT 1 FROM information_schema.columns WHERE table_schema=current_schema() AND table_name=%s AND column_name=%s",
                            (table, column),
                        ).fetchone()
                        ok = bool(r)
                        detail = f"{table}.{column} exists={ok}"
                    elif cid == "row_count_gte":
                        table, minimum = args.get("table", ""), int(args.get("min", 0))
                        r = conn.execute(
                            _sql.SQL("SELECT COUNT(*) AS c FROM {}").format(_sql.Identifier(_safe_ident(table)))
                        ).fetchone()
                        count = int(r["c"]) if r else 0
                        ok = count >= minimum
                        detail = f"{table} row_count={count} (>= {minimum})"
                    elif cid == "query_returns":
                        check_sql = str(args.get("sql") or "")
                        expected = args.get("expected")
                        r = conn.execute(check_sql).fetchone()
                        actual = next(iter(r.values())) if r else None
                        ok = actual == expected
                        detail = f"query -> {actual!r} (expected {expected!r})"
                    else:
                        detail = f"unknown check {cid}"
                except Exception as exc:
                    detail = str(exc)
                checks.append({"id": cid, "ok": ok, "detail": detail})
        passed = all(c["ok"] for c in checks) if checks else False
        return {"pass": passed, "checks": checks, "score": sum(1 for c in checks if c["ok"]) / max(len(checks), 1)}

    def export_evidence(self, session_id: str) -> dict[str, Any]:
        row = _row(session_id)
        tables = self.action(session_id, "list_tables", {})["tables"]
        return {
            "schema": row["schema_name"],
            "tables": tables,
            "created_at": str(row.get("created_at")),
            "expires_at": str(row.get("expires_at")),
        }

    def destroy(self, session_id: str) -> None:
        row = _row(session_id)
        _deprovision(row["schema_name"], row["role_name"])
        with db_cursor() as cur:
            cur.execute("DELETE FROM sql_lab_sessions WHERE id=?", (session_id,))


def purge_expired_sessions() -> int:
    """Best-effort TTL sweep. Not scheduled automatically — call this from a
    worker/cron job if unattended cleanup of expired sandboxes is needed."""
    runtime = SqlSandboxRuntime()
    with db_cursor() as cur:
        cur.execute("SELECT id FROM sql_lab_sessions WHERE expires_at < NOW()")
        expired = [r["id"] for r in cur.fetchall()]
    count = 0
    for sid in expired:
        try:
            runtime.destroy(sid)
            count += 1
        except Exception:
            continue
    return count


def _factory() -> SqlSandboxRuntime:
    return SqlSandboxRuntime()


def _register() -> None:
    from services.lab_runtime.registry import register

    register("sql_sandbox", _factory)


_register()

__all__ = ["SqlSandboxRuntime", "sandbox_database_url", "ensure_sandbox_database", "purge_expired_sessions"]
