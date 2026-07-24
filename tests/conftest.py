"""Pytest fixtures for FDE — unit by default; integration needs live PG/MinIO."""

from __future__ import annotations

import os
import uuid
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]


@pytest.fixture(scope="session")
def database_url() -> str:
    return os.getenv("DATABASE_URL", "")


@pytest.fixture(scope="session")
def require_postgres(database_url: str):
    if not database_url.startswith("postgres"):
        pytest.skip("DATABASE_URL postgresql required")
    try:
        import psycopg

        with psycopg.connect(database_url, connect_timeout=3) as conn:
            conn.execute("SELECT 1")
    except Exception as exc:
        pytest.skip(f"postgres unavailable: {exc}")


@pytest.fixture(scope="session")
def require_minio():
    endpoint = os.getenv("S3_ENDPOINT", "http://127.0.0.1:9000")
    try:
        import boto3
        from botocore.client import Config

        client = boto3.client(
            "s3",
            endpoint_url=endpoint,
            aws_access_key_id=os.getenv("S3_ACCESS_KEY", "fdeadmin"),
            aws_secret_access_key=os.getenv("S3_SECRET_KEY", "fdeadmin123"),
            region_name=os.getenv("S3_REGION", "us-east-1"),
            config=Config(signature_version="s3v4", s3={"addressing_style": "path"}),
        )
        client.list_buckets()
    except Exception as exc:
        pytest.skip(f"minio unavailable: {exc}")


@pytest.fixture
def unique_suffix() -> str:
    return uuid.uuid4().hex[:10]


@pytest.fixture(scope="session")
def api_base() -> str:
    return os.getenv("FDE_INTERNAL_BASE", "http://127.0.0.1:8760").rstrip("/")


@pytest.fixture(scope="session")
def require_api(api_base: str):
    try:
        import httpx

        r = httpx.get(f"{api_base}/livez", timeout=3.0)
        if r.status_code >= 400:
            pytest.skip(f"api unhealthy: {r.status_code}")
    except Exception as exc:
        pytest.skip(f"api unavailable: {exc}")
