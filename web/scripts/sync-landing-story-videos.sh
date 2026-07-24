#!/usr/bin/env bash
# Sync landing story strip from FDE open-course explainers (fallback when Agnes 402).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT="$ROOT/web/public/landing"
BASE="${FDE_INTERNAL_BASE:-http://127.0.0.1:8760}"

mkdir -p "$OUT"
curl -fsSL "$BASE/api/v1/site/open-courses/fde-delivery/stream" -o "$OUT/story-task.mp4"
curl -fsSL "$BASE/api/v1/site/open-courses/fde-prompt/stream" -o "$OUT/story-agent.mp4"
curl -fsSL "$BASE/api/v1/site/open-courses/fde-intro/stream" -o "$OUT/story-cert.mp4"

for id in story-task story-agent story-cert; do
  ffmpeg -y -i "$OUT/$id.mp4" -ss 00:00:01 -vframes 1 -q:v 2 "$OUT/$id.png" >/dev/null 2>&1
done

echo "Synced landing story videos to $OUT"
