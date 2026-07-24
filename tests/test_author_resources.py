"""Author resources packs pagination smoke."""

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


def test_resource_packs_paginated(client: httpx.Client):
    r = client.get("/api/v1/author/resource-packs", params={"page": 1, "page_size": 5, "camp_id": "camp-v03"})
    assert r.status_code == 200, r.text
    body = r.json()
    assert "items" in body and "total" in body
