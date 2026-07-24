"""Author submissions detail/attachments/review."""

from __future__ import annotations

import httpx
import pytest

BASE = "http://127.0.0.1:8760"


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
