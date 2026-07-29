#!/usr/bin/env python3
"""Set learner progress so they start the given bootcamp day (prior days passed)."""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "backend"))

from services.author.bootcamp_sync import build_day_package, list_available_days
from services.shared.config import DEFAULT_CAMP_ID, LEARNER_EMAIL
from services.shared.db import db_cursor
from services.shared.seed import now_iso


def _node_ids(day: int) -> list[str]:
    pkg = build_day_package(day)
    out: list[str] = []
    for n in pkg.get("nodes") or []:
        kind = n.get("type") or n.get("kind")
        if kind:
            out.append(f"d{day}-{kind}")
    return out


def set_progress(*, email: str, camp_id: str, target_day: int) -> dict:
    days = list_available_days()
    if target_day not in days:
        raise SystemExit(f"day {target_day} not in bootcamp ({days})")

    with db_cursor() as cur:
        cur.execute("SELECT id FROM users WHERE LOWER(email)=LOWER(?)", (email,))
        row = cur.fetchone()
        if not row:
            raise SystemExit(f"user not found: {email}")
        learner_id = row["id"]

        cur.execute(
            "DELETE FROM node_progress WHERE learner_id=? AND camp_id=? AND day >= ?",
            (learner_id, camp_id, target_day),
        )
        cur.execute(
            "DELETE FROM capsule_progress WHERE learner_id=? AND camp_id=? AND day >= ?",
            (learner_id, camp_id, target_day),
        )
        max_day = max(days)
        cur.execute(
            "DELETE FROM node_progress WHERE learner_id=? AND camp_id=? AND day > ?",
            (learner_id, camp_id, max_day),
        )

        passed = 0
        for day in range(1, target_day):
            ids = set(_node_ids(day))
            # drop stale node ids for this day
            cur.execute(
                "DELETE FROM node_progress WHERE learner_id=? AND camp_id=? AND day=? AND node_id NOT IN ({})".format(
                    ",".join("?" * len(ids)) if ids else "NULL"
                ),
                (learner_id, camp_id, day, *ids) if ids else (learner_id, camp_id, day),
            )
            ts = now_iso()
            for node_id in ids:
                cur.execute(
                    """
                    INSERT INTO node_progress (learner_id, camp_id, day, node_id, status, updated_at)
                    VALUES (?,?,?,?,?,?)
                    ON CONFLICT (learner_id, camp_id, day, node_id) DO UPDATE SET
                      status=EXCLUDED.status, updated_at=EXCLUDED.updated_at
                    """,
                    (learner_id, camp_id, day, node_id, "passed", ts),
                )
                passed += 1

    return {
        "learner_id": learner_id,
        "email": email,
        "camp_id": camp_id,
        "target_day": target_day,
        "passed_nodes": passed,
    }


def main() -> None:
    ap = argparse.ArgumentParser(description="Set learner to start bootcamp day N")
    ap.add_argument("--email", default=LEARNER_EMAIL)
    ap.add_argument("--camp-id", default=DEFAULT_CAMP_ID)
    ap.add_argument("--day", type=int, required=True)
    args = ap.parse_args()
    result = set_progress(email=args.email, camp_id=args.camp_id, target_day=args.day)
    print(result)


if __name__ == "__main__":
    main()
