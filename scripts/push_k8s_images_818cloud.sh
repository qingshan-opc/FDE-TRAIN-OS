#!/usr/bin/env bash
# Build and push FDE api/web images to Aliyun ACR (818cloud/fde repo).
#
# Use local tag + classic docker push (Docker Schema2). Do NOT buildx --push or
# imagetools create — those yield OCI indexes; ACR then shows size "-".
#
# Usage:
#   REGISTRY_USER=xxx REGISTRY_PASS=yyy ./scripts/push_k8s_images_818cloud.sh
#   TAG=v0.7.2-20260803 ./scripts/push_k8s_images_818cloud.sh
#
# Images:
#   registry.cn-zhangjiakou.aliyuncs.com/818cloud/fde:api-${TAG}
#   registry.cn-zhangjiakou.aliyuncs.com/818cloud/fde:web-${TAG}
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

REGISTRY="${REGISTRY:-registry.cn-zhangjiakou.aliyuncs.com/818cloud/fde}"
TAG="${TAG:-$(git rev-parse --short HEAD 2>/dev/null || date +%Y%m%d)}"
PLATFORM="${PLATFORM:-linux/amd64}"

API_IMAGE="${REGISTRY}:api-${TAG}"
WEB_IMAGE="${REGISTRY}:web-${TAG}"

build_push() {
  local dockerfile="$1" image="$2" local_tag="$3"
  echo "==> build (${PLATFORM}) ${dockerfile} → local ${local_tag}"
  docker buildx build --platform "${PLATFORM}" \
    --provenance=false \
    --sbom=false \
    -f "${dockerfile}" \
    -t "${local_tag}" \
    --load \
    .
  echo "==> classic docker push → ${image}"
  docker tag "${local_tag}" "${image}"
  docker push "${image}"
  if docker buildx imagetools inspect "${image}" 2>/dev/null | grep -qi 'MediaType:.*index'; then
    echo "ERROR: ${image} is still an OCI index" >&2
    docker buildx imagetools inspect "${image}" | head -40 >&2
    exit 1
  fi
}

echo "==> build api  → ${API_IMAGE}"
build_push deploy/docker/Dockerfile.api "${API_IMAGE}" "fde-api-local:${TAG}"

echo "==> build web  → ${WEB_IMAGE}"
build_push deploy/docker/Dockerfile.web "${WEB_IMAGE}" "fde-web-local:${TAG}"

cat <<EOF

Done.
  api: ${API_IMAGE}
  web: ${WEB_IMAGE}

Deploy:
  TAG=${TAG} NS=fde-study ./scripts/deploy_k8s_818cloud.sh

EOF
