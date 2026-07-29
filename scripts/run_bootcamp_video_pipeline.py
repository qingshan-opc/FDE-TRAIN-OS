#!/usr/bin/env python3
"""Full video pipeline: scaffold → TTS → lipsync → patch → render → upload."""
from __future__ import annotations

import argparse
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BC = ROOT / "class" / "bootcamp"
sys.path.insert(0, str(ROOT / "scripts"))
sys.path.insert(0, str(ROOT))
from bootcamp_sections import section_dirs  # noqa: E402
from fde_constants import FDE_DHX_ROOT, FDE_HYPERFRAMES_VERSION  # noqa: E402

DHX = FDE_DHX_ROOT


def run(cmd: list[str], cwd: Path | None = None, env: dict | None = None) -> None:
    print("$", " ".join(cmd), flush=True)
    full_env = None
    if env is not None:
        full_env = {**os.environ, **env}
    subprocess.run(cmd, cwd=cwd, check=True, env=full_env)


def pipeline(day: int, sec: str, skip_render: bool = False) -> None:
    sec = sec.zfill(2)
    mapping = section_dirs(day)
    section_path = BC / f"day-{day:02d}" / mapping[sec]
    video = section_path / "video"

    run([sys.executable, str(ROOT / "scripts/bootstrap_narration_from_lesson.py"), "--day", str(day), "--section", sec])
    if not (video / "index.html").is_file():
        run([sys.executable, str(ROOT / "scripts/scaffold_section_video.py"), "--day", str(day), "--section", sec])

    dhx_env = {"PYTHONPATH": str(DHX)}
    run(
        [str(DHX / ".venv-dhx/bin/python"), str(DHX / "scripts/synth_bootcamp_section.py"),
         "--day", str(day), "--section", sec],
        cwd=DHX,
        env=dhx_env,
    )
    run(
        [str(DHX / ".venv/bin/python"), str(DHX / "scripts/lipsync_bootcamp_section.py"),
         "--day", str(day), "--section", sec],
        cwd=DHX,
        env=dhx_env,
    )
    run([sys.executable, str(ROOT / "scripts/patch_section_video_timing.py"), "--day", str(day), "--section", sec])

    if skip_render:
        return

    import yaml
    data = yaml.safe_load((BC / f"day-{day:02d}" / "day.yaml").read_text(encoding="utf-8"))
    cap = data["capsule_extra"][f"c{int(sec)}"]
    slug = cap["media"][0]["object_key"].rsplit("/", 1)[-1].replace(".mp4", "")
    out = video / "renders" / f"{slug}.mp4"
    run(["npx", f"hyperframes@{FDE_HYPERFRAMES_VERSION}", "render", ".", "-o", str(out)], cwd=video)
    run([sys.executable, str(ROOT / "scripts/upload_bootcamp_section.py"), "--day", str(day), "--section", sec, "--mp4", str(out)])


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--day", type=int, required=True)
    ap.add_argument("--section", default="")
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--skip-render", action="store_true")
    args = ap.parse_args()
    if args.all:
        for sec in section_dirs(args.day):
            print(f"\n=== Day {args.day} Section {sec} ===", flush=True)
            pipeline(args.day, sec, skip_render=args.skip_render)
    elif args.section:
        pipeline(args.day, args.section, skip_render=args.skip_render)
    else:
        raise SystemExit("need --section or --all")


if __name__ == "__main__":
    main()
