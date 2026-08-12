#!/usr/bin/env python3
"""Merge ink-camp CMS defaults into site_pages.body_json (slug=landing).

Idempotent: deep-merges defaults under home/footer/partners/seo_by_route/about/seo
without wiping author overrides when --preserve is set (default).

Usage:
  # local / tunnel with DATABASE_URL
  PYTHONPATH=backend .venv/bin/python scripts/seed_landing_cms_defaults.py

  # force overwrite CMS sections from contracts/site/landing_cms_defaults.json
  PYTHONPATH=backend .venv/bin/python scripts/seed_landing_cms_defaults.py --force
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
# Local: ROOT/backend/services; Docker platform image: ROOT/services
for candidate in (ROOT / "backend", ROOT):
    if (candidate / "services").is_dir():
        sys.path.insert(0, str(candidate))
        break
else:
    sys.path.insert(0, str(ROOT))


def deep_merge(base: dict, patch: dict) -> dict:
    out = dict(base)
    for k, v in patch.items():
        if k in out and isinstance(out[k], dict) and isinstance(v, dict):
            out[k] = deep_merge(out[k], v)
        else:
            out[k] = v
    return out


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--force",
        action="store_true",
        help="Replace home/footer/partners/seo_by_route/about/seo from defaults (keeps enterprise mentors/open courses)",
    )
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    from services.shared.landing_cms_defaults import LANDING_CMS_DEFAULTS
    from services.shared import db_cursor

    sections = ("home", "footer", "partners", "seo_by_route", "about", "seo", "contact")
    patch = {k: LANDING_CMS_DEFAULTS[k] for k in sections if k in LANDING_CMS_DEFAULTS}

    with db_cursor() as cur:
        cur.execute("SELECT body_json FROM site_pages WHERE slug=? LIMIT 1", ("landing",))
        row = cur.fetchone()
        if not row:
            print("ERROR: site_pages landing row missing", file=sys.stderr)
            return 1
        raw = row["body_json"] if isinstance(row, dict) else row[0]
        body = raw if isinstance(raw, dict) else (json.loads(raw) if raw else {})
        if args.force:
            for k, v in patch.items():
                body[k] = v
            # also seed enterprise.facts if empty
            ent = body.get("enterprise") if isinstance(body.get("enterprise"), dict) else {}
            facts = ent.get("facts")
            if not isinstance(facts, list) or not facts:
                ent = {**ent, "facts": LANDING_CMS_DEFAULTS.get("enterprise_facts") or []}
                body["enterprise"] = ent
        else:
            body = deep_merge(patch, body)  # body wins on conflicts
            # ensure missing keys filled from defaults
            for k, v in patch.items():
                if k not in body or body[k] in (None, {}, []):
                    body[k] = v
            ent = body.get("enterprise") if isinstance(body.get("enterprise"), dict) else {}
            facts = ent.get("facts")
            if not isinstance(facts, list) or not facts:
                ent = {**ent, "facts": LANDING_CMS_DEFAULTS.get("enterprise_facts") or []}
                body["enterprise"] = ent

        print("keys after merge:", sorted(body.keys()))
        if args.dry_run:
            print(json.dumps({k: body.get(k) is not None for k in sections}, ensure_ascii=False, indent=2))
            return 0
        cur.execute(
            "UPDATE site_pages SET body_json=?::jsonb, updated_at=NOW() WHERE slug=?",
            (json.dumps(body, ensure_ascii=False), "landing"),
        )
        print("OK: seeded landing CMS defaults (force=%s)" % args.force)
    return 0


if __name__ == "__main__":
    # allow DATABASE_URL from env; psycopg uses services.shared
    if not os.environ.get("DATABASE_URL") and not os.environ.get("PGHOST"):
        print("Note: using app default DB config from environment/.env", file=sys.stderr)
    raise SystemExit(main())
