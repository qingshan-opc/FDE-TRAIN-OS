"""SQL Lab HTTP router — isolated Postgres sandbox sessions for learners.

Thin HTTP shell over `services.lab_runtime.sql_sandbox`: this module owns
auth/ownership/camp-access checks and error shaping; all schema/role
provisioning and SQL execution lives in the runtime module so it can be
addressed uniformly alongside the `agent` and `sim` runners via
`services.lab_runtime.registry`.
"""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, FastAPI, HTTPException, Request
from pydantic import BaseModel, Field

_ROOT = Path(__file__).resolve().parents[2]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from services.lab_runtime.base import LabContext  # noqa: E402
from services.lab_runtime.registry import get as get_runtime  # noqa: E402
from services.shared import db_cursor, init_schema, write_audit  # noqa: E402
from services.shared.middleware import require_camp_access, require_user, session_camp_id, session_learner_id  # noqa: E402
from services.shared.rate_limit import rate_limit  # noqa: E402

router = APIRouter(tags=["sql-lab"])
app = FastAPI(title="FDE SQL Lab", version="0.1.0")
init_schema()


class CreateSessionBody(BaseModel):
    camp_id: str | None = None
    day: int | None = None
    node_id: str | None = None
    seed_sql: list[str] = Field(default_factory=list)


class ExecBody(BaseModel):
    sql: str


class EvaluateBody(BaseModel):
    rubric: list[dict[str, Any]] = Field(default_factory=list)


def _runtime():
    return get_runtime("sql_sandbox")


def _owned(session_id: str, request: Request) -> dict[str, Any]:
    user = require_user(request)
    with db_cursor() as cur:
        cur.execute("SELECT * FROM sql_lab_sessions WHERE id=?", (session_id,))
        row = cur.fetchone()
    if not row:
        raise HTTPException(404, "sql-lab session not found")
    row = dict(row)
    if user.role not in ("author", "admin") and row.get("learner_id") != user.id:
        raise HTTPException(403, "无权访问该 SQL 沙箱会话")
    return row


def _as_http_error(exc: Exception) -> HTTPException:
    if isinstance(exc, (ValueError, KeyError)):
        return HTTPException(400, str(exc))
    # psycopg errors (syntax errors, undefined table, etc.) are expected,
    # learner-facing console output — never a 500.
    return HTTPException(400, str(exc))


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "sql-lab"}


@router.post("/api/v1/sql-lab/sessions")
def create_session(body: CreateSessionBody, request: Request) -> dict[str, Any]:
    learner_id = session_learner_id(request)
    camp_id = session_camp_id(request, body.camp_id)
    require_camp_access(request, camp_id)
    ctx = LabContext(
        learner_id=learner_id,
        camp_id=camp_id,
        day=body.day,
        node_id=body.node_id,
        task_spec={"seed_sql": body.seed_sql},
    )
    try:
        session = _runtime().create(ctx)
    except Exception as exc:
        raise HTTPException(500, f"sql sandbox provisioning failed: {exc}") from exc
    write_audit("sql_lab.create", actor_id=learner_id, camp_id=camp_id, resource_id=session.id)
    return {
        "session_id": session.id,
        "learner_id": learner_id,
        "camp_id": camp_id,
        "day": body.day,
        "node_id": body.node_id,
        "expires_in": session.meta.get("ttl_sec"),
    }


@router.post("/api/v1/sql-lab/sessions/{session_id}/exec", dependencies=[Depends(rate_limit("sql_exec"))])
def exec_sql(session_id: str, body: ExecBody, request: Request) -> dict[str, Any]:
    _owned(session_id, request)
    try:
        return _runtime().action(session_id, "exec_sql", {"sql": body.sql})
    except Exception as exc:
        raise _as_http_error(exc) from exc


@router.get("/api/v1/sql-lab/sessions/{session_id}/schema")
def get_schema(session_id: str, request: Request) -> dict[str, Any]:
    row = _owned(session_id, request)
    runtime = _runtime()
    try:
        tables = runtime.action(session_id, "list_tables", {})["tables"]
        detail = []
        for name in tables:
            try:
                cols = runtime.action(session_id, "describe", {"table": name})["columns"]
            except Exception:
                cols = []
            detail.append({"name": name, "columns": cols})
    except Exception as exc:
        raise _as_http_error(exc) from exc
    return {"schema": row.get("schema_name"), "tables": detail}


@router.post("/api/v1/sql-lab/sessions/{session_id}/reset")
def reset_session(session_id: str, request: Request) -> dict[str, Any]:
    _owned(session_id, request)
    try:
        _runtime().reset(session_id)
    except Exception as exc:
        raise _as_http_error(exc) from exc
    return {"status": "reset"}


@router.post("/api/v1/sql-lab/sessions/{session_id}/evaluate")
def evaluate_session(session_id: str, body: EvaluateBody, request: Request) -> dict[str, Any]:
    _owned(session_id, request)
    try:
        return _runtime().evaluate(session_id, body.rubric)
    except Exception as exc:
        raise _as_http_error(exc) from exc


@router.delete("/api/v1/sql-lab/sessions/{session_id}")
def destroy_session(session_id: str, request: Request) -> dict[str, str]:
    row = _owned(session_id, request)
    try:
        _runtime().destroy(session_id)
    except Exception as exc:
        raise _as_http_error(exc) from exc
    write_audit("sql_lab.destroy", actor_id=row.get("learner_id"), camp_id=row.get("camp_id"), resource_id=session_id)
    return {"status": "destroyed"}


app.include_router(router)
