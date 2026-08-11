#!/usr/bin/env python3
"""Persist day curriculum packages to MinIO as durable backup.

Uploads:
  documents/shared/curriculum/{version_tag}/day-NN-curriculum.json

Also can restore DB day_packages from those objects when --restore is set.

Usage:
  PYTHONPATH=backend .venv/bin/python scripts/persist_curriculum_to_minio.py --version-tag v0.7
  PYTHONPATH=backend .venv/bin/python scripts/persist_curriculum_to_minio.py --version-tag v0.7 --from-bootcamp
  PYTHONPATH=backend .venv/bin/python scripts/persist_curriculum_to_minio.py --version-tag v0.7 --restore
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "backend"))

from services.author.bootcamp_sync import build_day_package, list_available_days  # noqa: E402
from services.shared.config import CURRICULUM_VERSION_TAG, S3_BUCKET_DOCUMENTS  # noqa: E402
from services.shared.db import db_cursor  # noqa: E402
from services.storage import get_store  # noqa: E402


def _key(version_tag: str, day: int) -> str:
    return f"documents/shared/curriculum/{version_tag}/day-{day:02d}-curriculum.json"


def _upload_pkg(store, version_tag: str, day: int, pkg: dict) -> str:
    key = _key(version_tag, day)
    body = json.dumps(pkg, ensure_ascii=False, indent=2).encode("utf-8")
    store.put_bytes(S3_BUCKET_DOCUMENTS, key, body, content_type="application/json")
    return key


def _load_pkg(store, version_tag: str, day: int) -> dict | None:
    key = _key(version_tag, day)
    client = store._client
    try:
        obj = client.get_object(Bucket=S3_BUCKET_DOCUMENTS, Key=key)
    except Exception:
        return None
    raw = obj["Body"].read()
    return json.loads(raw.decode("utf-8"))


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--version-tag", default=CURRICULUM_VERSION_TAG)
    ap.add_argument("--days", default="", help="comma days; default all available")
    ap.add_argument(
        "--from-bootcamp",
        action="store_true",
        help="build packages from class/bootcamp instead of reading DB",
    )
    ap.add_argument(
        "--restore",
        action="store_true",
        help="restore day_packages in DB from MinIO backup",
    )
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    days = [int(x) for x in args.days.split(",") if x.strip()] or list_available_days()
    store = get_store()
    store.ensure_buckets()

    if args.restore:
        with db_cursor() as cur:
            cur.execute(
                "SELECT id FROM course_versions WHERE version_tag=%s ORDER BY status DESC LIMIT 1",
                (args.version_tag,),
            )
            row = cur.fetchone()
            if not row:
                raise SystemExit(f"no course_versions.version_tag={args.version_tag}")
            version_id = row["id"]
            restored = 0
            for day in days:
                pkg = _load_pkg(store, args.version_tag, day)
                if not pkg:
                    print(f"MISSING day-{day:02d}")
                    continue
                if args.dry_run:
                    print(f"WOULD_RESTORE day-{day:02d} {pkg.get('title')}")
                    continue
                dp_id = f"{version_id}-day-{day:02d}"
                cur.execute(
                    """
                    INSERT INTO day_packages (id, course_version_id, day, title, project, package_json)
                    VALUES (%s, %s, %s, %s, %s, %s::jsonb)
                    ON CONFLICT (course_version_id, day) DO UPDATE SET
                      title = EXCLUDED.title,
                      project = EXCLUDED.project,
                      package_json = EXCLUDED.package_json
                    """,
                    (
                        dp_id,
                        version_id,
                        day,
                        pkg.get("title") or f"Day {day}",
                        pkg.get("project") or "",
                        json.dumps(pkg, ensure_ascii=False),
                    ),
                )
                restored += 1
                print(f"RESTORED day-{day:02d} {pkg.get('title')}")
        print(f"summary restored={restored}")
        return 0

    uploaded = 0
    if args.from_bootcamp:
        for day in days:
            pkg = build_day_package(day)
            if args.dry_run:
                print(f"WOULD_UPLOAD day-{day:02d} {pkg.get('title')}")
                continue
            key = _upload_pkg(store, args.version_tag, day, pkg)
            uploaded += 1
            print(f"OK {key} · {pkg.get('title')}")
    else:
        with db_cursor() as cur:
            cur.execute(
                "SELECT id FROM course_versions WHERE version_tag=%s ORDER BY status DESC LIMIT 1",
                (args.version_tag,),
            )
            row = cur.fetchone()
            if not row:
                raise SystemExit(f"no course_versions.version_tag={args.version_tag}")
            version_id = row["id"]
            for day in days:
                cur.execute(
                    """
                    SELECT title, package_json FROM day_packages
                    WHERE course_version_id=%s AND day=%s
                    """,
                    (version_id, day),
                )
                r = cur.fetchone()
                if not r:
                    print(f"SKIP day-{day:02d} (not in DB)")
                    continue
                pkg = r["package_json"]
                if isinstance(pkg, str):
                    pkg = json.loads(pkg)
                if args.dry_run:
                    print(f"WOULD_UPLOAD day-{day:02d} {r['title']}")
                    continue
                key = _upload_pkg(store, args.version_tag, day, pkg)
                uploaded += 1
                print(f"OK {key} · {r['title']}")

    print(f"summary uploaded={uploaded} bucket={S3_BUCKET_DOCUMENTS}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
