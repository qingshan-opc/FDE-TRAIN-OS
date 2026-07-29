#!/usr/bin/env python3
"""Build curriculum contracts from class/bootcamp (Day 1–10).

See services/author/bootcamp_sync.py for the shared build logic.
"""
from __future__ import annotations

from pathlib import Path

import yaml

from services.author.bootcamp_sync import build_day_package, list_available_days

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "contracts" / "examples"


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for day in list_available_days():
        pkg = build_day_package(day)
        path = OUT / f"day-{day:02d}-curriculum.yaml"
        with path.open("w", encoding="utf-8") as f:
            yaml.safe_dump(pkg, f, allow_unicode=True, sort_keys=False, width=120)
        week = pkg.get("week", 1)
        print(
            f"day-{day:02d}: {pkg['title']} · {len(pkg['learn']['capsules'])} capsules · "
            f"{len(pkg['quiz']['questions'])} quiz · {len(pkg['review_checklist'])} checks · week={week}"
        )


if __name__ == "__main__":
    main()
