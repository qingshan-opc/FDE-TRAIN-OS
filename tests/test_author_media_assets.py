"""Author media_assets upload / soft-delete / ref conflict."""

from __future__ import annotations

import io

import httpx
import pytest

BASE = "http://127.0.0.1:8760"


@pytest.fixture(scope="module")
def client():
    with httpx.Client(base_url=BASE, timeout=60.0) as c:
        r = c.post(
            "/api/v1/auth/login",
            json={"email": "author@fde.local", "password": "author1234", "camp_id": "camp-v03"},
        )
        if r.status_code != 200:
            pytest.skip("API not running or author login failed")
        csrf = r.json().get("csrf") or c.cookies.get("fde_csrf")
        c.headers["X-CSRF-Token"] = csrf
        yield c


def test_media_list_paginated(client: httpx.Client):
    r = client.get("/api/v1/author/media-assets", params={"page": 1, "page_size": 5, "camp_id": "camp-v03"})
    assert r.status_code == 200
    body = r.json()
    assert {"items", "total", "page", "page_size"} <= set(body.keys())


def test_media_upload_dedupe_and_soft_delete(client: httpx.Client):
    payload = b"\x00\x00\x00\x18ftypmp42" + b"\x00" * 64  # tiny fake mp4 header-ish
    files = {"file": ("gap-test.mp4", io.BytesIO(payload), "video/mp4")}
    data = {"title": "gap-media-test", "kind": "video", "camp_id": "camp-v03"}
    r1 = client.post("/api/v1/author/media-assets", data=data, files=files)
    assert r1.status_code == 200, r1.text
    item = r1.json()
    mid = item["id"]
    key = item["object_key"]

    files2 = {"file": ("gap-test.mp4", io.BytesIO(payload), "video/mp4")}
    r2 = client.post("/api/v1/author/media-assets", data=data, files=files2)
    assert r2.status_code == 200, r2.text
    assert r2.json().get("deduped") is True or r2.json().get("id") == mid

    rd = client.delete(f"/api/v1/author/media-assets/{mid}")
    assert rd.status_code in (200, 409), rd.text
    if rd.status_code == 409:
        detail = rd.json().get("detail")
        assert detail is not None

    from services.author.media_library import find_media_refs

    refs = find_media_refs(key)
    assert isinstance(refs, list)
    assert find_media_refs("documents/__no_such_media_key__") == []
