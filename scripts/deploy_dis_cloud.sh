#!/usr/bin/env bash
# Deploy FDE platform to dis-cloud/dis-cloud on Rancher k3s.
#
# Usage:
#   TAG=v0.7.0-20260803 ./scripts/deploy_dis_cloud.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=/dev/null
source "$ROOT/scripts/ensure_k8s_tunnel.sh"

REGISTRY="${REGISTRY:-registry.cn-zhangjiakou.aliyuncs.com/818cloud/fde}"
TAG="${TAG:-$(git rev-parse --short HEAD 2>/dev/null || date +%Y%m%d)}"
NS="${NS:-dis-cloud}"
IMAGE="${REGISTRY}:dis-cloud-${TAG}"
MANIFEST_DIR="${ROOT}/deploy/k8s/dis-cloud"

echo "==> apply secrets"
"$ROOT/scripts/apply_k8s_secrets_dis_cloud.sh"

echo "==> apply configmap"
kubectl apply -f "${MANIFEST_DIR}/configmap.yaml"

echo "==> migration job"
kubectl -n "${NS}" delete job dis-cloud-migrate --ignore-not-found
sed "s|dis-cloud-latest|dis-cloud-${TAG}|g" "${MANIFEST_DIR}/migration-job.yaml" | kubectl apply -f -
kubectl -n "${NS}" wait --for=condition=complete job/dis-cloud-migrate --timeout=15m

echo "==> bootstrap job"
kubectl -n "${NS}" delete job dis-cloud-bootstrap --ignore-not-found
sed "s|dis-cloud-latest|dis-cloud-${TAG}|g" "${MANIFEST_DIR}/bootstrap-job.yaml" | kubectl apply -f -
kubectl -n "${NS}" wait --for=condition=complete job/dis-cloud-bootstrap --timeout=20m

echo "==> apply deployment + service + ingress (image: ${IMAGE})"
sed "s|dis-cloud-latest|dis-cloud-${TAG}|g" "${MANIFEST_DIR}/deployment-rancher.yaml" | kubectl apply -f -

echo "==> rollout"
kubectl -n "${NS}" rollout status deployment/dis-cloud --timeout=10m

# After bootstrap: refresh DB from class/bootcamp and backup curriculum JSON to
# MinIO. Bootstrap itself is insert-only (FDE_SEED_OVERWRITE_PACKAGES=0).
if [[ "${SKIP_CURRICULUM_PERSIST:-0}" != "1" ]]; then
  echo "==> persist curriculum to MinIO + refresh DB from bootcamp"
  POD="$(kubectl -n "${NS}" get pods \
    -l 'app=dis-cloud,component!=bootstrap,component!=migrate' \
    --field-selector=status.phase=Running \
    -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || true)"
  if [[ -z "${POD}" ]]; then
    POD="$(kubectl -n "${NS}" get pods \
      -l 'workload.user.cattle.io/workloadselector=deployment-dis-cloud-dis-cloud' \
      --field-selector=status.phase=Running \
      -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || true)"
  fi
  if [[ -n "${POD}" ]]; then
    echo "    pod: ${POD}"
    kubectl -n "${NS}" exec "${POD}" -- \
      python /app/scripts/persist_bootcamp_curriculum.py \
      || echo "WARN: curriculum persist skipped (non-fatal)"
    echo "==> seed/merge landing CMS defaults"
    kubectl -n "${NS}" exec "${POD}" -- \
      python /app/scripts/seed_landing_cms_defaults.py \
      || echo "WARN: landing CMS seed skipped (non-fatal)"
  else
    echo "WARN: no running dis-cloud pod for curriculum persist"
  fi
fi

echo ""
echo "Verify:"
echo "  curl -sf http://fde.818cloud.com/livez"
echo "  open http://fde.818cloud.com/app/"
