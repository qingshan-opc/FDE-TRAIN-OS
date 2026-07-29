#!/usr/bin/env bash
# Batch land all bootcamp videos Day5–Day10
set -euo pipefail
ROOT="/Users/qingjiu/workspace/research/digital-fde-platform"
LOG="$ROOT/logs/video-batch-$(date +%Y%m%d-%H%M%S).log"
mkdir -p "$ROOT/logs"
exec > >(tee -a "$LOG") 2>&1
cd "$ROOT"
echo "LOG=$LOG"

"$ROOT/.venv/bin/python" - <<'PY'
import subprocess
import sys
import os
from pathlib import Path

ROOT = Path("/Users/qingjiu/workspace/research/digital-fde-platform")
BC = ROOT / "class" / "bootcamp"
PYTHON = str(ROOT / ".venv/bin/python")
sys.path.insert(0, str(ROOT / "scripts"))
from bootcamp_sections import section_dirs, section_path  # noqa: E402


def sections(day: int) -> list[str]:
    return list(section_dirs(day).keys())


def run(cmd: list[str], **kw):
    print("$", " ".join(cmd), flush=True)
    subprocess.run(cmd, check=True, **kw)


def upload_if_render(day: int, sec: str) -> None:
    sdir = section_path(day, sec)
    renders = list((sdir / "video" / "renders").glob("*.mp4"))
    if not renders:
        return
    mp4 = max(renders, key=lambda p: p.stat().st_mtime)
    run([PYTHON, str(ROOT / "scripts/upload_bootcamp_section.py"),
         "--day", str(day), "--section", sec, "--mp4", str(mp4)])


def pipeline(day: int, sec: str) -> None:
    print(f"\n========== DAY {day} SECTION {sec} ==========", flush=True)
    run([PYTHON, str(ROOT / "scripts/bootstrap_narration_from_lesson.py"),
         "--day", str(day), "--section", sec])
    sdir = section_path(day, sec)
    if not (sdir / "video/index.html").is_file():
        run([PYTHON, str(ROOT / "scripts/scaffold_section_video.py"),
             "--day", str(day), "--section", sec])
    dhx = Path("/Users/qingjiu/workspace/research/digital-human-platform")
    run([str(dhx / ".venv-dhx/bin/python"), str(dhx / "scripts/synth_bootcamp_section.py"),
         "--day", str(day), "--section", sec], cwd=dhx, env={**dict(__import__("os").environ), "PYTHONPATH": str(dhx)})
    run([str(dhx / ".venv/bin/python"), str(dhx / "scripts/lipsync_bootcamp_section.py"),
         "--day", str(day), "--section", sec], cwd=dhx, env={**dict(__import__("os").environ), "PYTHONPATH": str(dhx)})
    run([PYTHON, str(ROOT / "scripts/patch_section_video_timing.py"),
         "--day", str(day), "--section", sec])
    import yaml
    data = yaml.safe_load((BC / f"day-{day:02d}" / "day.yaml").read_text(encoding="utf-8"))
    slug = data["capsule_extra"][f"c{int(sec)}"]["media"][0]["object_key"].rsplit("/", 1)[-1].replace(".mp4", "")
    out = sdir / "video/renders" / f"{slug}.mp4"
    out.parent.mkdir(parents=True, exist_ok=True)
    run(["npx", "hyperframes@0.7.72", "render", ".", "-o", str(out)], cwd=sdir / "video")
    run([PYTHON, str(ROOT / "scripts/upload_bootcamp_section.py"),
         "--day", str(day), "--section", sec, "--mp4", str(out)])


# Day5 already uploaded — skip re-pipeline
print("SKIP day5 (already on MinIO)", flush=True)

start_day = int(os.environ.get("START_DAY", "6"))
start_sec = os.environ.get("START_SEC", "01").zfill(2)

for day in range(6, 11):
    for sec in sections(day):
        if day < start_day or (day == start_day and sec < start_sec):
            print(f"SKIP day{day} s{sec}", flush=True)
            continue
        pipeline(day, sec)

run([PYTHON, str(ROOT / "scripts/build_v07_week1_contracts.py")])
run([PYTHON, "-c",
     "from services.shared.seed import seed_course_version_from_yaml\n"
     "for t in ['v0.7','fde-v07','fde-v06']:\n"
     " seed_course_version_from_yaml(camp_id='camp-v03', version_tag=t); print('seeded', t)"])
print("BATCH DONE", flush=True)
PY
