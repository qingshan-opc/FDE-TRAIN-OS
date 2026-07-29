"""SQL sandbox LabRuntime — schema+role isolation on real Postgres.

Skips only if Postgres itself is unreachable (no local/CI DB running). If
`DATABASE_URL`/`SANDBOX_DATABASE_URL` point at a live Postgres server, the
`fde_sandbox` database is created automatically (mirrors
`services.lab_runtime.sql_sandbox.ensure_sandbox_database`) — this test
does not require SQLite fallback, matching the "no SQLite runtime" rule.
"""

from __future__ import annotations

import pytest

from services.lab_runtime.base import LabContext

sql_sandbox = pytest.importorskip("services.lab_runtime.sql_sandbox")


@pytest.fixture(scope="module")
def runtime():
    try:
        sql_sandbox.ensure_sandbox_database()
    except Exception as exc:
        pytest.skip(f"sandbox postgres unavailable: {exc}")
    return sql_sandbox.SqlSandboxRuntime()


@pytest.fixture(scope="module")
def seed_ids():
    """A real user/camp id so `sql_lab_sessions` FK columns are satisfiable —
    seeds the platform DB (idempotent) if nothing exists yet."""
    from services.shared import db_cursor, init_schema

    try:
        init_schema()
    except Exception as exc:
        pytest.skip(f"platform postgres unavailable: {exc}")
    with db_cursor() as cur:
        cur.execute("SELECT id FROM users LIMIT 1")
        user = cur.fetchone()
        cur.execute("SELECT id FROM camps LIMIT 1")
        camp = cur.fetchone()
    if not user or not camp:
        pytest.skip("no seeded user/camp available")
    return user["id"], camp["id"]


def test_create_exec_evaluate_destroy(runtime, seed_ids):
    learner_id, camp_id = seed_ids
    ctx = LabContext(
        learner_id=learner_id,
        camp_id=camp_id,
        day=1,
        node_id="d1-sql-lab",
        task_spec={
            "seed_sql": [
                "CREATE TABLE widgets (id int, name text)",
                "INSERT INTO widgets VALUES (1, 'a'), (2, 'b')",
            ]
        },
    )
    session = runtime.create(ctx)
    assert session.runner == "sql_sandbox"
    assert session.meta["schema"].startswith("sandbox_")

    try:
        result = runtime.action(session.id, "exec_sql", {"sql": "SELECT COUNT(*) AS c FROM widgets"})
        assert result["rows"][0]["c"] == 2
        assert "c" in result["columns"]

        tables = runtime.action(session.id, "list_tables", {})["tables"]
        assert "widgets" in tables

        desc = runtime.action(session.id, "describe", {"table": "widgets"})
        assert any(c["column_name"] == "name" for c in desc["columns"])

        insert_result = runtime.action(session.id, "exec_sql", {"sql": "INSERT INTO widgets VALUES (3, 'c')"})
        assert insert_result["rowcount"] == 1

        ev = runtime.evaluate(
            session.id,
            [
                {"check": "table_exists", "args": {"table": "widgets"}},
                {"check": "column_exists", "args": {"table": "widgets", "column": "name"}},
                {"check": "row_count_gte", "args": {"table": "widgets", "min": 3}},
                {"check": "query_returns", "args": {"sql": "SELECT COUNT(*) FROM widgets", "expected": 3}},
            ],
        )
        assert ev["pass"] is True, ev
        assert all(c["ok"] for c in ev["checks"])

        evidence = runtime.export_evidence(session.id)
        assert evidence["schema"] == session.meta["schema"]
        assert "widgets" in evidence["tables"]
    finally:
        runtime.destroy(session.id)

    with pytest.raises(KeyError):
        sql_sandbox._row(session.id)


def test_exec_sql_syntax_error_is_reported_not_raised_as_500(runtime, seed_ids):
    learner_id, camp_id = seed_ids
    ctx = LabContext(learner_id=learner_id, camp_id=camp_id)
    session = runtime.create(ctx)
    try:
        with pytest.raises(Exception):
            runtime.action(session.id, "exec_sql", {"sql": "SELEKT * FROM nope"})
    finally:
        runtime.destroy(session.id)


