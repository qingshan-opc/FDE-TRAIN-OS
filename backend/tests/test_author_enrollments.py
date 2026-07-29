"""Author enrollments + submissions API smoke."""

from __future__ import annotations

import httpx
import pytest

from tests.constants import API_BASE as BASE


@pytest.fixture(scope="module")
def client():
    with httpx.Client(base_url=BASE, timeout=30.0) as c:
        r = c.post(
            "/api/v1/auth/login",
            json={"email": "author@fde.local", "password": "author1234", "camp_id": "camp-v03"},
        )
        if r.status_code != 200:
            pytest.skip("API not running")
        csrf = r.json().get("csrf") or c.cookies.get("fde_csrf")
        c.headers["X-CSRF-Token"] = csrf
        yield c


def test_enrollments_list(client: httpx.Client):
    r = client.get("/api/v1/author/enrollments", params={"page": 1, "page_size": 5, "camp_id": "camp-v03"})
    assert r.status_code == 200
    body = r.json()
    assert "items" in body and "total" in body
    assert body["total"] >= 1
    eid = body["items"][0]["id"]
    d = client.get(f"/api/v1/author/enrollments/{eid}")
    assert d.status_code == 200


def test_enrollments_duplicate_409(client: httpx.Client):
    items = client.get("/api/v1/author/enrollments", params={"page": 1, "page_size": 1}).json()["items"]
    row = items[0]
    r = client.post(
        "/api/v1/author/enrollments",
        json={"user_id": row["user_id"], "offering_id": row["offering_id"]},
    )
    assert r.status_code == 409, r.text


def test_enrollments_patch_status(client: httpx.Client):
    items = client.get("/api/v1/author/enrollments", params={"page": 1, "page_size": 1}).json()["items"]
    eid = items[0]["id"]
    status = items[0].get("status") or "active"
    target = "dropped" if status == "active" else "active"
    r = client.patch(f"/api/v1/author/enrollments/{eid}", json={"status": target})
    assert r.status_code == 200, r.text
    # restore
    client.patch(f"/api/v1/author/enrollments/{eid}", json={"status": status})


def test_submissions_detail_attachments_review(client: httpx.Client):
    items = client.get("/api/v1/author/submissions", params={"page": 1, "page_size": 1}).json()["items"]
    assert items
    sid = items[0]["id"]
    d = client.get(f"/api/v1/author/submissions/{sid}")
    assert d.status_code == 200
    a = client.get(f"/api/v1/author/submissions/{sid}/attachments")
    assert a.status_code == 200
    assert "items" in a.json()
    rev = client.post(
        f"/api/v1/author/submissions/{sid}/review",
        json={"score": 88, "feedback": "gap-test review", "status": "resolved"},
    )
    assert rev.status_code == 200, rev.text
