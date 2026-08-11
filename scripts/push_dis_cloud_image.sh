#!/usr/bin/env bash
# Build and push all-in-one FDE platform image for dis-cloud.
# MUST run locally via Docker Desktop — do NOT build on the k3s node.
#
# Important: do NOT `buildx --push` / `imagetools create` here.
# Those produce an OCI index (+ attestation) which Aliyun ACR shows as size "-"
# and slows/confuses pulls. Instead: buildx --load → local tag → classic docker push
# so the registry gets a single Docker Schema2 (v2) manifest.
#
# Usage:
#   TAG=v0.7.2-20260803 ./scripts/push_dis_cloud_image.sh
#
# Image:
#   registry.cn-zhangjiakou.aliyuncs.com/818cloud/fde:dis-cloud-${TAG}
#   registry.cn-zhangjiakou.aliyuncs.com/818cloud/fde:dis-cloud-latest
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

REGISTRY="${REGISTRY:-registry.cn-zhangjiakou.aliyuncs.com/818cloud/fde}"
TAG="${TAG:-$(git rev-parse --short HEAD 2>/dev/null || date +%Y%m%d)}"
PLATFORM="${PLATFORM:-linux/amd64}"

IMAGE="${REGISTRY}:dis-cloud-${TAG}"
LATEST="${REGISTRY}:dis-cloud-latest"
LOCAL_TAG="fde-dis-cloud-local:${TAG}"
# Fail if image is suspiciously large (historical fat builds baked class/*.mp4 → ~2.8GB).
# Override: MAX_IMAGE_MB=500 ./scripts/push_dis_cloud_image.sh
MAX_IMAGE_MB="${MAX_IMAGE_MB:-300}"

echo "==> build platform (${PLATFORM}) → local ${LOCAL_TAG}"
docker buildx build --platform "${PLATFORM}" \
  --provenance=false \
  --sbom=false \
  -f deploy/docker/Dockerfile.platform \
  -t "${LOCAL_TAG}" \
  --load \
  .

echo "==> size gate (max ${MAX_IMAGE_MB} MB)"
SIZE_BYTES="$(docker image inspect "${LOCAL_TAG}" --format '{{.Size}}')"
SIZE_MB=$(( SIZE_BYTES / 1024 / 1024 ))
echo "  ${LOCAL_TAG} = ${SIZE_MB} MB (${SIZE_BYTES} bytes)"
if [[ "${SIZE_MB}" -gt "${MAX_IMAGE_MB}" ]]; then
  echo "ERROR: image ${SIZE_MB} MB exceeds MAX_IMAGE_MB=${MAX_IMAGE_MB}." >&2
  echo "  Likely media leaked into the image (check .dockerignore: **/*.mp4, **/video/)." >&2
  echo "  Refusing to push. Override only if intentional: MAX_IMAGE_MB=${SIZE_MB} $0" >&2
  exit 1
fi

echo "==> tag + classic docker push (Docker v2 manifest, no OCI index)"
docker tag "${LOCAL_TAG}" "${IMAGE}"
docker tag "${LOCAL_TAG}" "${LATEST}"
docker push "${IMAGE}"
docker push "${LATEST}"

echo "==> verify remote manifest (expect single manifest, not index)"
if docker buildx imagetools inspect "${IMAGE}" 2>/dev/null | tee /tmp/fde-dis-cloud-inspect.txt | grep -qi 'MediaType:.*index'; then
  echo "ERROR: remote still looks like an OCI index:" >&2
  head -40 /tmp/fde-dis-cloud-inspect.txt >&2
  exit 1
fi
# Prefer Schema2 / single-platform image media type
docker buildx imagetools inspect "${IMAGE}" | head -60 || true

cat <<EOF

Done.
  image: ${IMAGE}
  latest: ${LATEST}
  local: ${LOCAL_TAG}

Next:
  NS=dis-cloud TAG=${TAG} ./scripts/deploy_dis_cloud.sh
  NS=dis-cloud TAG=${TAG} ./scripts/run_dis_cloud_init_jobs.sh   # first deploy only

EOF
