#!/usr/bin/env python3
"""Patch section video/index.html timing from audio/timing.json (any bootcamp day)."""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BC = ROOT / "class" / "bootcamp"

# Reuse day05 patch logic
sys.path.insert(0, str(ROOT / "scripts"))
from bootcamp_sections import section_dirs  # noqa: E402
from patch_day05_video_timing import (  # noqa: E402
    _patch_gsap,
    _patch_slide_tag,
    _set_duration,
)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--day", type=int, default=5)
    ap.add_argument("--section", required=True)
    args = ap.parse_args()
    sec = args.section.zfill(2)
    mapping = section_dirs(args.day)
    if sec not in mapping:
        raise SystemExit(f"day {args.day} unknown section {sec}")
    root = BC / f"day-{args.day:02d}" / mapping[sec] / "video"
    timing = json.loads((root / "audio" / "timing.json").read_text(encoding="utf-8"))
    total = float(timing["total"])
    segs = timing["segments"]
    html_path = root / "index.html"
    html = html_path.read_text(encoding="utf-8")

    html, _ = _set_duration(html, r'(id="root"[^>]*data-duration=")[^"]+(")', total)
    for eid in ("brand-bar", "avatar-pip"):
        html, _ = _set_duration(html, rf'(id="{eid}"[^>]*data-duration=")[^"]+(")', total)
    for eid in ("avatar-video", "avatar-lipsync"):
        html, _ = _set_duration(html, rf'(id="{eid}"[\s\S]*?data-duration=")[^"]+(")', total)
    html, _ = _set_duration(html, r'(id="narration"[^>]*data-duration=")[^"]+(")', total)
    html, _ = _set_duration(
        html,
        r'(<audio[^>]*src="audio/narration-full\.wav"[^>]*data-duration=")[^"]+(")',
        total,
    )

    for i, s in enumerate(segs):
        sid = s["id"]
        start = float(s["start"])
        dur = float(s["duration"])
        html2, n = _patch_slide_tag(html, sid, start, dur)
        if n == 0:
            print(f"warn: slide tag not found for {sid}")
        else:
            html = html2
            print(f"patched slide-{sid}: start={start:.3f} dur={dur:.3f}")
        html = _patch_gsap(html, sid, start, dur, is_last=(i == len(segs) - 1))

    html_path.write_text(html, encoding="utf-8")
    print(f"total={total:.3f}s → {html_path}")


if __name__ == "__main__":
    main()
