"""Registry: sim_kind → adapter factory."""

from __future__ import annotations

from typing import Callable

from sim.protocol import SimAdapter, SimKind

_FACTORY: dict[SimKind, Callable[[], SimAdapter]] = {}


def register(kind: SimKind, factory: Callable[[], SimAdapter] | type[SimAdapter]) -> None:
    """Register a zero-arg factory or adapter class."""
    _FACTORY[kind] = factory  # type: ignore[assignment]


def create(kind: str) -> SimAdapter:
    if kind not in _FACTORY:
        raise KeyError(f"unknown sim_kind: {kind}; known={list(_FACTORY)}")
    return _FACTORY[kind]()  # type: ignore[index]


def known_kinds() -> list[str]:
    return sorted(_FACTORY.keys())


def _autoload() -> None:
    # Import adapters for side-effect registration.
    from sim.adapters import arch_design as _a  # noqa: F401
    from sim.adapters import k8s as _k  # noqa: F401
    from sim.adapters import server as _s  # noqa: F401
    from sim.adapters import web_dev as _w  # noqa: F401


_autoload()
