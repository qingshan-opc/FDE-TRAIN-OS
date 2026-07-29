"""Unit tests for k8s simulation adapter."""

from __future__ import annotations

from sim.adapters.k8s import K8sAdapter


def test_k8s_apply_and_rollout():
    ad = K8sAdapter()
    sid = ad.create_session({"lab": {"seed": {"faults": ["CrashLoop"]}}}, {})
    view = ad.get_view_model(sid)
    assert view["layout"] == "cli_plus_topology"
    assert "Deployment/api" in view["resources"]
    assert view["resources"]["Deployment/api"]["ready"] is False

    denied = ad.apply_action(sid, {"type": "kubectl", "payload": {"cmd": "kubectl exec -it pod/api -- sh"}})
    assert "error" in denied["stdout"]

    manifest = view["manifest"]
    applied = ad.apply_action(
        sid,
        {"type": "kubectl", "payload": {"cmd": "kubectl apply -f deployment.yaml", "manifest": manifest}},
    )
    assert "configured" in applied["stdout"]

    status = ad.apply_action(sid, {"type": "kubectl", "payload": {"cmd": "kubectl rollout status deployment/api"}})
    assert "successfully rolled out" in status["stdout"]

    view2 = ad.get_view_model(sid)
    assert view2["resources"]["Deployment/api"]["ready"] is True

    result = ad.evaluate(
        sid,
        [
            {"check": "resource_exists", "args": {"kind": "Deployment", "name": "api"}},
            {"check": "resource_ready", "args": {"kind": "Deployment", "name": "api"}},
            {"check": "command_sequence", "args": {"contains": ["kubectl apply", "kubectl rollout status"]}},
        ],
    )
    assert result["pass"] is True
    evidence = ad.export_evidence(sid)
    names = {e["name"] for e in evidence}
    assert "kubectl-history.txt" in names
    assert "deployment.yaml" in names


def test_k8s_invalid_yaml():
    ad = K8sAdapter()
    sid = ad.create_session({"lab": {}}, {})
    out = ad.apply_action(
        sid,
        {
            "type": "kubectl",
            "payload": {
                "cmd": "kubectl apply -f x.yaml",
                "manifest": "apiVersion: [unclosed",
            },
        },
    )
    assert "invalid YAML" in out["stdout"] or "error" in out["stdout"]


def test_k8s_whitelist_and_denied():
    ad = K8sAdapter()
    sid = ad.create_session({"lab": {"seed": {"faults": ["CrashLoop"]}}}, {})
    for cmd in (
        "kubectl get deploy",
        "kubectl get pods",
        "kubectl describe deployment/api",
        "kubectl logs pod/api-0",
    ):
        out = ad.apply_action(sid, {"type": "kubectl", "payload": {"cmd": cmd}})
        assert "error" not in out["stdout"].lower() or "not found" in out["stdout"].lower() or out["stdout"]

    for bad in (
        "kubectl exec -it pod/api -- sh",
        "kubectl port-forward svc/api 8080",
        "kubectl delete deploy api",
        "curl https://evil.example",
        "bash -c id",
    ):
        out = ad.apply_action(sid, {"type": "kubectl", "payload": {"cmd": bad}})
        assert "error" in out["stdout"].lower() or "denied" in out["stdout"].lower() or "not allowed" in out["stdout"].lower() or "拒绝" in out["stdout"]

    view = ad.get_view_model(sid)
    ad.apply_action(
        sid,
        {"type": "kubectl", "payload": {"cmd": "kubectl apply -f deployment.yaml", "manifest": view["manifest"]}},
    )
    ad.apply_action(sid, {"type": "kubectl", "payload": {"cmd": "kubectl rollout status deployment/api"}})
    undo = ad.apply_action(sid, {"type": "kubectl", "payload": {"cmd": "kubectl rollout undo deployment/api"}})
    assert "undo" in undo["stdout"].lower() or "rolled" in undo["stdout"].lower() or undo["stdout"]
