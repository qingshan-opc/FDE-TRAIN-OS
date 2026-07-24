"""Sim adapter HTTP router — PostgreSQL JSONB persistence with adapter hydrate."""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

from fastapi import APIRouter, FastAPI, HTTPException, Request
from pydantic import BaseModel, Field

_ROOT = Path(__file__).resolve().parents[2]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from services.shared import db_cursor, init_schema  # noqa: E402
from services.shared.middleware import require_user, session_camp_id, session_learner_id  # noqa: E402
from services.shared.rubric_registry import attach_rubric_args, enrich_eval_result  # noqa: E402
from sim.registry import create, known_kinds  # noqa: E402

router = APIRouter(tags=["sim"])
app = FastAPI(title="FDE Sim Router", version="0.3.0")
init_schema()

# process cache of adapters; adapter_state also persisted in PG for hydrate
_ADAPTERS: dict[str, Any] = {}


class CreateSessionBody(BaseModel):
    sim_kind: str
    task_spec: dict[str, Any] = Field(default_factory=dict)
    learner_seed: dict[str, Any] = Field(default_factory=dict)
    camp_id: str | None = None
    day: int | None = None


class ActionBody(BaseModel):
    type: str
    payload: dict[str, Any] = Field(default_factory=dict)
    expected_version: int | None = None


class EvaluateBody(BaseModel):
    rubric: list[dict[str, Any]] = Field(default_factory=list)


def _load_adapter(kind: str):
    return create(kind)


def _parse_state(raw: Any) -> dict[str, Any]:
    if isinstance(raw, str):
        return json.loads(raw) if raw else {}
    if isinstance(raw, dict):
        return dict(raw)
    return {}


def _dump_adapter(adapter: Any, session_id: str) -> dict[str, Any] | None:
    dump = getattr(adapter, "dump_state", None)
    if not callable(dump):
        return None
    try:
        return dump(session_id)
    except Exception:
        return None


def _load_adapter_state(adapter: Any, session_id: str, adapter_state: dict[str, Any]) -> None:
    load = getattr(adapter, "load_state", None)
    if not callable(load):
        raise HTTPException(500, "adapter cannot hydrate")
    load(session_id, adapter_state)


