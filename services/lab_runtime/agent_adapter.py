"""LabRuntime adapter over the existing agent workspace/job APIs.

Thin by design: workspace hydrate/snapshot, job enqueue and rubric checks
already live in `services/agent_gateway/app.py`. That module's functions
take a FastAPI `Request` (for session-derived auth) so they can't be called
directly from a `LabContext`-only interface; this adapter re-implements the
same handful of calls against the shared helpers (`workspace_path`,
`resolve_safe`, `snapshot_workspace`, `services.domain.jobs`) instead of
duplicating business logic.

Agent workspaces are keyed by `(camp_id, learner_id)`, not by an ephemeral
session id, so `create()` returns a session id of `"{camp_id}:{learner_id}"`
and `destroy()` is a deliberate no-op — the workspace is meant to persist
across the whole camp, not be torn down like a sim/SQL sandbox session.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any
from uuid import uuid4

from services.lab_runtime.base import LabContext, LabSession
from services.shared import (
    db_cursor,
    now_iso,
    resolve_safe,
    workspace_path,
    workspace_size_bytes,
)

DENY_PATTERNS = ("rm -rf /", "docker ", "kubectl ", "mkfs", ":(){", "shutdown", "reboot")


def _split(session_id: str) -> tuple[str, str]:
    camp_id, _, learner_id = session_id.partition(":")
    if not camp_id or not learner_id:
        raise ValueError(f"malformed agent session id: {session_id!r}")
    return camp_id, learner_id


def _materialize_ws(camp_id: str, learner_id: str) -> Path:
    from services.storage import hydrate_workspace

    with db_cursor() as cur:
        cur.execute(
            "SELECT snapshot_id FROM workspace_heads WHERE camp_id=? AND learner_id=?",
            (camp_id, learner_id),
        )
        head = cur.fetchone()
    snap = head["snapshot_id"] if head else None
    dest = workspace_path(camp_id, learner_id)
    if snap:
        hydrate_workspace(camp_id, learner_id, snap, dest)
    return dest


def _guard_prompt(prompt: str) -> None:
    low = prompt.lower()
    for pat in DENY_PATTERNS:
        if pat in low:
            raise ValueError(f"prompt blocked by safety guard: {pat!r}")


class AgentLabRuntime:
    """Adapts agent workspace + job APIs to `LabRuntime`."""

    runner = "agent"

    def create(self, ctx: LabContext) -> LabSession:
        if not ctx.camp_id:
            raise ValueError("agent runner requires camp_id")
        ws = _materialize_ws(ctx.camp_id, ctx.learner_id)
        size = workspace_size_bytes(ws)
        sid = f"{ctx.camp_id}:{ctx.learner_id}"
        return LabSession(
            id=sid,
            runner=self.runner,
            learner_id=ctx.learner_id,
            camp_id=ctx.camp_id,
            day=ctx.day,
            node_id=ctx.node_id,
            meta={"workspace": str(ws), "size_bytes": size},
        )

    def reset(self, session_id: str) -> None:
        """Re-hydrate the local workspace copy from the current head snapshot.

        Not a destructive rollback — agent workspaces are the learner's
        persistent deliverable, so there is no ephemeral seed to replay."""
        camp_id, learner_id = _split(session_id)
        _materialize_ws(camp_id, learner_id)

    def action(self, session_id: str, action: str, payload: dict[str, Any]) -> dict[str, Any]:
        camp_id, learner_id = _split(session_id)
        ws = _materialize_ws(camp_id, learner_id)

        if action == "workspace.read_file":
            fp = resolve_safe(ws, str(payload.get("path", "index.html")))
            if not fp.is_file():
                raise FileNotFoundError(str(payload.get("path")))
            return {"path": payload.get("path"), "content": fp.read_text(encoding="utf-8")[:200_000]}

        if action == "workspace.write_file":
            from services.storage import snapshot_workspace

            rel = str(payload.get("path") or "").strip().lstrip("/")
            if not rel or ".." in rel.split("/"):
                raise ValueError("invalid path")
            fp = resolve_safe(ws, rel)
            fp.parent.mkdir(parents=True, exist_ok=True)
            fp.write_text(str(payload.get("content", "")), encoding="utf-8")
            with db_cursor() as cur:
                cur.execute(
                    "SELECT snapshot_id FROM workspace_heads WHERE camp_id=? AND learner_id=?",
                    (camp_id, learner_id),
                )
                head = cur.fetchone()
                parent_id = head["snapshot_id"] if head else None
            snap = snapshot_workspace(camp_id, learner_id, ws, parent_id=parent_id, job_id=None)
            with db_cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO workspace_snapshots (id, camp_id, learner_id, parent_id, manifest_key, object_prefix, size_bytes, file_count, created_by_job_id)
                    VALUES (?,?,?,?,?,?,?,?,?)
                    """,
                    (
                        snap["id"], camp_id, learner_id, snap.get("parent_id"),
                        snap["manifest_key"], snap["object_prefix"], snap["size_bytes"], snap["file_count"], None,
                    ),
                )
                cur.execute(
                    """
                    INSERT INTO workspace_heads (camp_id, learner_id, snapshot_id, version, updated_at)
                    VALUES (?, ?, ?, 1, NOW())
                    ON CONFLICT (camp_id, learner_id) DO UPDATE
                    SET snapshot_id=EXCLUDED.snapshot_id, version=workspace_heads.version+1, updated_at=NOW()
                    """,
                    (camp_id, learner_id, snap["id"]),
                )
            return {"ok": True, "path": rel, "snapshot_id": snap["id"], "size_bytes": snap["size_bytes"]}

        if action == "job.create":
            from services.domain import jobs as queue

            prompt = str(payload.get("prompt") or "")
            _guard_prompt(prompt)
            with db_cursor() as cur:
                cur.execute(
                    "SELECT COUNT(*) AS c FROM jobs WHERE learner_id=? AND kind='agent_job' AND status IN ('queued','hydrating','running','evaluating','snapshotting')",
                    (learner_id,),
                )
                if int((cur.fetchone() or {}).get("c") or 0) >= 1:
                    raise RuntimeError("learner already has an active agent job")
            legacy_id = str(uuid4())
            with db_cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO agent_jobs
                    (id, learner_id, camp_id, workspace, prompt, status, runner, anycode_session_id,
                     anycode_project_id, events_json, result_json, artifact_uri, created_at, updated_at)
                    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                    """,
                    (legacy_id, learner_id, camp_id, str(ws), prompt, "queued", "stub", None, None, "[]", "{}", None, now_iso(), now_iso()),
                )
            job_id = queue.enqueue_job(
                "agent_job",
                {"camp_id": camp_id, "learner_id": learner_id, "prompt": prompt, "legacy_job_id": legacy_id, "node_id": payload.get("node_id")},
            )
            return {"job_id": job_id, "legacy_job_id": legacy_id, "runner": "stub", "status": "queued"}

        if action == "job.get":
            job_id = str(payload.get("job_id") or "")
            with db_cursor() as cur:
                cur.execute("SELECT * FROM agent_jobs WHERE id=?", (job_id,))
                row = cur.fetchone()
            if not row:
                raise KeyError(f"job not found: {job_id}")
            return dict(row)

        raise ValueError(f"unknown agent action: {action}")

    def evaluate(self, session_id: str, rubric: list[dict[str, Any]]) -> dict[str, Any]:
        camp_id, learner_id = _split(session_id)
        ws = _materialize_ws(camp_id, learner_id)
        checks = []
        for rule in rubric:
            cid = rule.get("check", "")
            args = rule.get("args") or {}
            ok, detail = False, ""
            try:
                if cid == "file_exists":
                    p = resolve_safe(ws, args.get("path", "index.html"))
                    ok = p.is_file()
                    detail = f"{args.get('path')} exists={ok}"
                elif cid == "text_contains":
                    p = resolve_safe(ws, args.get("path", "index.html"))
                    needle = args.get("needle", "")
                    text = p.read_text(encoding="utf-8") if p.is_file() else ""
                    ok = needle.lower() in text.lower()
                    detail = f"contains {needle!r}: {ok}"
                else:
                    detail = f"unknown check {cid}"
            except Exception as exc:
                detail = str(exc)
            checks.append({"id": cid, "ok": ok, "detail": detail})
        passed = all(c["ok"] for c in checks) if checks else False
        return {"pass": passed, "checks": checks, "score": sum(1 for c in checks if c["ok"]) / max(len(checks), 1)}

    def export_evidence(self, session_id: str) -> dict[str, Any]:
        camp_id, learner_id = _split(session_id)
        ws = _materialize_ws(camp_id, learner_id)
        files = [{"path": str(p.relative_to(ws)), "size": p.stat().st_size} for p in sorted(ws.rglob("*")) if p.is_file()]
        return {"files": files, "size_bytes": workspace_size_bytes(ws)}

    def destroy(self, session_id: str) -> None:
        """No-op — agent workspaces persist for the whole camp by design."""
        _split(session_id)  # validate shape; nothing else to tear down


def _factory() -> AgentLabRuntime:
    return AgentLabRuntime()


def _register() -> None:
    from services.lab_runtime.registry import register

    register("agent", _factory)


_register()

__all__ = ["AgentLabRuntime"]
