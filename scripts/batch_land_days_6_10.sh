#!/usr/bin/env bash
# Resilient Day6–Day10 video batch: TTS → lipsync → patch → render → MinIO upload
set -uo pipefail
ROOT="${ROOT:-/Users/qingjiu/workspace/research/digital-fde-platform}"
DHX="${FDE_DHX_ROOT:-/Users/qingjiu/workspace/research/digital-human-platform}"
LOG="${ROOT}/logs/video-batch-$(date +%Y%m%d-%H%M%S).log"
PIDFILE="${ROOT}/logs/video-batch.pid"
PYTHON="${ROOT}/.venv/bin/python"
START_DAY="${START_DAY:-6}"
START_SEC="${START_SEC:-01}"

mkdir -p "${ROOT}/logs"
echo "$$" > "$PIDFILE"
ln -sf "$LOG" "${ROOT}/logs/video-batch-latest.log"
exec > >(tee -a "$LOG") 2>&1

echo "=== batch start pid=$$ START_DAY=$START_DAY START_SEC=$START_SEC ==="
echo "LOG=$LOG"

cd "$ROOT"

"$PYTHON" - <<PY
import os, subprocess, sys, yaml
from pathlib import Path

ROOT = Path("${ROOT}")
DHX = Path("${DHX}")
PYTHON = "${PYTHON}"
START_DAY = int("${START_DAY}")
START_SEC = os.environ.get("START_SEC", "01").zfill(2)

sys.path.insert(0, str(ROOT / "scripts"))
from bootcamp_sections import section_dirs, section_path

def run(cmd, **kw):
    print("$", " ".join(cmd), flush=True)
    subprocess.run(cmd, check=True, **kw)

def pipeline(day: int, sec: str) -> bool:
    sec = sec.zfill(2)
    print(f"\n========== DAY {day} SECTION {sec} ==========", flush=True)
    try:
        run([PYTHON, str(ROOT / "scripts/bootstrap_narration_from_lesson.py"), "--day", str(day), "--section", sec])
        sdir = section_path(day, sec)
        if not (sdir / "video/index.html").is_file():
            run([PYTHON, str(ROOT / "scripts/scaffold_section_video.py"), "--day", str(day), "--section", sec])
        env = {**os.environ, "PYTHONPATH": str(DHX)}
        run([str(DHX / ".venv-dhx/bin/python"), str(DHX / "scripts/synth_bootcamp_section.py"),
             "--day", str(day), "--section", sec], cwd=DHX, env=env)
        run([str(DHX / ".venv/bin/python"), str(DHX / "scripts/lipsync_bootcamp_section.py"),
             "--day", str(day), "--section", sec], cwd=DHX, env=env)
        run([PYTHON, str(ROOT / "scripts/patch_section_video_timing.py"), "--day", str(day), "--section", sec])
        data = yaml.safe_load((ROOT / "class/bootcamp" / f"day-{day:02d}" / "day.yaml").read_text(encoding="utf-8"))
        slug = data["capsule_extra"][f"c{int(sec)}"]["media"][0]["object_key"].rsplit("/", 1)[-1].replace(".mp4", "")
        out = sdir / "video/renders" / f"{slug}.mp4"
        out.parent.mkdir(parents=True, exist_ok=True)
        run(["npx", "hyperframes@0.7.72", "render", ".", "-o", str(out)], cwd=sdir / "video")
        run([PYTHON, str(ROOT / "scripts/upload_bootcamp_section.py"), "--day", str(day), "--section", sec, "--mp4", str(out)])
        print(f"OK day{day} s{sec} → {out}", flush=True)
        return True
    except subprocess.CalledProcessError as e:
        print(f"FAIL day{day} s{sec} exit={e.returncode}", flush=True)
        return False
    except Exception as e:
        print(f"FAIL day{day} s{sec}: {e}", flush=True)
        return False

ok = fail = 0
for day in range(6, 11):
    for sec in section_dirs(day):
        if day < START_DAY or (day == START_DAY and sec < START_SEC):
            print(f"SKIP day{day} s{sec}", flush=True)
            continue
        if pipeline(day, sec):
            ok += 1
        else:
            fail += 1

run([PYTHON, str(ROOT / "scripts/build_v07_week1_contracts.py")], env={**os.environ, "PYTHONPATH": str(ROOT)})
run([PYTHON, "-c",
     "from services.shared.seed import seed_course_version_from_yaml\n"
     "from services.shared.config import DEFAULT_CAMP_ID, SEED_VERSION_TAGS\n"
     "for t in SEED_VERSION_TAGS:\n"
     " seed_course_version_from_yaml(camp_id=DEFAULT_CAMP_ID, version_tag=t); print('seeded', t)"],
    env={**os.environ, "PYTHONPATH": str(ROOT)})

# media_fields sync to published curriculum version
try:
    run([PYTHON, str(ROOT / "scripts/sync_bootcamp_media_to_db.py"), "--days", "6,7,8,9,10"],
        env={**os.environ, "PYTHONPATH": str(ROOT)})
except Exception:
    pass

print(f"BATCH DONE ok={ok} fail={fail}", flush=True)
sys.exit(1 if fail else 0)
PY

rm -f "$PIDFILE"
echo "=== batch exit $? ==="
