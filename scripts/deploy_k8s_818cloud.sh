#!/usr/bin/env bash
# Helm deploy to 818cloud K8s (namespace fde-study).
#
# Prerequisites:
#   1. kubectl context points at 818cloud cluster
#   2. Secret fde-platform-secrets created in fde-study (see deploy/k8s/818cloud/README.md)
#   3. Images pushed via scripts/push_k8s_images_818cloud.sh
#
# Usage:
#   TAG=v0.7.0-20260803 ./scripts/deploy_k8s_818cloud.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CHART="${ROOT}/deploy/helm/fde-platform"
NS="${NS:-fde-study}"
RELEASE="${RELEASE:-fde}"
TAG="${TAG:-$(git rev-parse --short HEAD 2>/dev/null || date +%Y%m%d)}"

if ! kubectl get ns "${NS}" >/dev/null 2>&1; then
  echo "==> create namespace ${NS}"
  kubectl create namespace "${NS}"
fi

echo "==> helm upgrade --install ${RELEASE} (tag api-${TAG} / web-${TAG})"
helm upgrade --install "${RELEASE}" "${CHART}" \
  -n "${NS}" \
  -f "${CHART}/values-818cloud.yaml" \
  --set "image.api.tag=api-${TAG}" \
  --set "image.worker.tag=api-${TAG}" \
  --set "image.migrate.tag=api-${TAG}" \
  --set "image.web.tag=web-${TAG}" \
  --wait --timeout 15m --atomic

echo ""
echo "==> rollout"
kubectl -n "${NS}" rollout status deploy/fde-platform-api --timeout=5m
kubectl -n "${NS}" rollout status deploy/fde-platform-web --timeout=5m
kubectl -n "${NS}" rollout status deploy/fde-platform-worker --timeout=5m || true

HOST="${HOST:-fde.818cloud.com}"
echo ""
echo "Verify:"
echo "  curl -sf http://${HOST}/livez"
echo "  curl -sf http://${HOST}/readyz"
echo "  open http://${HOST}/app/"
