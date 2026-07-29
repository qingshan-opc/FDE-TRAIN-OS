#!/usr/bin/env python3
"""Download Day 07 section photos via Lorem Picsum (deterministic by seed).

Each photo gets a unique seed derived from its slide topic, ensuring visual
variety across slides. Photos are 1600x900 JPEGs (landscape_16_9).
"""
from __future__ import annotations

import subprocess
import sys
import time
from pathlib import Path

DAY = Path("/Users/qingjiu/workspace/research/digital-fde-platform/class/bootcamp/day-07")

# (section_dir, filename, seed_keyword) — seed determines which photo Picsum returns
PHOTOS = [
    # S01: 从系统到能力
    ("section-01-system-to-skill", "01-open.jpg",           "system-cockpit"),
    ("section-01-system-to-skill", "02-system-skill.jpg",   "dashboard-screen"),
    ("section-01-system-to-skill", "03-prompt-skill.jpg",   "notebook-writing"),
    ("section-01-system-to-skill", "04-triple-value.jpg",   "teamwork-hands"),
    ("section-01-system-to-skill", "05-anti.jpg",           "minimal-desk"),
    # S02: Skill 解剖
    ("section-02-skill-anatomy", "01-open.jpg",             "blueprint-anatomy"),
    ("section-02-skill-anatomy", "02-input.jpg",            "raw-materials"),
    ("section-02-skill-anatomy", "03-output-accept.jpg",    "inspection-checklist"),
    ("section-02-skill-anatomy", "04-example.jpg",          "weekly-report"),
    ("section-02-skill-anatomy", "05-defects.jpg",          "broken-cracks"),
    # S03: 选品三筛
    ("section-03-pick-first", "01-open.jpg",                "choose-decision"),
    ("section-03-pick-first", "02-fail.jpg",                "warning-sign"),
    ("section-03-pick-first", "03-three-filters.jpg",       "filter-funnel"),
    ("section-03-pick-first", "04-low-risk.jpg",            "safety-helmet"),
    ("section-03-pick-first", "05-score.jpg",               "scorecard-grade"),
    # S04: 定义 Skill
    ("section-04-define-skill", "01-open.jpg",              "write-document"),
    ("section-04-define-skill", "02-verbs.jpg",             "action-motion"),
    ("section-04-define-skill", "03-criteria.jpg",          "ruler-measure"),
    ("section-04-define-skill", "04-reverse.jpg",           "reverse-arrow"),
    ("section-04-define-skill", "05-test.jpg",             "two-people-talk"),
    # S05: 运行与证据
    ("section-05-run-evidence", "01-open.jpg",              "ai-robot-work"),
    ("section-05-run-evidence", "02-run.jpg",               "play-button-run"),
    ("section-05-run-evidence", "03-evidence.jpg",          "folder-archive"),
    ("section-05-run-evidence", "04-debug.jpg",             "debug-magnifier"),
    ("section-05-run-evidence", "05-fix.jpg",               "wrench-tools"),
    # S06: 验收
    ("section-06-accept", "01-open.jpg",                    "stamp-approved"),
    ("section-06-accept", "02-three-q.jpg",                 "question-mark"),
    ("section-06-accept", "03-evidence-chain.jpg",          "chain-link"),
]


def download(url: str, dest: Path) -> bool:
    r = subprocess.run(
        ["curl", "-sL", "-o", str(dest), "-w", "%{http_code}", url],
        capture_output=True, text=True, timeout=60,
    )
    code = r.stdout.strip()
    return code == "200" and dest.stat().st_size > 10000


def main() -> None:
    ok = 0
    fail = 0
    for sec, fname, seed in PHOTOS:
        photos_dir = DAY / sec / "video" / "assets" / "photos"
        photos_dir.mkdir(parents=True, exist_ok=True)
        dest = photos_dir / fname
        if dest.exists() and dest.stat().st_size > 10000:
            print(f"  skip  {sec}/{fname} (exists)")
            ok += 1
            continue
        url = f"https://picsum.photos/seed/{seed}/1600/900"
        for attempt in range(3):
            if download(url, dest):
                print(f"  OK    {sec}/{fname} ({dest.stat().st_size // 1024}KB)")
                ok += 1
                break
            time.sleep(1)
        else:
            print(f"  FAIL  {sec}/{fname}")
            fail += 1
    print(f"\nDone: {ok} ok, {fail} fail")
    if fail:
        sys.exit(1)


if __name__ == "__main__":
    main()
