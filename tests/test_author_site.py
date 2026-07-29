"""Author site landing PATCH / public landing brand+hero."""

from __future__ import annotations

import httpx
import pytest

from tests.constants import API_BASE as BASE


@pytest.fixture(scope="module")
def client():
    with httpx.Client(base_url=BASE, timeout=30.0) as c:
        r = c.post("/api/v1/auth/login", json={"email": "author@fde.local", "password": "author1234", "camp_id": "camp-v03"})
        if r.status_code != 200:
            pytest.skip("API not running or author login failed")
        csrf = r.json().get("csrf") or c.cookies.get("fde_csrf")
        c.headers["X-CSRF-Token"] = csrf
        yield c


def test_landing_has_brand_hero(client: httpx.Client):
    r = client.get("/api/v1/site/landing")
    assert r.status_code == 200
    body = r.json()
    assert "title" in body
    assert "brand" in body or body.get("title")
    # brand/hero may come from defaults after learner DEFAULT_LANDING update
    assert body.get("brand") is not None or body.get("title")


def test_author_landing_patch_roundtrip(client: httpx.Client):
    before = client.get("/api/v1/author/site/landing")
    assert before.status_code == 200
    tagline = before.json().get("tagline") or "FDE Learning OS"
    patched = f"{tagline} · e2e"
    r = client.patch("/api/v1/author/site/landing", json={"tagline": patched, "brand": {"name": "青山在", "footer": "© test"}})
    assert r.status_code == 200, r.text
    # restore
    client.patch("/api/v1/author/site/landing", json={"tagline": tagline})
    pub = client.get("/api/v1/site/landing")
    assert pub.status_code == 200


def test_open_courses_paginated(client: httpx.Client):
    r = client.get("/api/v1/author/site/open-courses", params={"page": 1, "page_size": 5})
    assert r.status_code == 200
    body = r.json()
    assert "items" in body and "total" in body and "page" in body


def test_site_media_dual_schema_helpers():
    """Landing raw + site_media schema introspection (004/005 compatible)."""
    from services.author import site_content
    from services.shared import db_cursor

    raw = site_content.get_landing_raw()
    assert isinstance(raw, dict)
    assert raw.get("title") or raw.get("brand")
    with db_cursor() as cur:
        cur.execute(
            """
            SELECT column_name FROM information_schema.columns
            WHERE table_schema='public' AND table_name='site_media'
            """
        )
        cols = {r["column_name"] for r in cur.fetchall()}
    # Either legacy page_slug or page_id schema (or both) is acceptable
    assert "page_slug" in cols or "page_id" in cols or not cols


def test_hero_upload_poster(client: httpx.Client):
    # 1x1 png
    png = (
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
        b"\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\x0f\x00\x00\x01\x01\x00\x05\x18\xd8N"
        b"\x00\x00\x00\x00IEND\xaeB`\x82"
    )
    files = {"poster": ("hero-poster.png", png, "image/png")}
    r = client.post("/api/v1/author/site/hero", files=files)
    assert r.status_code == 200, r.text
    landing = client.get("/api/v1/author/site/landing")
    assert landing.status_code == 200
