"""LabRuntime adapter over the existing sim-router session store / PG hydrate.

Thin by design: all persistence, versioning and adapter hydrate logic
already lives in `services/sim-router/app.py` (re-exported as
`services.sim_router.app`). This module just re-shapes that surface to the
`LabRuntime` protocol so callers (e.g. `services/sql_lab`-style routers, the
EvalBridge) can address sim sessions the same way they address SQL sandbox
or agent-workspace sessions.
"""

from __future__ import annotations

from typing import Any

from services.lab_runtime.base import LabContext, LabSession
from services.shared import db_cursor

_ROUTER_MODULE = "services.sim_router.app"


def _impl():
    """Import lazily — avoids a hard PG dependency at module import time."""
    import importlib

    return importlib.import_module(_ROUTER_MODULE)


class SimLabRuntime:
    """Adapts `sim.registry` + sim-router's PG hydrate to `LabRuntime`."""

    runner = "sim"

    def create(self, ctx: LabContext) -> LabSession:
        impl = _impl()
        sim_kind = str(ctx.task_spec.get("sim_kind") or "web_dev")
        adapter = impl._load_adapter(sim_kind)
        sid = adapter.create_session(ctx.task_spec, ctx.learner_seed)
        state = impl._snapshot_state(
            adapter, sid, {"task_spec": ctx.task_spec, "learner_seed": ctx.learner_seed}
        )
        import json

        with db_cursor() as cur:
            cur.execute(
                """
                INSERT INTO sim_sessions (id, sim_kind, learner_id, camp_id, day, state_json, version, created_at, updated_at)
                VALUES (?,?,?,?,?,?::jsonb,0,NOW(),NOW())
                """,
                (sid, sim_kind, ctx.learner_id, ctx.camp_id, ctx.day, json.dumps(state, ensure_ascii=False)),
            )
        impl._ADAPTERS[sid] = adapter
        return LabSession(
            id=sid,
            runner=self.runner,
            learner_id=ctx.learner_id,
            camp_id=ctx.camp_id,
            day=ctx.day,
            node_id=ctx.node_id,
            meta={"sim_kind": sim_kind, "version": 0},
        )

    def reset(self, session_id: str) -> None:
        impl = _impl()
        row = impl._get_row(session_id)
        adapter = impl._ensure_adapter(session_id, row["sim_kind"])
        adapter.reset(session_id)
        state = impl._parse_state(row.get("state_json"))
        state["reset"] = True
        state = impl._snapshot_state(adapter, session_id, state)
        impl._persist(session_id, state)

    def action(self, session_id: str, action: str, payload: dict[str, Any]) -> dict[str, Any]:
        impl = _impl()
        row = impl._get_row(session_id)
        adapter = impl._ensure_adapter(session_id, row["sim_kind"])
        result = adapter.apply_action(session_id, {"type": action, "payload": payload})
        state = impl._parse_state(row.get("state_json"))
        state["last_action"] = {"type": action, "payload": payload}
        state = impl._snapshot_state(adapter, session_id, state)
        version = impl._persist(session_id, state)
        if isinstance(result, dict):
            result = {**result, "version": version}
        return result

    def evaluate(self, session_id: str, rubric: list[dict[str, Any]]) -> dict[str, Any]:
        impl = _impl()
        row = impl._get_row(session_id)
        adapter = impl._ensure_adapter(session_id, row["sim_kind"])
        return adapter.evaluate(session_id, rubric)

    def export_evidence(self, session_id: str) -> dict[str, Any]:
        impl = _impl()
        row = impl._get_row(session_id)
        adapter = impl._ensure_adapter(session_id, row["sim_kind"])
        return {"files": adapter.export_evidence(session_id)}

    def destroy(self, session_id: str) -> None:
        impl = _impl()
        row = impl._get_row(session_id)
        adapter = impl._ensure_adapter(session_id, row["sim_kind"])
        adapter.destroy(session_id)
        impl._ADAPTERS.pop(session_id, None)
        with db_cursor() as cur:
            cur.execute("DELETE FROM sim_sessions WHERE id=?", (session_id,))


def _factory() -> SimLabRuntime:
    return SimLabRuntime()


def _register() -> None:
    from services.lab_runtime.registry import register

    register("sim", _factory)


_register()

__all__ = ["SimLabRuntime"]
