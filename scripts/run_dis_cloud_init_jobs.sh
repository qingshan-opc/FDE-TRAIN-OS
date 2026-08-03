#!/usr/bin/env bash
# Run DB migration + bootstrap seed jobs in dis-cloud namespace.
# SQL migrations live inside the image at /app/migrations/*.sql
#
# Usage:
#   NS=dis-cloud TAG=v0.7.0-20260803 ./scripts/run_dis_cloud_init_jobs.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

REGISTRY="${REGISTRY:-registry.cn-zhangjiakou.aliyuncs.com/818cloud/fde}"
TAG="${TAG:-latest}"
NS="${NS:-dis-cloud}"
MANIFEST_DIR="${ROOT}/deploy/k8s/dis-cloud"
IMAGE="${REGISTRY}:dis-cloud-${TAG}"

kubectl get ns "${NS}" >/dev/null 2>&1 || kubectl create namespace "${NS}"

echo "==> migration job (image: ${IMAGE})"
kubectl -n "${NS}" delete job dis-cloud-migrate --ignore-not-found
sed "s|dis-cloud-latest|dis-cloud-${TAG}|g" "${MANIFEST_DIR}/migration-job.yaml" | kubectl apply -f -
kubectl -n "${NS}" wait --for=condition=complete job/dis-cloud-migrate --timeout=10m

echo "==> bootstrap job (seed curriculum + MinIO buckets)"
kubectl -n "${NS}" delete job dis-cloud-bootstrap --ignore-not-found
sed "s|dis-cloud-latest|dis-cloud-${TAG}|g" "${MANIFEST_DIR}/bootstrap-job.yaml" | kubectl apply -f -
kubectl -n "${NS}" wait --for=condition=complete job/dis-cloud-bootstrap --timeout=15m

echo "OK: migration + bootstrap complete"
