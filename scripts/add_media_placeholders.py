#!/usr/bin/env python3
"""Add media placeholders to day.yaml capsules missing media."""
from __future__ import annotations

import re
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]
BC = ROOT / "class" / "bootcamp"

SLUGS = {
    7: ["system-skill", "skill-anatomy", "pick-first", "define-skill", "run-evidence", "accept"],
    8: ["boundaries", "exception-test", "harness", "agent-loop", "gate8"],
    9: ["orchestration", "multi-skill", "human-confirm", "runbook", "gate9"],
    10: ["v2-scope", "ten-evidence", "demo-prep", "defense", "gate10"],
}


def title_from_capsule(day: int, cap_key: str, data: dict) -> str:
    extra = data["capsule_extra"][cap_key]
    cards = extra.get("knowledge_cards") or []
    if cards:
        return cards[0].get("term", "口播课件")
    return f"Day{day} {cap_key}"


def main() -> None:
    for day, slugs in SLUGS.items():
        path = BC / f"day-{day:02d}" / "day.yaml"
        data = yaml.safe_load(path.read_text(encoding="utf-8"))
        extra = data.get("capsule_extra") or {}
        keys = sorted(extra.keys(), key=lambda k: int(k[1:]))
        for i, cap_key in enumerate(keys):
            slug = slugs[i] if i < len(slugs) else f"sec{i+1}"
            if extra[cap_key].get("media"):
                continue
            prefix = f"documents/shared/course-media/day{day:02d}-c{i+1}-{slug}"
            extra[cap_key]["media"] = [
                {
                    "kind": "video",
                    "title": f"口播课件 · {title_from_capsule(day, cap_key, data)}",
                    "object_key": f"{prefix}.mp4",
                    "poster_key": f"{prefix}-poster.jpg",
                    "duration_sec": 0,
                }
            ]
            print(f"day-{day:02d} {cap_key} → {prefix}.mp4")
        path.write_text(yaml.dump(data, allow_unicode=True, sort_keys=False, width=120), encoding="utf-8")


if __name__ == "__main__":
    main()
