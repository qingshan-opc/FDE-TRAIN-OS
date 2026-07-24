#!/usr/bin/env bash
# Regenerate + upload Day1 course-media (audio/video/poster) for capsules
# c1/c3/c4/c6 into MinIO bucket fde-documents under
# documents/camp-v03/course-media/.
#
# Pipeline: SCRIPT.md + STORYBOARD.md (per videos/fde-day01-<capsule>/) ->
#   macOS `say` narration -> ffmpeg title-card mp4 -> mp3 + explainer.mp4 + poster.jpg
#   -> upload via services.storage (boto3/MinIO).
#
# Usage:
#   scripts/seed_course_media.sh                 # rebuild + upload all 4 capsules
#   scripts/seed_course_media.sh --upload-only    # skip TTS/ffmpeg, just re-upload renders/
#   scripts/seed_course_media.sh --render-only     # only rebuild, don't upload
#   scripts/seed_course_media.sh c1 c4             # only these capsules
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ -f .venv/bin/activate ]]; then
  # shellcheck disable=SC1091
  source .venv/bin/activate
fi

UPLOAD_ONLY=0
RENDER_ONLY=0
CAPSULES=()

for arg in "$@"; do
  case "$arg" in
    --upload-only) UPLOAD_ONLY=1 ;;
    --render-only) RENDER_ONLY=1 ;;
    -h|--help)
      grep '^#' "$0" | sed 's/^# \?//'
      exit 0
      ;;
    *) CAPSULES+=("fde-day01-$arg") ;;
  esac
done

if [[ ${#CAPSULES[@]} -eq 0 ]]; then
  while IFS= read -r line; do
    CAPSULES+=("$line")
  done < <(find videos -maxdepth 1 -type d -name 'fde-day01-*' -exec basename {} \; | sort)
fi

echo "== capsules: ${CAPSULES[*]} =="

if [[ "$UPLOAD_ONLY" -eq 0 ]]; then
  echo "== [1/2] generating narration + video (say + ffmpeg) =="
  python3 scripts/build_course_media.py "${CAPSULES[@]}"
fi

if [[ "$RENDER_ONLY" -eq 1 ]]; then
  echo "== render-only: skipping upload =="
  exit 0
fi

echo "== [2/2] uploading renders/ to MinIO (bucket fde-documents) =="
python3 scripts/upload_course_media.py "${CAPSULES[@]}"

echo "== done =="
