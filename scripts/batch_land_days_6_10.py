#!/usr/bin/env python3
"""Batch Day6–Day10: TTS → lipsync → patch → render → MinIO → DB sync."""
from __future__ import annotations

import argparse
import os
import subprocess
import sys
from datetime import datetime
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]
PYTHON = sys.executable

sys.path.insert(0, str(ROOT / "scripts"))
sys.path.insert(0, str(ROOT))
from bootcamp_sections import section_dirs, section_path  # noqa: E402
from fde_constants import (  # noqa: E402
    CURRICULUM_VERSION_TAG,
    DEFAULT_CAMP_ID,
    FDE_DHX_ROOT,
    FDE_HYPERFRAMES_VERSION,
    SEED_VERSION_TAGS,
)

DHX = FDE_DHX_ROOT


def log(msg: str) -> None:
    print(msg, flush=True)


def run(cmd: list[str], **kw) -> None:
    log("$ " + " ".join(cmd))
    subprocess.run(cmd, check=True, **kw)


def pipeline(day: int, sec: str) -> bool:
    sec = sec.zfill(2)
    log(f"\n========== DAY {day} SECTION {sec} ==========")
    progress = ROOT / "logs" / "video-batch-progress.json"
    try:
        run([PYTHON, str(ROOT / "scripts/bootstrap_narration_from_lesson.py"), "--day", str(day), "--section", sec])
        sdir = section_path(day, sec)
        if not (sdir / "video/index.html").is_file():
            run([PYTHON, str(ROOT / "scripts/scaffold_section_video.py"), "--day", str(day), "--section", sec])
        env = {**os.environ, "PYTHONPATH": str(DHX)}
        run(
            [str(DHX / ".venv-dhx/bin/python"), str(DHX / "scripts/synth_bootcamp_section.py"), "--day", str(day), "--section", sec],
            cwd=DHX,
            env=env,
        )
        run(
            [str(DHX / ".venv/bin/python"), str(DHX / "scripts/lipsync_bootcamp_section.py"), "--day", str(day), "--section", sec],
            cwd=DHX,
            env=env,
        )
        run([PYTHON, str(ROOT / "scripts/patch_section_video_timing.py"), "--day", str(day), "--section", sec])
        data = yaml.safe_load((ROOT / "class/bootcamp" / f"day-{day:02d}" / "day.yaml").read_text(encoding="utf-8"))
        slug = data["capsule_extra"][f"c{int(sec)}"]["media"][0]["object_key"].rsplit("/", 1)[-1].replace(".mp4", "")
        out = sdir / "video/renders" / f"{slug}.mp4"
        out.parent.mkdir(parents=True, exist_ok=True)
        run(["npx", f"hyperframes@{FDE_HYPERFRAMES_VERSION}", "render", ".", "-o", str(out)], cwd=sdir / "video")
        run([PYTHON, str(ROOT / "scripts/upload_bootcamp_section.py"), "--day", str(day), "--section", sec, "--mp4", str(out)])
        log(f"OK day{day} s{sec} → {out}")
        import json
        progress.write_text(
            json.dumps({"day": day, "sec": sec, "status": "ok", "mp4": str(out)}, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )
        return True
    except subprocess.CalledProcessError as e:
        log(f"FAIL day{day} s{sec} exit={e.returncode}")
        return False
    except Exception as e:
        log(f"FAIL day{day} s{sec}: {e}")
        return False


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--from-day", type=int, default=6)
    ap.add_argument("--to-day", type=int, default=10)
    ap.add_argument("--from-sec", default="01")
    args = ap.parse_args()
    start_sec = args.from_sec.zfill(2)

    log(f"=== batch python pid={os.getpid()} from day{args.from_day} sec{start_sec} ===")

    ok = fail = 0
    for day in range(args.from_day, args.to_day + 1):
        for sec in section_dirs(day):
            if day == args.from_day and sec < start_sec:
                log(f"SKIP day{day} s{sec}")
                continue
            if pipeline(day, sec):
                ok += 1
            else:
                fail += 1

    run([PYTHON, str(ROOT / "scripts/build_v07_week1_contracts.py")], env={**os.environ, "PYTHONPATH": f"{ROOT}/backend:{ROOT}"})
    run(
        [
            PYTHON,
            "-c",
            "import os; os.environ.setdefault('PYTHONPATH', %r)\n"
            "from services.shared.seed import seed_course_version_from_yaml\n"
            "from services.shared.config import DEFAULT_CAMP_ID, SEED_VERSION_TAGS\n"
            "for t in SEED_VERSION_TAGS:\n"
            " seed_course_version_from_yaml(camp_id=DEFAULT_CAMP_ID, version_tag=t); print('seeded', t)" % str(ROOT),
        ],
        env={**os.environ, "PYTHONPATH": f"{ROOT}/backend:{ROOT}"},
    )
    try:
        run(
            [
                PYTHON,
                str(ROOT / "scripts/sync_bootcamp_media_to_db.py"),
                "--version-tag",
                CURRICULUM_VERSION_TAG,
                "--days",
                "6,7,8,9,10",
            ]
        )
    except subprocess.CalledProcessError:
        log("warn: media_fields sync failed (published version?)")

    log(f"BATCH DONE ok={ok} fail={fail}")
    sys.exit(1 if fail else 0)


if __name__ == "__main__":
    main()