def test_sandbox_cannot_see_platform_or_public_tables(runtime, seed_ids):
    """The sandbox lives in a separate `fde_sandbox` database, so platform
    tables (`users`, `camps`, ...) are structurally unreachable, and the
    session role has no grants on `public` either."""
    learner_id, camp_id = seed_ids
    ctx = LabContext(learner_id=learner_id, camp_id=camp_id)
    session = runtime.create(ctx)
    try:
        with pytest.raises(Exception):
            runtime.action(session.id, "exec_sql", {"sql": "SELECT * FROM public.users LIMIT 1"})
        with pytest.raises(Exception):
            runtime.action(session.id, "exec_sql", {"sql": "SELECT * FROM users LIMIT 1"})
        with pytest.raises(Exception):
            runtime.action(session.id, "exec_sql", {"sql": "CREATE TABLE public.evil (x int)"})
    finally:
        runtime.destroy(session.id)


def test_sandbox_isolated_across_sessions(runtime, seed_ids):
    """A second learner's session cannot read the first learner's schema —
    each session's role only has USAGE on its own schema."""
    learner_id, camp_id = seed_ids
    ctx_a = LabContext(
        learner_id=learner_id,
        camp_id=camp_id,
        task_spec={"seed_sql": ["CREATE TABLE secrets (v text)", "INSERT INTO secrets VALUES ('shh')"]},
    )
    ctx_b = LabContext(learner_id=learner_id, camp_id=camp_id)
    session_a = runtime.create(ctx_a)
    session_b = runtime.create(ctx_b)
    try:
        schema_a = session_a.meta["schema"]
        with pytest.raises(Exception):
            runtime.action(session_b.id, "exec_sql", {"sql": f"SELECT * FROM {schema_a}.secrets"})
        # sanity: session A can still see its own data
        own = runtime.action(session_a.id, "exec_sql", {"sql": "SELECT v FROM secrets"})
        assert own["rows"][0]["v"] == "shh"
    finally:
        runtime.destroy(session_a.id)
        runtime.destroy(session_b.id)


def test_reset_reseeds_from_seed_sql(runtime, seed_ids):
    learner_id, camp_id = seed_ids
    ctx = LabContext(
        learner_id=learner_id,
        camp_id=camp_id,
        task_spec={"seed_sql": ["CREATE TABLE t (id int)", "INSERT INTO t VALUES (1)"]},
    )
    session = runtime.create(ctx)
    try:
        runtime.action(session.id, "exec_sql", {"sql": "INSERT INTO t VALUES (2)"})
        before = runtime.action(session.id, "exec_sql", {"sql": "SELECT COUNT(*) AS c FROM t"})["rows"][0]["c"]
        assert before == 2

        runtime.reset(session.id)
        after = runtime.action(session.id, "exec_sql", {"sql": "SELECT COUNT(*) AS c FROM t"})["rows"][0]["c"]
        assert after == 1
    finally:
        runtime.destroy(session.id)


def test_destroy_drops_schema_and_role(runtime, seed_ids):
    import psycopg

    learner_id, camp_id = seed_ids
    ctx = LabContext(learner_id=learner_id, camp_id=camp_id)
    session = runtime.create(ctx)
    schema = session.meta["schema"]
    row = sql_sandbox._row(session.id)
    role = row["role_name"]

    runtime.destroy(session.id)

    with sql_sandbox._admin_conn() as conn:
        schema_row = conn.execute("SELECT 1 FROM pg_namespace WHERE nspname=%s", (schema,)).fetchone()
        role_row = conn.execute("SELECT 1 FROM pg_roles WHERE rolname=%s", (role,)).fetchone()
    assert schema_row is None
    assert role_row is None

    with pytest.raises(psycopg.OperationalError):
        # the role no longer exists — connecting as it must fail
        sql_sandbox._role_conn(schema, role, row["role_password"])
