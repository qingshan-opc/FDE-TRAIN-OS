#!/usr/bin/env python3
"""Scaffold a HyperFrames-compatible index.html for each videos/fde-day01-* project.

This does NOT require the `npx hyperframes` CLI (which hangs in this environment
on `auth status`). It's a plain-HTML/GSAP standalone composition following the
hyperframes-core minimal-composition contract, built from:
  - STORYBOARD.md (scene captions, frame order)
  - renders/manifest.json (exact per-frame durations from the real TTS + ffmpeg
    pipeline, so timing here matches the already-uploaded explainer.mp4)

Once `npx hyperframes` is usable again, this project directory (SCRIPT.md +
STORYBOARD.md + index.html + renders/<slug>-intro.mp3) is a valid starting point
for `npx hyperframes lint/validate/preview/render` — re-render will reuse the same
locked narration audio rather than re-running TTS.

Usage:
  python3 scripts/scaffold_hyperframes_project.py [fde-day01-c1 ...]
  python3 scripts/scaffold_hyperframes_project.py --all
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
VIDEOS_DIR = ROOT / "videos"

PALETTE = {
    "bg": "#0b0f14",
    "fg": "#f5f7fa",
    "muted": "#96a5af",
    "accent": "#38d6c8",
}


def parse_storyboard_scenes(path: Path) -> list[str]:
    text = path.read_text(encoding="utf-8")
    scenes = []
    for m in re.finditer(r"^## Frame (\d+) — (.+)$", text, flags=re.M):
        tail = text[m.end():]
        scene_m = re.search(r"^- scene:\s*(.+)$", tail, flags=re.M)
        scenes.append(scene_m.group(1).strip() if scene_m else m.group(2).strip())
    return scenes


def build_index_html(slug: str, scenes: list[str], starts: list[float], total_dur: float, audio_rel: str) -> str:
    day_capsule = slug.replace("fde-day01-", "day01-")
    ends = starts[1:] + [total_dur]
    clips = []
    for i, (scene, start, end) in enumerate(zip(scenes, starts, ends), start=1):
        dur = round(end - start, 3)
        clips.append(f"""      <section
        id="scene-{i}"
        class="clip"
        data-start="{start:.3f}"
        data-duration="{dur:.3f}"
        data-track-index="1"
      >
        <p class="eyebrow">{day_capsule.upper()} · Frame {i}/{len(scenes)}</p>
        <h1 id="scene-{i}-title">{scene}</h1>
        <div class="dashes">
          {"".join(f'<span class="dash{" is-active" if j == i else ""}"></span>' for j in range(1, len(scenes) + 1))}
        </div>
      </section>""")
    clips_html = "\n".join(clips)

    tweens = "\n".join(
        f'      tl.from("#scene-{i}-title", {{ y: 36, opacity: 0, duration: 0.5, ease: "power3.out" }}, {starts[i-1]:.3f});'
        for i in range(1, len(scenes) + 1)
    )

    return f"""<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1920, height=1080" />
    <title>{day_capsule} explainer (HyperFrames scaffold)</title>
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
    <style>
      body {{
        margin: 0;
        background: {PALETTE["bg"]};
        color: {PALETTE["fg"]};
        font-family: "PingFang SC", "STHeiti", system-ui, sans-serif;
      }}
      #root {{
        position: relative;
        width: 1920px;
        height: 1080px;
        overflow: hidden;
      }}
      .clip {{
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 32px;
      }}
      .eyebrow {{
        position: absolute;
        top: 100px;
        left: 120px;
        margin: 0;
        color: {PALETTE["accent"]};
        font-size: 30px;
        letter-spacing: 0.04em;
      }}
      h1 {{
        margin: 0;
        font-size: 96px;
        font-weight: 600;
        text-align: center;
        max-width: 1500px;
      }}
      .dashes {{
        position: absolute;
        bottom: 120px;
        display: flex;
        gap: 16px;
      }}
      .dash {{
        width: 60px;
        height: 10px;
        border-radius: 5px;
        background: #3c444c;
      }}
      .dash.is-active {{
        background: {PALETTE["accent"]};
      }}
    </style>
  </head>
  <body>
    <div
      id="root"
      data-composition-id="{day_capsule}"
      data-width="1920"
      data-height="1080"
      data-duration="{total_dur:.3f}"
    >
{clips_html}
      <audio id="{day_capsule}-narration" src="{audio_rel}" data-role="narration"></audio>
    </div>
    <script>
      window.__timelines = window.__timelines || {{}};
      const tl = gsap.timeline({{ paused: true }});
{tweens}
      window.__timelines["{day_capsule}"] = tl;
    </script>
  </body>
</html>
"""


def scaffold(slug: str) -> Path:
    proj = VIDEOS_DIR / slug
    storyboard = proj / "STORYBOARD.md"
    manifest_path = proj / "renders" / "manifest.json"
    if not manifest_path.exists():
        raise SystemExit(f"{slug}: run scripts/build_course_media.py first (missing renders/manifest.json)")

    manifest = json.loads(manifest_path.read_text())
    scenes = parse_storyboard_scenes(storyboard)
    starts = manifest["frame_starts_sec"]
    total_dur = manifest["duration_sec"]
    day_capsule = slug.replace("fde-day01-", "day01-")
    audio_rel = f"renders/{day_capsule}-intro.mp3"

    html = build_index_html(slug, scenes, starts, total_dur, audio_rel)
    out = proj / "index.html"
    out.write_text(html, encoding="utf-8")
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("slugs", nargs="*")
    ap.add_argument("--all", action="store_true")
    args = ap.parse_args()
    slugs = args.slugs
    if args.all or not slugs:
        slugs = sorted(p.name for p in VIDEOS_DIR.glob("fde-day01-*") if p.is_dir())
    for slug in slugs:
        out = scaffold(slug)
        print(f"scaffolded {out.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
