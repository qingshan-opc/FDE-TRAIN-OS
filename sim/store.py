"""Shared in-memory session store for adapters — supports PG hydrate via put/export."""

from __future__ import annotations

import copy
import uuid
from typing import Any


class MemorySessionStore:
    def __init__(self) -> None:
        self._sessions: dict[str, dict[str, Any]] = {}

    def create(self, initial: dict[str, Any]) -> str:
        sid = str(uuid.uuid4())
        self._sessions[sid] = initial
        return sid

    def get(self, session_id: str) -> dict[str, Any]:
        if session_id not in self._sessions:
            raise KeyError(session_id)
        return self._sessions[session_id]

    def set(self, session_id: str, state: dict[str, Any]) -> None:
        self._sessions[session_id] = state

    def put(self, session_id: str, state: dict[str, Any]) -> None:
        """Hydrate or replace a session under a known id (e.g. from PostgreSQL)."""
        self._sessions[session_id] = dict(state)

    def export(self, session_id: str) -> dict[str, Any]:
        return copy.deepcopy(self.get(session_id))

    def delete(self, session_id: str) -> None:
        self._sessions.pop(session_id, None)

    def has(self, session_id: str) -> bool:
        return session_id in self._sessions
