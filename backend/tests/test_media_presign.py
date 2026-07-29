"""Media presign API — auth, prefix, camp binding."""

from __future__ import annotations

import httpx
import pytest


@pytest.fixture
def client(api_base: str, require_api):
    with httpx.Client(base_url=api_base, timeout=30.0) as c:
        yield c


def _login(client: httpx.Client, email: str, password: str) -> httpx.Client:
    r = client.post("/api/v1/auth/login", json={"email": email, "password": password, "camp_id": "camp-v03"})
    assert r.status_code == 200, r.text
    return client


def test_media_presign_unauthenticated_401(client: httpx.Client):
    r = client.get(
        "/api/v1/media/presign",
        params={"object_key": "documents/camp-v03/course-media/day01-c1-intro.mp3"},
    )
    assert r.status_code in (401, 403)


def test_media_presign_bad_prefix_403(client: httpx.Client):
    _login(client, "demo@fde.local", "demo1234")
    r = client.get(
        "/api/v1/media/presign",
        params={"object_key": "workspaces/camp-v03/secret.bin", "camp_id": "camp-v03"},
    )
    assert r.status_code == 403


def test_media_presign_cross_camp_403(client: httpx.Client):
    _login(client, "demo@fde.local", "demo1234")
    r = client.get(
        "/api/v1/media/presign",
        params={"object_key": "documents/other-camp/course-media/x.mp3", "camp_id": "camp-v03"},
    )
    assert r.status_code == 403


def test_media_presign_ok(client: httpx.Client, require_minio):
    from services.shared import S3_BUCKET_DOCUMENTS
    from services.storage import get_store

    key = "documents/camp-v03/course-media/pytest-presign-smoke.bin"
    store = get_store()
    store.ensure_buckets()
    store.put_bytes(S3_BUCKET_DOCUMENTS, key, b"smoke-bytes", content_type="application/octet-stream")

    _login(client, "demo@fde.local", "demo1234")
    r = client.get("/api/v1/media/presign", params={"object_key": key, "camp_id": "camp-v03"})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["object_key"] == key
    assert body["expires_in"] == 300
    # Same-origin stream URL (avoids MinIO CORS / SignatureDoesNotMatch on HEAD).
    assert body["url"].startswith("/api/v1/media/stream?")
    assert key in body["url"] or "object_key=" in body["url"]

    streamed = client.get(body["url"])
    assert streamed.status_code == 200, streamed.text
    assert streamed.content == b"smoke-bytes"

    ranged = client.get(body["url"], headers={"Range": "bytes=0-4"})
    assert ranged.status_code == 206, ranged.text
    assert ranged.content == b"smoke"
    assert ranged.headers.get("content-range", "").startswith("bytes 0-4/")
