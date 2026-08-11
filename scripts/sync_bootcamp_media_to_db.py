#!/usr/bin/env python3
"""Sync day_packages from bootcamp day.yaml (media_fields merge by default)."""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "backend"))

from services.author.bootcamp_sync import preview_day_sync  # noqa: E402
from services.shared.config import CURRICULUM_VERSION_TAG  # noqa: E402
from services.shared.db import db_cursor  # noqa: E402


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--version-tag", default=CURRICULUM_VERSION_TAG)
    ap.add_argument("--days", default="1")
    ap.add_argument("--merge", default="media_fields", choices=("media_fields", "full"))
    args = ap.parse_args()
    days = [int(x) for x in args.days.split(",") if x.strip()]

    with db_cursor() as cur:
        cur.execute(
            "SELECT id FROM course_versions WHERE version_tag = %s ORDER BY status DESC LIMIT 1",
            (args.version_tag,),
        )
        row = cur.fetchone()
        if not row:
            raise SystemExit(f"no version_tag={args.version_tag}")
        version_id = row["id"]
        print(f"sync {args.merge} → {version_id} ({args.version_tag})")

        for day in days:
            cur.execute(
                "SELECT package_json FROM day_packages WHERE course_version_id=%s AND day=%s",
                (version_id, day),
            )
            r = cur.fetchone()
            existing = None
            if r:
                existing = r["package_json"]
                if isinstance(existing, str):
                    existing = json.loads(existing)
            preview = preview_day_sync(existing, day, args.merge)
            pkg = preview["package_json"]
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
                    preview["title"],
                    pkg.get("project", ""),
                    json.dumps(pkg, ensure_ascii=False),
                ),
            )
            print(f"  day{day}: {preview['title']} · {preview['changes']}")


if __name__ == "__main__":
    main()
