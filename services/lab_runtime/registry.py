"""Registry: runner name -> LabRuntime factory (agent | sim | sql_sandbox)."""

from __future__ import annotations

from typing import Callable

from services.lab_runtime.base import LabRuntime

_FACTORY: dict[str, Callable[[], LabRuntime]] = {}


def register(name: str, factory: Callable[[], LabRuntime] | type) -> None:
    """Register a zero-arg factory or a `LabRuntime`-shaped class."""
    _FACTORY[name] = factory  # type: ignore[assignment]


def get(name: str) -> LabRuntime:
    if name not in _FACTORY:
        raise KeyError(f"unknown lab runner: {name}; known={known_runners()}")
    return _FACTORY[name]()  # type: ignore[call-arg]


def known_runners() -> list[str]:
    return sorted(_FACTORY.keys())


def _autoload() -> None:
    # Import adapters for side-effect registration; kept lazy/defensive so a
    # missing optional dependency (e.g. no live PG) never breaks import of
    # the registry itself — only calling `get()` for that runner will fail.
    from services.lab_runtime import agent_adapter as _agent  # noqa: F401
    from services.lab_runtime import sim_adapter as _sim  # noqa: F401
    from services.lab_runtime import sql_sandbox as _sql  # noqa: F401


_autoload()
