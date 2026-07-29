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
                # FDE Day5 终端实验台：周报助手工作目录（fake fs for shell basics）
                "fs": {
                    "/home/trainee": ["deploy.sh", "notes.txt", "app/"],
                    "/home/trainee/app": ["server.py", "logs/"],
                    "/home/trainee/app/logs": ["server.log"],
                },
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
            # 真实终端语义：tail -f 跟踪中敲别的命令 = 先 Ctrl+C 退出跟踪
            if s.get("tailing") and not cmd.strip().startswith("tail"):
                out = "^C（已退出实时跟踪）\n" + out if out else "^C（已退出实时跟踪）"
                s["tailing"] = False
            _store.set(session_id, s)
            return {"state": {"ports": s["ports"], "cwd": s["cwd"]}, "events": ["exec"], "hints": [], "stdout": out}
        return {"state": {}, "events": [], "hints": ["unsupported action"]}

    # ---- FDE Day5：命令行八句语义（pwd/ls/mkdir/cd/curl/tail/chmod/docker ps + 启动服务） ----
    _LOG_LINES = (
        "2026-07-26 09:00:01 INFO  server started on :8000\n"
        "2026-07-26 09:00:02 INFO  connected to database\n"
        "2026-07-26 09:01:13 INFO  GET /healthz 200 2ms\n"
        "2026-07-26 09:02:47 WARN  slow query 312ms"
    )

    def _simulate_shell(self, cmd: str, s: dict[str, Any]) -> str | None:
        c = cmd.strip()
        fs = s.setdefault("fs", {"/home/trainee": []})
        cwd = s.get("cwd", "/home/trainee")
        if c == "pwd":
            return cwd
        if c in ("ls", "ls -l", "ls -la", "ls -a"):
            items = fs.get(cwd, [])
            if c == "ls":
                return "   ".join(items) or ""
            executable = set(s.get("exec") or [])
            rows = []
            for f in items:
                is_dir = f.endswith("/")
                if is_dir:
                    perm, size = "drwxr-xr-x", "128"
                else:
                    perm = "-rwxr-xr-x" if f in executable else "-rw-r--r--"
                    size = "2.1K" if f == "deploy.sh" else ("4.0K" if f == "server.py" else "846")
                rows.append(f"{perm}  1 trainee staff  {size}  7月26日  {f}")
            return "\n".join(rows)
        if c.startswith("mkdir"):
            parts = c.split()
            path = parts[-1].strip("/")
            if "-p" not in parts and "/" in path:
                parent = path.rsplit("/", 1)[0]
                if f"{parent}/" not in fs.get(cwd, []) and path != "app/logs":
                    return f"mkdir: cannot create directory ‘{path}’: No such file or directory"
            full = f"{cwd}/{path}"
            parent_full, leaf = full.rsplit("/", 1)
            fs.setdefault(parent_full, [])
            fs.setdefault(full, [])
            if leaf + "/" in fs[parent_full]:
                return ""  # 已存在：真实 mkdir -p 静默成功
            fs[parent_full].append(leaf + "/")
            return ""  # 真实 mkdir -p 成功无输出
        if c.startswith("cd"):
            target = c[2:].strip() or "/home/trainee"
            if target == "..":
                s["cwd"] = cwd.rsplit("/", 1)[0] or "/home/trainee"
                return ""
            full = target if target.startswith("/") else f"{cwd}/{target.strip('/')}"
            if full in fs:
                s["cwd"] = full
                return ""
            return f"bash: cd: {target}: No such file or directory"
        if c.startswith("curl"):
            if "8000" in c and s["ports"].get("8000"):
                return '{"status":"ok","uptime":"2m 41s"}  # 200 —— 服务活着'
            if "8000" in c:
                return "curl: (7) Failed to connect to localhost port 8000: Connection refused —— 服务没起，先启动它"
            return "curl: (6) Could not resolve host —— 仿真里只认识 localhost:8000"
        if c.startswith("tail"):
            if "server.log" not in c:
                return f"tail: cannot open '{c.split()[-1]}' for reading: No such file or directory"
            out = self._LOG_LINES
            if "-f" in c:
                s["tailing"] = True
                out += "\n……（实时跟踪中——按 Ctrl+C 或直接敲下一条命令退出，它不是卡死，是在「跟着看」）"
            return out
        if c.startswith("chmod"):
            if "+x" in c and "deploy.sh" in c:
                s.setdefault("exec", [])
                if "deploy.sh" not in s["exec"]:
                    s["exec"].append("deploy.sh")
                return ""  # 真实 chmod 成功无输出；再 ls -l 看权限位变化
            return ""
        if c == "docker ps":
            rows = ["CONTAINER ID   IMAGE          STATUS         NAMES"]
            if s["ports"].get("8000"):
                rows.append("a1b2c3d4e5f6   weekbot:0.4    Up 2 minutes   weekbot-app")
                rows.append("f6e5d4c3b2a1   postgres:16    Up 2 minutes   weekbot-db")
            else:
                rows.append("f6e5d4c3b2a1   postgres:16    Up 3 days      weekbot-db")
            return "\n".join(rows)
        if c == "whoami":
            return "trainee"
        if c in ("python3 server.py", "python server.py", "./deploy.sh", "bash deploy.sh", "systemctl start weekbot"):
            if cwd.endswith("app") or "deploy.sh" in c or "weekbot" in c:
                s["ports"]["8000"] = "weekbot"
                return "weekbot started on :8000 (simulated) —— 服务起来了，用 curl 敲它的门验证"
            return "python3: can't open file 'server.py': No such file or directory —— 先 cd app"
        if c == "clear":
            return "\n" * 3
        return None

    def _simulate(self, cmd: str, s: dict[str, Any]) -> str:
        shell = self._simulate_shell(cmd, s)
        if shell is not None:
            return shell
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
