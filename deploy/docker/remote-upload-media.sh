#!/usr/bin/env bash
# Run on 192.168.0.138 after videos are in ~/fde-platform/.upload/course-media/
set -euo pipefail
ROOT="${HOME}/fde-platform"
DAYS="${1:-6,7,8,9}"
COMPOSE="${ROOT}/.tools/docker-compose"
DOCKER="${DOCKER_BIN:-/usr/local/bin/docker}"
UPLOAD="${ROOT}/.upload/course-media"
STAGE="/tmp/fde-course-media-upload"
cd "${ROOT}/deploy/docker"
test -x "${COMPOSE}" || COMPOSE=docker-compose

API_CID="$("${COMPOSE}" -f docker-compose.prod.yml --env-file .env.prod ps -q api)"
if [[ -z "${API_CID}" ]]; then
  echo "api container not running" >&2
  exit 1
fi

echo "==> stage videos into api container"
"${DOCKER}" exec "${API_CID}" rm -rf "${STAGE}"
"${DOCKER}" exec "${API_CID}" mkdir -p "${STAGE}"
"${DOCKER}" cp "${UPLOAD}/." "${API_CID}:${STAGE}/"
"${DOCKER}" exec -u 0 "${API_CID}" chmod -R a+rX "${STAGE}"

"${DOCKER}" cp "${ROOT}/scripts/sync_course_media_to_minio.py" \
  "${API_CID}:/app/scripts/sync_course_media_to_minio.py"
"${DOCKER}" cp "${ROOT}/scripts/sync_bootcamp_media_to_db.py" \
  "${API_CID}:/app/scripts/sync_bootcamp_media_to_db.py"

echo "==> MinIO upload (days=${DAYS})"
"${DOCKER}" exec "${API_CID}" python scripts/sync_course_media_to_minio.py \
  --source-dir "${STAGE}" --force --days "${DAYS}"

echo "==> DB media_fields sync"
"${DOCKER}" exec "${API_CID}" python scripts/sync_bootcamp_media_to_db.py --days "${DAYS}"

echo "==> verify"
"${DOCKER}" exec "${API_CID}" python scripts/sync_course_media_to_minio.py \
  --source-dir "${STAGE}" --verify-only --days "${DAYS}"

"${DOCKER}" exec "${API_CID}" rm -rf "${STAGE}"
echo "upload ok"
