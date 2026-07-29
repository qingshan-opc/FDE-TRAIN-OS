#!/usr/bin/env python3
"""Patch Day05 section video/index.html timing from audio/timing.json.

Fixes:
  - data-start / data-duration on root, slides, avatar, audio
  - GSAP enter()/exit() hard-coded placeholder seconds
  - corrupted attrs like data-start="0.000\\x91.932" (old \\2+digit octal bug)
"""
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

FDE = Path(__file__).resolve().parents[1] / "class" / "bootcamp" / "day-05"
SECTION_DIRS = {
    "01": "section-01-worldview-plain",
    "02": "section-02-enterprise-digital-stages",
    "03": "section-03-how-software-built",
    "04": "section-04-server-cloudnative",
    "05": "section-05-frontend-tech",
    "06": "section-06-backend-tech",
    "07": "section-07-accept-map",
}


def _set_duration(html: str, pattern: str, value: float) -> tuple[str, int]:
    return re.subn(
        pattern,
        lambda m: f"{m.group(1)}{value:.3f}{m.group(2)}",
        html,
        count=1,
    )


def _patch_slide_tag(html: str, sid: str, start: float, dur: float) -> tuple[str, int]:
    pat = rf'<section\s+id="slide-{re.escape(sid)}"([^>]*)>'

    def repl(m: re.Match[str]) -> str:
        attrs = m.group(1)
        attrs = re.sub(r"\s*data-start=\"[^\"]*\"", "", attrs)
        attrs = re.sub(r"\s*data-duration=\"[^\"]*\"", "", attrs)
        attrs = attrs.rstrip()
        return (
            f'<section id="slide-{sid}"{attrs} '
            f'data-start="{start:.3f}" data-duration="{dur:.3f}">'
        )

    return re.subn(pat, repl, html, count=1)


def _patch_gsap(html: str, sid: str, start: float, dur: float, is_last: bool) -> str:
    slide = f"slide-{sid}"
    html2, n = re.subn(
        rf'(enter\("#{re.escape(slide)}",\s*)[\d.]+',
        lambda m: f"{m.group(1)}{start:.3f}",
        html,
        count=1,
    )
    if n:
        html = html2
        print(f"  gsap enter #{slide} → {start:.3f}")
    else:
        print(f"  warn: no gsap enter for #{slide}")

    soft = max(0.0, start + dur - 0.45)
    hard = start + dur
    html2, n = re.subn(
        rf'(exit\("#{re.escape(slide)}",\s*)[\d.]+(\s*,\s*)[\d.]+',
        lambda m: f"{m.group(1)}{soft:.3f}{m.group(2)}{hard:.3f}",
        html,
        count=1,
    )
    if n:
        html = html2
        print(f"  gsap exit  #{slide} → {soft:.3f}, {hard:.3f}")
    elif not is_last:
        print(f"  warn: no gsap exit for #{slide}")

    # slides 数组格式: { "id": "#slide-xxx", "start": NUM, "dur": NUM } (JSON-quoted) or unquoted
    arr_pat = rf'(\{{\s*"?id"?\s*:\s*"#{slide}"\s*,\s*"?start"?\s*:\s*)[\d.]+(\s*,\s*"?dur"?\s*:\s*)[\d.]+(\s*\}})'
    html2, n = re.subn(
        arr_pat,
        lambda m: f"{m.group(1)}{start:.3f}{m.group(2)}{dur:.3f}{m.group(3)}",
        html,
        count=1,
    )
    if n:
        html = html2
        print(f"  gsap array #{slide} → start={start:.3f} dur={dur:.3f}")
    return html


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--section", required=True)
    args = ap.parse_args()
    sec = args.section.zfill(2)
    if sec not in SECTION_DIRS:
        raise SystemExit(f"unknown section {sec}")

    root = FDE / SECTION_DIRS[sec] / "video"
    timing = json.loads((root / "audio" / "timing.json").read_text(encoding="utf-8"))
    total = float(timing["total"])
    segs = timing["segments"]
    html_path = root / "index.html"
    html = html_path.read_text(encoding="utf-8")

    html, _ = _set_duration(
        html, r'(id="root"[^>]*data-duration=")[^"]+(")', total
    )
    for eid in ("brand-bar", "avatar-pip"):
        html, _ = _set_duration(
            html, rf'(id="{eid}"[^>]*data-duration=")[^"]+(")', total
        )
    for eid in ("avatar-video", "avatar-lipsync"):
        html, _ = _set_duration(
            html, rf'(id="{eid}"[\s\S]*?data-duration=")[^"]+(")', total
        )
    html, _ = _set_duration(
        html, r'(id="narration"[^>]*data-duration=")[^"]+(")', total
    )
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
