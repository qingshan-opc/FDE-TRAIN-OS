"""FDE Simulation Adapter protocol — frozen contract.

Learner labs MUST NOT start real Docker/K8s environments.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any, Literal, TypedDict

SimKind = Literal["web_dev", "server", "k8s", "arch_design"]


class CheckResult(TypedDict):
    id: str
    ok: bool
    detail: str


class EvalResult(TypedDict):
    pass_: bool  # use key "pass" in JSON serializers
    checks: list[CheckResult]
    artifacts: list[dict[str, str]]
    score: float


class ActionEnvelope(TypedDict, total=False):
    type: str
    payload: dict[str, Any]
    client_ts: str


class SimAdapter(ABC):
    """Uniform interface for all simulation kinds."""

    kind: SimKind
    adapter_version: str = "1.0"

    @abstractmethod
    def create_session(self, task_spec: dict[str, Any], learner_seed: dict[str, Any]) -> str:
        ...

    @abstractmethod
    def get_view_model(self, session_id: str) -> dict[str, Any]:
        ...

    @abstractmethod
    def apply_action(self, session_id: str, action: ActionEnvelope) -> dict[str, Any]:
        ...

    @abstractmethod
    def evaluate(self, session_id: str, rubric: list[dict[str, Any]]) -> dict[str, Any]:
        """Return dict with keys: pass, checks, artifacts, score."""
        ...

    @abstractmethod
    def export_evidence(self, session_id: str) -> list[dict[str, str]]:
        ...

    @abstractmethod
    def get_state_summary(self, session_id: str) -> str:
        """Coach-facing short summary; never includes secrets."""
        ...

    @abstractmethod
    def reset(self, session_id: str) -> None:
        ...

    @abstractmethod
    def destroy(self, session_id: str) -> None:
        ...