def _persist(session_id: str, state: dict[str, Any], expected_version: int | None = None) -> int:
    with db_cursor() as cur:
        if expected_version is not None:
            cur.execute(
                """
                UPDATE sim_sessions
                SET state_json=?::jsonb, version=version+1, updated_at=NOW()
                WHERE id=? AND version=?
                RETURNING version
                """,
                (json.dumps(state, ensure_ascii=False), session_id, expected_version),
            )
            row = cur.fetchone()
            if not row:
                raise HTTPException(409, "sim session version conflict")
            return int(row["version"])
        cur.execute(
            """
            UPDATE sim_sessions
            SET state_json=?::jsonb, version=version+1, updated_at=NOW()
            WHERE id=?
            RETURNING version
            """,
            (json.dumps(state, ensure_ascii=False), session_id),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(404, "session not found")
        return int(row["version"])


def _get_row(session_id: str) -> dict[str, Any]:
    with db_cursor() as cur:
        cur.execute("SELECT * FROM sim_sessions WHERE id=?", (session_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(404, "session not found")
        return dict(row)


def _ensure_adapter(session_id: str, kind: str):
    if session_id in _ADAPTERS:
        return _ADAPTERS[session_id]
    adapter = _load_adapter(kind)
    row = _get_row(session_id)
    state = _parse_state(row.get("state_json"))
    adapter_state = state.get("adapter_state")
    if isinstance(adapter_state, dict) and adapter_state:
        _load_adapter_state(adapter, session_id, adapter_state)
    else:
        # Legacy rows without adapter_state — recreate seed skeleton
        task_spec = state.get("task_spec") or {}
        learner_seed = state.get("learner_seed") or {}
        try:
            new_sid = adapter.create_session(task_spec, learner_seed)
            dumped = _dump_adapter(adapter, new_sid)
            if dumped is not None:
                # Remap under original session id
                destroy = getattr(adapter, "destroy", None)
                if callable(destroy) and new_sid != session_id:
                    destroy(new_sid)
                _load_adapter_state(adapter, session_id, dumped)
                state["adapter_state"] = dumped
                _persist(session_id, state)
        except Exception as exc:
            raise HTTPException(409, f"sim session cannot hydrate: {exc}") from exc
    _ADAPTERS[session_id] = adapter
    return adapter


def _snapshot_state(adapter: Any, session_id: str, base: dict[str, Any]) -> dict[str, Any]:
    out = dict(base)
    dumped = _dump_adapter(adapter, session_id)
    if dumped is not None:
        out["adapter_state"] = dumped
    try:
        out["view"] = adapter.get_view_model(session_id)
    except Exception:
        pass
    return out


@router.get("/health")
def health() -> dict[str, Any]:
    return {"status": "ok", "service": "sim-router", "kinds": known_kinds()}


@router.post("/api/v1/sim/sessions")
def create_session(body: CreateSessionBody, request: Request) -> dict[str, Any]:
    learner_id = session_learner_id(request)
    camp_id = session_camp_id(request, body.camp_id)
    try:
        adapter = _load_adapter(body.sim_kind)
    except KeyError as e:
        raise HTTPException(400, str(e)) from e
    sid = adapter.create_session(body.task_spec, body.learner_seed)
    state = _snapshot_state(
        adapter,
        sid,
        {"task_spec": body.task_spec, "learner_seed": body.learner_seed},
    )
    with db_cursor() as cur:
        cur.execute(
            """
            INSERT INTO sim_sessions (id, sim_kind, learner_id, camp_id, day, state_json, version, created_at, updated_at)
            VALUES (?,?,?,?,?,?::jsonb,0,NOW(),NOW())
            """,
            (sid, body.sim_kind, learner_id, camp_id, body.day, json.dumps(state, ensure_ascii=False)),
        )
    _ADAPTERS[sid] = adapter
    return {"session_id": sid, "sim_kind": body.sim_kind, "version": 0, "learner_id": learner_id, "camp_id": camp_id}


def _owned(session_id: str, request: Request) -> dict[str, Any]:
    user = require_user(request)
    row = _get_row(session_id)
    if user.role not in ("author", "admin") and row.get("learner_id") != user.id:
        raise HTTPException(403, "无权访问该仿真会话")
    return row


@router.get("/api/v1/sim/sessions/{session_id}")
def get_session(session_id: str, request: Request) -> dict[str, Any]:
    row = _owned(session_id, request)
    adapter = _ensure_adapter(session_id, row["sim_kind"])
    try:
        vm = adapter.get_view_model(session_id)
    except Exception:
        state = _parse_state(row.get("state_json"))
        vm = state.get("view") or state
    return {**vm, "version": row["version"], "sim_kind": row["sim_kind"]}


@router.post("/api/v1/sim/sessions/{session_id}/actions")
def apply_action(session_id: str, body: ActionBody, request: Request) -> dict[str, Any]:
    row = _owned(session_id, request)
    adapter = _ensure_adapter(session_id, row["sim_kind"])
    result = adapter.apply_action(session_id, {"type": body.type, "payload": body.payload})
    state = _parse_state(row.get("state_json"))
    state["last_action"] = {"type": body.type, "payload": body.payload}
    state = _snapshot_state(adapter, session_id, state)
    version = _persist(session_id, state, body.expected_version)
    if isinstance(result, dict):
        result = {**result, "version": version}
    return result


@router.post("/api/v1/sim/sessions/{session_id}/evaluate")
def evaluate(session_id: str, body: EvaluateBody, request: Request) -> dict[str, Any]:
    row = _owned(session_id, request)
    adapter = _ensure_adapter(session_id, row["sim_kind"])
    result = adapter.evaluate(session_id, body.rubric)
    return enrich_eval_result(attach_rubric_args(result, body.rubric))


@router.get("/api/v1/sim/sessions/{session_id}/evidence")
def evidence(session_id: str, request: Request) -> dict[str, Any]:
    row = _owned(session_id, request)
    adapter = _ensure_adapter(session_id, row["sim_kind"])
    return {"files": adapter.export_evidence(session_id)}


@router.post("/api/v1/sim/sessions/{session_id}/reset")
def reset(session_id: str, request: Request) -> dict[str, Any]:
    row = _owned(session_id, request)
    adapter = _ensure_adapter(session_id, row["sim_kind"])
    adapter.reset(session_id)
    state = _parse_state(row.get("state_json"))
    state["reset"] = True
    state = _snapshot_state(adapter, session_id, state)
    version = _persist(session_id, state)
    return {"status": "reset", "version": version}


@router.delete("/api/v1/sim/sessions/{session_id}")
def destroy(session_id: str, request: Request) -> dict[str, str]:
    row = _owned(session_id, request)
    adapter = _ensure_adapter(session_id, row["sim_kind"])
    adapter.destroy(session_id)
    _ADAPTERS.pop(session_id, None)
    with db_cursor() as cur:
        cur.execute("DELETE FROM sim_sessions WHERE id=?", (session_id,))
    return {"status": "destroyed"}


app.include_router(router)
