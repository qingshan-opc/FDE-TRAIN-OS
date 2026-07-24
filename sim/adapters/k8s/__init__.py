"""k8s adapter — object graph + kubectl-like whitelist commands (simulated)."""

from __future__ import annotations

import re
from typing import Any

import yaml

from sim.protocol import ActionEnvelope, SimAdapter
from sim.registry import register
from sim.store import MemorySessionStore

_store = MemorySessionStore()

DEFAULT_MANIFEST = """apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
  labels:
    app: api
spec:
  replicas: 2
  selector:
    matchLabels:
      app: api
  template:
    metadata:
      labels:
        app: api
    spec:
      containers:
        - name: api
          image: fde/api:1.0.0
          ports:
            - containerPort: 8080
          readinessProbe:
            httpGet:
              path: /healthz
              port: 8080
"""

ALLOWED_PREFIXES = (
    "kubectl get",
    "kubectl describe",
    "kubectl logs",
    "kubectl apply",
    "kubectl rollout status",
    "kubectl rollout undo",
)

DENIED = ("exec", "port-forward", "proxy", "delete", "edit", "attach", "cp ", "run ")


class K8sAdapter(SimAdapter):
    kind = "k8s"
    adapter_version = "1.1"

    def create_session(self, task_spec: dict[str, Any], learner_seed: dict[str, Any]) -> str:
        lab = task_spec.get("lab") or task_spec
        seed = {**(lab.get("seed") or {}), **learner_seed}
        fault = (seed.get("faults") or [None])[0]
        resources = {
            "Deployment/api": {
                "kind": "Deployment",
                "name": "api",
                "ready": False,
                "replicas": 1,
                "desired": 2,
                "fault": fault,
                "image": "fde/api:0.9.0",
            },
            "Pod/api-0": {
                "kind": "Pod",
                "name": "api-0",
                "ready": False,
                "phase": "CrashLoopBackOff" if fault == "CrashLoop" else "Pending",
                "fault": fault,
            },
            "Service/api": {
                "kind": "Service",
                "name": "api",
                "ready": True,
                "replicas": 1,
                "fault": None,
            },
        }
        manifest = seed.get("starter_manifest") or DEFAULT_MANIFEST
        return _store.create(
            {
                "kind": self.kind,
                "resources": resources,
                "relations": [
                    {"from": "Service/api", "to": "Deployment/api", "type": "selects"},
                    {"from": "Deployment/api", "to": "Pod/api-0", "type": "owns"},
                ],
                "history": [],
                "events": ["Created fixture cluster (simulation — not a real cluster)"],
                "seed": seed,
                "manifest": manifest,
                "hints": [
                    "编辑左侧 YAML 后执行 kubectl apply -f deployment.yaml",
                    "再用 kubectl rollout status deployment/api 等待就绪",
                ],
            }
        )

    def get_view_model(self, session_id: str) -> dict[str, Any]:
        s = _store.get(session_id)
        return {
            "layout": "cli_plus_topology",
            "sim_label": "仿真集群",
            "resources": s["resources"],
            "relations": s.get("relations") or [],
            "events": s["events"][-20:],
            "command_history": s.get("history") or [],
            "manifest": s.get("manifest") or DEFAULT_MANIFEST,
            "hints": s.get("hints") or [],
        }

    def apply_action(self, session_id: str, action: ActionEnvelope) -> dict[str, Any]:
        s = _store.get(session_id)
        atype = action.get("type")
        payload = action.get("payload") or {}

        if atype == "manifest.set":
            text = str(payload.get("text") or "")
            s["manifest"] = text
            _store.set(session_id, s)
            return {"state": {"manifest": text}, "events": [], "stdout": "manifest updated", "hints": []}

        if atype != "kubectl":
            return {"state": {}, "events": [], "hints": ["use type=kubectl"], "stdout": "unsupported action"}

        cmd = str(payload.get("cmd") or "").strip()
        out = self._kubectl(cmd, s, payload)
        _store.set(session_id, s)
        return {
            "state": {"resources": s["resources"]},
            "events": s["events"][-5:],
            "stdout": out,
            "hints": s.get("hints") or [],
        }

    def _denied(self, cmd: str) -> str | None:
        low = cmd.lower()
        if not low.startswith("kubectl "):
            return "only kubectl commands are allowed in this simulation"
        for d in DENIED:
            if d in low:
                return f"command blocked by safety guard: {d.strip()}"
        if not any(low.startswith(p) for p in ALLOWED_PREFIXES):
            return "command not in whitelist (get/describe/logs/apply/rollout)"
        if "http://" in low or "https://" in low:
            return "external URLs are not allowed"
        return None

    def _kubectl(self, cmd: str, s: dict[str, Any], payload: dict[str, Any]) -> str:
        deny = self._denied(cmd)
        if deny:
            s["events"].append(f"Denied: {cmd}")
            return f"error: {deny}"

        s["history"].append(cmd)
        low = cmd.lower()

        if "apply" in low:
            text = str(payload.get("manifest") or s.get("manifest") or "")
            try:
                docs = list(yaml.safe_load_all(text)) if text.strip() else []
            except Exception as exc:
                s["events"].append(f"apply failed: {exc}")
                return f"error: invalid YAML: {exc}"
            applied = []
            for doc in docs:
                if not isinstance(doc, dict):
                    continue
                kind = str(doc.get("kind") or "Deployment")
                name = str((doc.get("metadata") or {}).get("name") or "api")
                key = f"{kind}/{name}"
                replicas = int((doc.get("spec") or {}).get("replicas") or 2)
                image = "fde/api:1.0.0"
                try:
                    image = (
                        ((doc.get("spec") or {}).get("template") or {})
                        .get("spec", {})
                        .get("containers", [{}])[0]
                        .get("image")
                        or image
                    )
                except Exception:
                    pass
                s["resources"][key] = {
                    "kind": kind,
                    "name": name,
                    "ready": False,
                    "replicas": replicas,
                    "desired": replicas,
                    "fault": None,
                    "image": image,
                }
                if kind == "Deployment":
                    s["resources"]["Pod/api-0"] = {
                        "kind": "Pod",
                        "name": "api-0",
                        "ready": False,
                        "phase": "ContainerCreating",
                        "fault": None,
                    }
                applied.append(key)
                s["events"].append(f"Applied {key}")
            s["manifest"] = text or s.get("manifest")
            return "\n".join(f"{k} configured" for k in applied) or "nothing applied"

        if "rollout status" in low:
            dep = s["resources"].get("Deployment/api")
            if dep and not dep.get("fault"):
                dep["ready"] = True
                pod = s["resources"].get("Pod/api-0")
                if pod:
                    pod["ready"] = True
                    pod["phase"] = "Running"
                    pod["fault"] = None
                s["events"].append("Deployment/api available")
                return 'deployment "api" successfully rolled out'
            return "error: timed out waiting for the condition"

        if "rollout undo" in low:
            dep = s["resources"].get("Deployment/api")
            if dep:
                dep["ready"] = False
                dep["image"] = "fde/api:0.9.0"
                s["events"].append("Rollback Deployment/api")
            return 'deployment.apps/api rolled back'

        if low.startswith("kubectl describe"):
            m = re.search(r"(deployment|pod|service)/?([\w-]+)?", low)
            kind = (m.group(1) if m else "deployment").title().replace("Deployment", "Deployment")
            if kind.lower() == "deployment":
                kind = "Deployment"
            elif kind.lower() == "pod":
                kind = "Pod"
            elif kind.lower() == "service":
                kind = "Service"
            name = m.group(2) if m and m.group(2) else "api"
            key = f"{kind}/{name}"
            res = s["resources"].get(key)
            if not res:
                return f"Error from server (NotFound): {key} not found"
            lines = [
                f"Name:         {name}",
                f"Kind:         {kind}",
                f"Ready:        {res.get('ready')}",
                f"Replicas:     {res.get('replicas')}",
                f"Image:        {res.get('image', 'n/a')}",
                f"Fault:        {res.get('fault') or 'none'}",
                f"Phase:        {res.get('phase', 'n/a')}",
            ]
            return "\n".join(lines)

        if low.startswith("kubectl logs"):
            pod = s["resources"].get("Pod/api-0") or {}
            if pod.get("fault") == "CrashLoop":
                return "panic: readiness probe failed\ncontainer restarting..."
            return "listening on :8080\nGET /healthz 200"

        if "get deploy" in low or "get deployment" in low or re.search(r"get\s+deploy", low):
            dep = s["resources"].get("Deployment/api")
            return str(dep) if dep else "No resources found"

        if "get pod" in low or "get pods" in low:
            pod = s["resources"].get("Pod/api-0")
            return str(pod) if pod else "No resources found"

        if "get svc" in low or "get service" in low:
            svc = s["resources"].get("Service/api")
            return str(svc) if svc else "No resources found"

        if low.startswith("kubectl get"):
            return "\n".join(f"{k}\tready={v.get('ready')}" for k, v in s["resources"].items())

        return f"simulated kubectl: {cmd}"

    def evaluate(self, session_id: str, rubric: list[dict[str, Any]]) -> dict[str, Any]:
        s = _store.get(session_id)
        hist = "\n".join(s["history"])
        checks = []
        for rule in rubric:
            cid = rule.get("check", "")
            args = rule.get("args") or {}
            ok = False
            detail = ""
            key = f"{args.get('kind')}/{args.get('name')}"
            if cid == "resource_exists":
                ok = key in s["resources"]
                detail = f"{key} exists={ok}"
            elif cid == "resource_ready":
                ok = bool(s["resources"].get(key, {}).get("ready"))
                detail = f"{key} ready={ok}"
            elif cid == "command_sequence":
                need = args.get("contains") or []
                ok = all(x in hist for x in need)
                detail = f"history {need}: {ok}"
            checks.append({"id": cid, "ok": ok, "detail": detail})
        passed = all(c["ok"] for c in checks) if checks else False
        return {
            "pass": passed,
            "checks": checks,
            "artifacts": self.export_evidence(session_id),
            "score": sum(c["ok"] for c in checks) / max(len(checks), 1),
        }

    def export_evidence(self, session_id: str) -> list[dict[str, str]]:
        s = _store.get(session_id)
        return [
            {"name": "kubectl-history.txt", "content": "\n".join(s["history"])},
            {"name": "deployment.yaml", "content": str(s.get("manifest") or "")},
        ]

    def get_state_summary(self, session_id: str) -> str:
        s = _store.get(session_id)
        return f"k8s resources={s['resources']} history_tail={s['history'][-3:]}"

    def reset(self, session_id: str) -> None:
        s = _store.get(session_id)
        seed = s.get("seed") or {}
        fault = (seed.get("faults") or [None])[0]
        s["resources"] = {
            "Deployment/api": {
                "kind": "Deployment",
                "name": "api",
                "ready": False,
                "replicas": 1,
                "desired": 2,
                "fault": fault,
                "image": "fde/api:0.9.0",
            },
            "Pod/api-0": {
                "kind": "Pod",
                "name": "api-0",
                "ready": False,
                "phase": "CrashLoopBackOff" if fault == "CrashLoop" else "Pending",
                "fault": fault,
            },
            "Service/api": {
                "kind": "Service",
                "name": "api",
                "ready": True,
                "replicas": 1,
                "fault": None,
            },
        }
        s["history"] = []
        s["events"] = ["reset (simulation)"]
        s["manifest"] = seed.get("starter_manifest") or DEFAULT_MANIFEST
        _store.set(session_id, s)

    def destroy(self, session_id: str) -> None:
        _store.delete(session_id)

    def dump_state(self, session_id: str) -> dict[str, Any]:
        return _store.export(session_id)

    def load_state(self, session_id: str, state: dict[str, Any]) -> None:
        _store.put(session_id, state)


register("k8s", K8sAdapter)
