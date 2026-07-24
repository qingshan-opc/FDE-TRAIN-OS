"""anyCode Workbench HTTP client (AgentRuntime via headless dashboard-serve)."""

from __future__ import annotations

import json
import logging
from collections.abc import Callable, Iterator
from pathlib import Path
from typing import Any

import httpx

from services.shared.config import (
    ANYCODE_API_TOKEN,
    ANYCODE_DASHBOARD_URL,
    ANYCODE_SSE_TIMEOUT_SEC,
    DATA_DIR,
)

log = logging.getLogger("fde.anycode")

EventCallback = Callable[[str, dict[str, Any]], None]


def anycode_headers() -> dict[str, str]:
    headers = {"Accept": "application/json"}
    if ANYCODE_API_TOKEN:
        headers["Authorization"] = f"Bearer {ANYCODE_API_TOKEN}"
    return headers


def anycode_base() -> str:
    return (ANYCODE_DASHBOARD_URL or "").rstrip("/")


def anycode_healthy(timeout: float = 2.0) -> bool:
    base = anycode_base()
    if not base:
        return False
    try:
        with httpx.Client(timeout=timeout) as client:
            r = client.get(f"{base}/api/health", headers=anycode_headers())
            return r.status_code < 500
    except Exception:
        return False


def coach_sandbox_path() -> Path:
    p = DATA_DIR / "coach_sandbox"
    p.mkdir(parents=True, exist_ok=True)
    (p / ".fde-coach").write_text("FDE coach sandbox — do not run learner bash here.\n", encoding="utf-8")
    return p


def ensure_project(
    client: httpx.Client,
    *,
    root_path: str | Path,
    name: str,
) -> str:
    base = anycode_base()
    if not base:
        raise RuntimeError("ANYCODE_DASHBOARD_URL missing")
    pr = client.post(
        f"{base}/api/projects",
        headers=anycode_headers(),
        json={"root_path": str(root_path), "name": name, "create_root": True},
    )
    pr.raise_for_status()
    pdata = pr.json()
    project = pdata.get("project") or pdata
    project_id = project.get("id") or project.get("project_id")
    if not project_id:
        raise RuntimeError(f"anyCode project missing id: {pdata}")
    return str(project_id)


def start_conversation(
    client: httpx.Client,
    project_id: str,
    *,
    prompt: str,
    skills: list[str] | None = None,
    agent: str | None = "general-purpose",
    kind: str = "run",
    lang: str = "zh",
    recycle_session: bool = False,
) -> tuple[str, dict[str, Any]]:
    base = anycode_base()
    body: dict[str, Any] = {
        "prompt": prompt,
        "kind": kind,
        "lang": lang,
        "recycle_session": recycle_session,
    }
    if agent:
        body["agent"] = agent
    if skills:
        body["skills"] = skills
    start = client.post(
        f"{base}/api/projects/{project_id}/conversations/start",
        headers=anycode_headers(),
        json=body,
    )
    start.raise_for_status()
    data = start.json()
    session = data.get("session") or {}
    session_id = session.get("id") or data.get("session_id")
    if not session_id:
        raise RuntimeError(f"anyCode conversation missing session_id: {data}")
    return str(session_id), data


def _parse_sse_chunks(lines: Iterator[str]) -> Iterator[tuple[str, dict[str, Any]]]:
    event_name = "message"
    data_lines: list[str] = []
    for raw in lines:
        line = raw.rstrip("\r")
        if line.startswith(":"):
            continue
        if not line:
            if data_lines:
                payload = "\n".join(data_lines)
                data_lines = []
                try:
                    obj = json.loads(payload)
                except json.JSONDecodeError:
                    obj = {"raw": payload}
                if isinstance(obj, dict):
                    yield event_name, obj
            event_name = "message"
            continue
        if line.startswith("event:"):
            event_name = line[6:].strip() or "message"
        elif line.startswith("data:"):
            data_lines.append(line[5:].lstrip())


def iter_session_events(
    session_id: str,
    *,
    timeout_sec: float | None = None,
    on_event: EventCallback | None = None,
) -> dict[str, Any]:
    """Consume session SSE until turn_done / session_error / timeout.

    Returns accumulated assistant text and terminal status.
    """
    base = anycode_base()
    if not base:
        raise RuntimeError("ANYCODE_DASHBOARD_URL missing")
    timeout = timeout_sec if timeout_sec is not None else float(ANYCODE_SSE_TIMEOUT_SEC)
    url = f"{base}/api/sessions/{session_id}/events/stream"
    headers = {**anycode_headers(), "Accept": "text/event-stream"}
    assistant_parts: list[str] = []
    terminal = "timeout"
    error_msg: str | None = None

    with httpx.Client(timeout=httpx.Timeout(timeout, connect=10.0)) as client:
        with client.stream("GET", url, headers=headers) as resp:
            if resp.status_code >= 400:
                body = resp.read().decode("utf-8", errors="ignore")[:500]
                raise RuntimeError(f"anyCode SSE HTTP {resp.status_code}: {body}")
            try:
                for ev_name, payload in _parse_sse_chunks(resp.iter_lines()):
                    kind = str(payload.get("kind") or "")
                    if ev_name == "chat_event" or kind:
                        if on_event:
                            on_event(ev_name, payload)
                        if kind == "assistant_delta":
                            text = payload.get("text")
                            if text:
                                assistant_parts.append(str(text))
                        elif kind == "assistant_done":
                            text = payload.get("text")
                            if text and not assistant_parts:
                                assistant_parts.append(str(text))
                        elif kind == "turn_done":
                            terminal = "turn_done"
                            break
                        elif kind == "session_error":
                            terminal = "session_error"
                            error_msg = str(payload.get("text") or payload.get("payload") or "session_error")
                            break
            except httpx.ReadTimeout:
                terminal = "timeout"

    return {
        "status": terminal,
        "reply": "".join(assistant_parts),
        "error": error_msg,
        "session_id": session_id,
    }


def run_turn(
    *,
    root_path: str | Path,
    project_name: str,
    prompt: str,
    skills: list[str] | None = None,
    on_event: EventCallback | None = None,
    timeout_sec: float | None = None,
) -> dict[str, Any]:
    """Create/reuse project, start conversation, wait for turn via SSE."""
    base = anycode_base()
    if not base:
        raise RuntimeError("ANYCODE_DASHBOARD_URL missing")
    timeout = timeout_sec if timeout_sec is not None else float(ANYCODE_SSE_TIMEOUT_SEC)
    with httpx.Client(timeout=httpx.Timeout(60.0, connect=10.0)) as client:
        if not anycode_healthy():
            raise RuntimeError("anyCode Workbench unreachable")
        project_id = ensure_project(client, root_path=root_path, name=project_name)
        session_id, start_data = start_conversation(
            client,
            project_id,
            prompt=prompt,
            skills=skills,
        )
    result = iter_session_events(session_id, timeout_sec=timeout, on_event=on_event)
    result["project_id"] = project_id
    result["start"] = start_data
    return result
