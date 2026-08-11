#!/usr/bin/env python3
"""Refresh day_packages from class/bootcamp and backup JSON to MinIO.

Intended for post-deploy / ops recovery so bootstrap cannot leave a stale
curriculum as the live offering source of truth.

Usage:
  PYTHONPATH=backend .venv/bin/python scripts/persist_bootcamp_curriculum.py
  PYTHONPATH=backend .venv/bin/python scripts/persist_bootcamp_curriculum.py --tags v0.7,fde-v07
"""
from __future__ import annotations

import argparse
import json
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "backend"))

from services.author.bootcamp_sync import build_day_package, list_available_days  # noqa: E402
from services.shared.config import CURRICULUM_VERSION_TAG, S3_BUCKET_DOCUMENTS  # noqa: E402
from services.shared.db import db_cursor  # noqa: E402
from services.storage import get_store  # noqa: E402


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--tags", default=f"{CURRICULUM_VERSION_TAG},fde-v07")
    ap.add_argument("--days", default="")
    ap.add_argument("--skip-minio", action="store_true")
    args = ap.parse_args()

    days = [int(x) for x in args.days.split(",") if x.strip()] or list_available_days()
    tags = [t.strip() for t in args.tags.split(",") if t.strip()]
    packages = {d: build_day_package(d) for d in days}
    print("built", {d: packages[d].get("title") for d in days})

    store = get_store()
    store.ensure_buckets()

    with db_cursor() as cur:
        for tag in tags:
            cur.execute(
                "SELECT id FROM course_versions WHERE version_tag=%s LIMIT 1",
                (tag,),
            )
            row = cur.fetchone()
            if not row:
                print(f"SKIP missing version_tag={tag}")
                continue
            vid = row["id"]
            for day, pkg in packages.items():
                payload = json.dumps(pkg, ensure_ascii=False)
                title = pkg.get("title") or f"Day {day}"
                project = pkg.get("project") or ""
                cur.execute(
                    "SELECT id FROM day_packages WHERE course_version_id=%s AND day=%s",
                    (vid, day),
                )
                existing = cur.fetchone()
                if existing:
                    cur.execute(
                        """
                        UPDATE day_packages
                        SET title=%s, project=%s, package_json=%s::jsonb
                        WHERE course_version_id=%s AND day=%s
                        """,
                        (title, project, payload, vid, day),
                    )
                else:
                    cur.execute(
                        """
                        INSERT INTO day_packages
                          (id, course_version_id, day, title, project, package_json, created_at)
                        VALUES (%s,%s,%s,%s,%s,%s::jsonb,%s)
                        """,
                        (str(uuid.uuid4()), vid, day, title, project, payload, now_iso()),
                    )
                print(f"DB {tag} day-{day:02d} ← {title}")

    if not args.skip_minio:
        for day, pkg in packages.items():
            key = f"documents/shared/curriculum/{CURRICULUM_VERSION_TAG}/day-{day:02d}-curriculum.json"
            body = json.dumps(pkg, ensure_ascii=False, indent=2).encode("utf-8")
            store.put_bytes(S3_BUCKET_DOCUMENTS, key, body, content_type="application/json")
            print(f"MINIO {key}")

    print("persist ok")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
