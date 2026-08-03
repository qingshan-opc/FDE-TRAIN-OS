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


def _capsule_ids(day: int) -> list[str]:
    pkg = build_day_package(day)
    ids: list[str] = []
    for index, capsule in enumerate(((pkg.get("learn") or {}).get("capsules") or []), start=1):
        if isinstance(capsule, dict):
            ids.append(str(capsule.get("id") or f"c{index}"))
    return ids


def set_progress(*, email: str, camp_id: str, target_day: int, open_capsules: bool = False) -> dict:
    days = list_available_days()
    max_day = max(days) if days else 0
    if target_day < 1 or target_day > max_day + 1:
        raise SystemExit(f"day {target_day} out of range (1..{max_day + 1})")

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

        capsules_opened = 0
        if open_capsules:
            for day in range(1, target_day):
                ts = now_iso()
                for capsule_id in _capsule_ids(day):
                    cur.execute(
                        """
                        INSERT INTO capsule_progress (learner_id, camp_id, day, capsule_id, opened_at)
                        VALUES (?,?,?,?,?)
                        ON CONFLICT (learner_id, camp_id, day, capsule_id) DO NOTHING
                        """,
                        (learner_id, camp_id, day, capsule_id, ts),
                    )
                    capsules_opened += 1

    return {
        "learner_id": learner_id,
        "email": email,
        "camp_id": camp_id,
        "target_day": target_day,
        "passed_nodes": passed,
        "capsules_opened": capsules_opened if open_capsules else 0,
    }


def max_progress(*, email: str, camp_id: str, open_capsules: bool = True) -> dict:
    days = list_available_days()
    if not days:
        raise SystemExit("no bootcamp days")
    return set_progress(
        email=email,
        camp_id=camp_id,
        target_day=max(days) + 1,
        open_capsules=open_capsules,
    )


def main() -> None:
    ap = argparse.ArgumentParser(description="Set learner to start bootcamp day N")
    ap.add_argument("--email", default=LEARNER_EMAIL)
    ap.add_argument("--camp-id", default=DEFAULT_CAMP_ID)
    ap.add_argument("--day", type=int, default=0, help="unlock this day (prior days passed)")
    ap.add_argument("--max", action="store_true", help="pass all bootcamp days + open capsules")
    ap.add_argument("--open-capsules", action="store_true", help="with --day, also mark capsules opened")
    args = ap.parse_args()
    if args.max:
        result = max_progress(email=args.email, camp_id=args.camp_id, open_capsules=True)
    elif args.day:
        result = set_progress(
            email=args.email,
            camp_id=args.camp_id,
            target_day=args.day,
            open_capsules=args.open_capsules,
        )
    else:
        ap.error("specify --day N or --max")
    print(result)


if __name__ == "__main__":
    main()
