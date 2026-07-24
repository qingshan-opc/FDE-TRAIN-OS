"""web_dev adapter skeleton — in-memory FS + preview model."""

from __future__ import annotations

from typing import Any

from sim.protocol import ActionEnvelope, SimAdapter
from sim.registry import register
from sim.store import MemorySessionStore

_store = MemorySessionStore()


class WebDevAdapter(SimAdapter):
    kind = "web_dev"
    adapter_version = "1.0"

    def create_session(self, task_spec: dict[str, Any], learner_seed: dict[str, Any]) -> str:
        lab = task_spec.get("lab") or task_spec
        seed = {**(lab.get("seed") or {}), **learner_seed}
        files = {f["path"]: f.get("content", "") for f in seed.get("files") or []}
        if not files:
            files = {"index.html": "<!doctype html><title>lab</title><h1>Hello</h1>"}
        return _store.create(
            {
                "kind": self.kind,
                "files": files,
                "actions": [],
                "seed": seed,
            }
        )

    def get_view_model(self, session_id: str) -> dict[str, Any]:
        s = _store.get(session_id)
        return {
            "layout": "editor_preview",
            "files": sorted(s["files"].keys()),
            "active_file": next(iter(s["files"]), "index.html"),
            "preview": "iframe",
        }

    def apply_action(self, session_id: str, action: ActionEnvelope) -> dict[str, Any]:
        s = _store.get(session_id)
        t = action.get("type")
        p = action.get("payload") or {}
        if t == "fs.write":
            s["files"][p["path"]] = p.get("content", "")
        elif t == "fs.read":
            return {"content": s["files"].get(p["path"], ""), "state": s}
        s["actions"].append(action)
        _store.set(session_id, s)
        return {"state": {"files": s["files"]}, "events": [t], "hints": []}

    def evaluate(self, session_id: str, rubric: list[dict[str, Any]]) -> dict[str, Any]:
        s = _store.get(session_id)
        checks = []
        for rule in rubric:
            cid = rule.get("check", "unknown")
            args = rule.get("args") or {}
            ok = False
            detail = ""
            if cid == "text_contains":
                path = args.get("path", "index.html")
                needle = args.get("needle", "")
                ok = needle.lower() in s["files"].get(path, "").lower()
                detail = f"{path} contains {needle!r}: {ok}"
            elif cid == "dom_contains":
                # Skeleton: approximate via HTML source search for selector fragments.
                sel = args.get("selector", "")
                blob = "\n".join(s["files"].values()).lower()
                token = sel.replace("#", 'id="').replace(".", "class=")
                ok = any(part in blob for part in (sel.lower(), token.lower()) if part)
                detail = f"selector {sel}: {ok}"
            else:
                detail = f"check {cid} not implemented in skeleton"
            checks.append({"id": cid, "ok": ok, "detail": detail})
        passed = all(c["ok"] for c in checks) if checks else False
        return {"pass": passed, "checks": checks, "artifacts": [], "score": sum(c["ok"] for c in checks) / max(len(checks), 1)}

    def export_evidence(self, session_id: str) -> list[dict[str, str]]:
        s = _store.get(session_id)
        return [{"name": path, "content": content} for path, content in s["files"].items()]

    def get_state_summary(self, session_id: str) -> str:
        s = _store.get(session_id)
        return f"web_dev files={list(s['files'].keys())} actions={len(s['actions'])}"

    def reset(self, session_id: str) -> None:
        s = _store.get(session_id)
        seed = s.get("seed") or {}
        files = {f["path"]: f.get("content", "") for f in seed.get("files") or []}
        s["files"] = files or s["files"]
        s["actions"] = []
        _store.set(session_id, s)

    def destroy(self, session_id: str) -> None:
        _store.delete(session_id)

    def dump_state(self, session_id: str) -> dict[str, Any]:
        return _store.export(session_id)

    def load_state(self, session_id: str, state: dict[str, Any]) -> None:
        _store.put(session_id, state)


register("web_dev", WebDevAdapter)
