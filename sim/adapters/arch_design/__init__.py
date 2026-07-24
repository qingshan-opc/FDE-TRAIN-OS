"""arch_design adapter skeleton — constraint canvas graph."""

from __future__ import annotations

from typing import Any

from sim.protocol import ActionEnvelope, SimAdapter
from sim.registry import register
from sim.store import MemorySessionStore

_store = MemorySessionStore()


class ArchDesignAdapter(SimAdapter):
    kind = "arch_design"
    adapter_version = "1.0"

    def create_session(self, task_spec: dict[str, Any], learner_seed: dict[str, Any]) -> str:
        lab = task_spec.get("lab") or task_spec
        seed = {**(lab.get("seed") or {}), **learner_seed}
        return _store.create(
            {
                "kind": self.kind,
                "nodes": [],
                "edges": [],
                "nfr": {},
                "decision_note": "",
                "constraints": seed.get("constraints") or {},
                "seed": seed,
            }
        )

    def get_view_model(self, session_id: str) -> dict[str, Any]:
        s = _store.get(session_id)
        return {
            "layout": "constraint_canvas",
            "nodes": s["nodes"],
            "edges": s["edges"],
            "constraints": s["constraints"],
        }

    def apply_action(self, session_id: str, action: ActionEnvelope) -> dict[str, Any]:
        s = _store.get(session_id)
        t = action.get("type")
        p = action.get("payload") or {}
        if t == "canvas.add_node":
            s["nodes"].append({"id": p["id"], "type": p.get("type", "service")})
        elif t == "canvas.link":
            s["edges"].append({"from": p["from"], "to": p["to"]})
        elif t == "canvas.set_nfr":
            s["nfr"].update(p)
        elif t == "canvas.set_decision_note":
            s["decision_note"] = p.get("text", "")
        _store.set(session_id, s)
        return {"state": s, "events": [t], "hints": []}

    def evaluate(self, session_id: str, rubric: list[dict[str, Any]]) -> dict[str, Any]:
        s = _store.get(session_id)
        cons = s.get("constraints") or {}
        nfr = s.get("nfr") or {}
        checks = []
        for rule in rubric:
            cid = rule.get("check", "")
            args = rule.get("args") or {}
            ok = False
            detail = ""
            if cid == "constraints_satisfied":
                cost_ok = float(nfr.get("monthly_cost_usd", 1e9)) <= float(cons.get("max_monthly_cost_usd", 1e9))
                lat_ok = float(nfr.get("p95_latency_ms", 1e9)) <= float(cons.get("p95_latency_ms", 1e9))
                res_ok = nfr.get("data_residency", cons.get("data_residency")) == cons.get("data_residency")
                ok = cost_ok and lat_ok and res_ok
                detail = f"cost={cost_ok} latency={lat_ok} residency={res_ok}"
            elif cid == "decision_note_min_chars":
                ok = len(s.get("decision_note") or "") >= int(args.get("min", 0))
                detail = f"note_len={len(s.get('decision_note') or '')}"
            elif cid == "required_components":
                ids = {n["id"] for n in s["nodes"]}
                need = set(args.get("includes") or [])
                ok = need.issubset(ids)
                detail = f"missing={sorted(need - ids)}"
            checks.append({"id": cid, "ok": ok, "detail": detail})
        passed = all(c["ok"] for c in checks) if checks else False
        return {"pass": passed, "checks": checks, "artifacts": [], "score": sum(c["ok"] for c in checks) / max(len(checks), 1)}

    def export_evidence(self, session_id: str) -> list[dict[str, str]]:
        s = _store.get(session_id)
        return [{"name": "decision.md", "content": s.get("decision_note") or ""}]

    def get_state_summary(self, session_id: str) -> str:
        s = _store.get(session_id)
        return f"arch nodes={[n['id'] for n in s['nodes']]} nfr={s['nfr']}"

    def reset(self, session_id: str) -> None:
        s = _store.get(session_id)
        s["nodes"], s["edges"], s["nfr"], s["decision_note"] = [], [], {}, ""
        _store.set(session_id, s)

    def destroy(self, session_id: str) -> None:
        _store.delete(session_id)

    def dump_state(self, session_id: str) -> dict[str, Any]:
        return _store.export(session_id)

    def load_state(self, session_id: str, state: dict[str, Any]) -> None:
        _store.put(session_id, state)


register("arch_design", ArchDesignAdapter)
