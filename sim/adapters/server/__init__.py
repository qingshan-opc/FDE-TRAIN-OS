"""server adapter skeleton — fake shell semantics + service state."""

from __future__ import annotations

from typing import Any

from sim.protocol import ActionEnvelope, SimAdapter
from sim.registry import register
from sim.store import MemorySessionStore

_store = MemorySessionStore()


class ServerAdapter(SimAdapter):
    kind = "server"
    adapter_version = "1.0"

    def create_session(self, task_spec: dict[str, Any], learner_seed: dict[str, Any]) -> str:
        lab = task_spec.get("lab") or task_spec
        return _store.create(
            {
                "kind": self.kind,
                "cwd": "/home/trainee",
                "files": {"/etc/nginx/sites-enabled/docs": "# empty"},
                "ports": {},
                "history": [],
                "seed": {**(lab.get("seed") or {}), **learner_seed},
            }
        )

    def get_view_model(self, session_id: str) -> dict[str, Any]:
        s = _store.get(session_id)
        return {"layout": "terminal_plus_panels", "cwd": s["cwd"], "ports": s["ports"]}

    def apply_action(self, session_id: str, action: ActionEnvelope) -> dict[str, Any]:
        s = _store.get(session_id)
        if action.get("type") == "terminal.exec":
            cmd = (action.get("payload") or {}).get("cmd", "")
            s["history"].append(cmd)
            out = self._simulate(cmd, s)
            _store.set(session_id, s)
            return {"state": {"ports": s["ports"]}, "events": ["exec"], "hints": [], "stdout": out}
        return {"state": {}, "events": [], "hints": ["unsupported action"]}

    def _simulate(self, cmd: str, s: dict[str, Any]) -> str:
        if "nginx -t" in cmd:
            return "syntax is ok"
        if "systemctl reload nginx" in cmd or "systemctl start nginx" in cmd:
            s["ports"]["80"] = "nginx"
            return "reloaded"
        if cmd.startswith("cat ") and "<<" not in cmd and ">" not in cmd:
            path = cmd.split(maxsplit=1)[-1].strip()
            return s["files"].get(path, "not found")
        # support: echo 'proxy_pass ...' > /etc/nginx/sites-enabled/docs
        if ">" in cmd and "/etc/nginx" in cmd:
            left, right = cmd.split(">", 1)
            path = right.strip().split()[0]
            content = left
            if "echo " in left:
                content = left.split("echo ", 1)[-1].strip().strip("'\"")
            s["files"][path] = content if "proxy_pass" in content else (content + "\nproxy_pass http://127.0.0.1:3000;")
            return "written (simulated)"
        if cmd.startswith("tee ") or "tee /etc/nginx" in cmd:
            path = "/etc/nginx/sites-enabled/docs"
            for token in cmd.split():
                if token.startswith("/etc/nginx"):
                    path = token
                    break
            s["files"][path] = "server { location / { proxy_pass http://127.0.0.1:3000; } }"
            return "written (simulated)"
        if "proxy_pass" in cmd:
            s["files"]["/etc/nginx/sites-enabled/docs"] = cmd
            return "written (simulated)"
        return f"simulated: {cmd}"

    def evaluate(self, session_id: str, rubric: list[dict[str, Any]]) -> dict[str, Any]:
        s = _store.get(session_id)
        hist = "\n".join(s["history"])
        checks = []
        for rule in rubric:
            cid = rule.get("check", "")
            args = rule.get("args") or {}
            ok = False
            detail = ""
            if cid == "port_listening":
                port = str(args.get("port"))
                ok = port in s["ports"]
                detail = f"port {port} -> {s['ports'].get(port)}"
            elif cid == "command_sequence":
                need = args.get("contains") or []
                ok = all(x in hist for x in need)
                detail = f"history has {need}: {ok}"
            elif cid == "file_contains":
                path = args.get("path", "")
                needle = args.get("needle", "")
                ok = needle in s["files"].get(path, "")
                detail = f"{path} contains {needle!r}: {ok}"
            checks.append({"id": cid, "ok": ok, "detail": detail})
        passed = all(c["ok"] for c in checks) if checks else False
        return {"pass": passed, "checks": checks, "artifacts": [], "score": sum(c["ok"] for c in checks) / max(len(checks), 1)}

    def export_evidence(self, session_id: str) -> list[dict[str, str]]:
        s = _store.get(session_id)
        return [{"name": "history.txt", "content": "\n".join(s["history"])}]

    def get_state_summary(self, session_id: str) -> str:
        s = _store.get(session_id)
        return f"server ports={s['ports']} last={s['history'][-3:]}"

    def reset(self, session_id: str) -> None:
        s = _store.get(session_id)
        s["history"] = []
        s["ports"] = {}
        _store.set(session_id, s)

    def destroy(self, session_id: str) -> None:
        _store.delete(session_id)

    def dump_state(self, session_id: str) -> dict[str, Any]:
        return _store.export(session_id)

    def load_state(self, session_id: str, state: dict[str, Any]) -> None:
        _store.put(session_id, state)


register("server", ServerAdapter)
