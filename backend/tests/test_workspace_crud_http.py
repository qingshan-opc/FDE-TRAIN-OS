"""HTTP-level workspace CRUD / snapshot read tests (requires live API + MinIO)."""

from __future__ import annotations

import httpx
import pytest


@pytest.fixture
def client(api_base: str, require_api):
    return httpx.Client(base_url=api_base, timeout=300)


def _login(client: httpx.Client) -> tuple[dict[str, str], str]:
    r = client.post(
        "/api/v1/auth/login",
        json={"email": "demo@fde.local", "password": "demo1234", "camp_id": "camp-v03"},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    return {"X-CSRF-Token": body["csrf"]}, body["user"]["id"]


def _api_alive(client: httpx.Client) -> bool:
    try:
        return client.get("/livez", timeout=5).status_code == 200
    except Exception:
        return False


def test_workspace_cross_learner_forbidden(client: httpx.Client, require_api):
    h, _uid = _login(client)
    r = client.get("/api/v1/agent/workspaces/camp-v03/someone-else/files", headers=h)
    assert r.status_code == 403


def test_workspace_nested_crud_and_escape(
    client: httpx.Client, require_minio, unique_suffix: str,
):
    if not _api_alive(client):
        pytest.skip("API unavailable before CRUD integration test")

    h, uid = _login(client)
    camp = "camp-v03"
    base = f"/api/v1/agent/workspaces/{camp}/{uid}"
    root = f"pytest-{unique_suffix}"

    r = client.post(f"{base}/mkdir", headers=h, json={"path": f"{root}/src/lib"})
    assert r.status_code == 200, r.text
    snap1 = r.json()["snapshot_id"]

    r = client.put(
        f"{base}/files",
        headers=h,
        json={"path": f"{root}/src/lib/util.js", "content": "export const x=1;\n"},
    )
    assert r.status_code == 200, r.text
    snap2 = r.json()["snapshot_id"]
    assert snap2 != snap1

    if not _api_alive(client):
        pytest.skip("API restarted during MinIO snapshot — rerun when API is stable")

    r = client.post(
        f"{base}/rename",
        headers=h,
        json={"from_path": f"{root}/src/lib/util.js", "to_path": f"{root}/src/lib/helpers.js"},
    )
    assert r.status_code == 200, r.text

    r = client.get(f"{base}/file", headers=h, params={"path": f"{root}/src/lib/helpers.js"})
    assert r.status_code == 200
    assert r.json()["status"] == "ok"
    assert "export" in r.json()["content"]

    r = client.delete(f"{base}/files", headers=h, params={"path": f"{root}/src/lib/helpers.js"})
    assert r.status_code == 200, r.text

    r = client.put(f"{base}/files", headers=h, json={"path": "../escape.txt", "content": "nope"})
    assert r.status_code == 400

    r = client.get(f"{base}/files", headers=h)
    assert r.status_code == 200
    paths = {f["path"] for f in r.json()["files"]}
    assert f"{root}/src/lib" in paths or any(p.startswith(f"{root}/") for p in paths)
    for f in r.json()["files"]:
        assert "language" in f and "kind" in f

    snaps = client.get(f"{base}/snapshots", headers=h).json()
    assert snaps["head"]["version"] >= 2

    client.put(f"{base}/files", headers=h, json={"path": f"{root}/notes/a.md", "content": "# hello\n"})
    snaps2 = client.get(f"{base}/snapshots", headers=h).json()
    head_id = snaps2["head"]["snapshot_id"]
    rf = client.get(f"{base}/snapshots/{head_id}/file", headers=h, params={"path": f"{root}/notes/a.md"})
    assert rf.status_code == 200, rf.text
    assert rf.json()["status"] == "ok"
    assert "hello" in rf.json()["content"]
