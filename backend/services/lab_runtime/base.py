"""LabRuntime protocol — frozen contract for M4 unified lab runners.

Every lab kind (agent workspace, sim adapter, SQL sandbox, ...) implements
this same six-method surface so `services/sql_lab`, `services/eval_bridge`
and the frontend can treat them uniformly. Concrete adapters live next to
this module (`agent_adapter.py`, `sim_adapter.py`, `sql_sandbox.py`) and are
looked up by runner name via `registry.py`.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Protocol, runtime_checkable


@dataclass
class LabContext:
    """Everything a runtime needs to provision a session — no `Request`
    object crosses this boundary; callers (API routers) resolve
    learner/camp identity from the session *before* building this."""

    learner_id: str
    camp_id: str | None = None
    day: int | None = None
    node_id: str | None = None
    task_spec: dict[str, Any] = field(default_factory=dict)
    learner_seed: dict[str, Any] = field(default_factory=dict)


@dataclass
class LabSession:
    """Runtime-agnostic handle returned by `create()`."""

    id: str
    runner: str
    learner_id: str
    camp_id: str | None = None
    day: int | None = None
    node_id: str | None = None
    meta: dict[str, Any] = field(default_factory=dict)


@runtime_checkable
class LabRuntime(Protocol):
    """Uniform interface for all lab runners (agent | sim | sql_sandbox)."""

    def create(self, ctx: LabContext) -> LabSession: ...

    def reset(self, session_id: str) -> None: ...

    def action(self, session_id: str, action: str, payload: dict[str, Any]) -> dict[str, Any]: ...

    def evaluate(self, session_id: str, rubric: list[dict[str, Any]]) -> dict[str, Any]: ...

    def export_evidence(self, session_id: str) -> dict[str, Any]: ...

    def destroy(self, session_id: str) -> None: ...
