#!/usr/bin/env bash
# Ensure SSH tunnel to Rancher k3s API (same as anycode.work deploy).
set -euo pipefail

SSH_HOST="${K8S_SSH_HOST:-root@39.98.54.21}"
LOCAL_PORT="${K8S_LOCAL_PORT:-6443}"
REMOTE_PORT="${K8S_REMOTE_PORT:-6443}"

if pgrep -f "ssh.*${LOCAL_PORT}:127.0.0.1:${REMOTE_PORT}.*${SSH_HOST#*@}" >/dev/null 2>&1 || \
   pgrep -f "ssh.*-L ${LOCAL_PORT}:127.0.0.1:${REMOTE_PORT}" >/dev/null 2>&1; then
  echo "==> k8s tunnel already running on localhost:${LOCAL_PORT}"
else
  echo "==> starting SSH tunnel localhost:${LOCAL_PORT} → ${SSH_HOST}:${REMOTE_PORT}"
  ssh -f -N -o BatchMode=yes -o ConnectTimeout=10 \
    -L "${LOCAL_PORT}:127.0.0.1:${REMOTE_PORT}" "${SSH_HOST}"
  sleep 1
fi

export KUBECONFIG="${KUBECONFIG:-$HOME/.kube/config-fde-818cloud}"
kubectl cluster-info >/dev/null
echo "==> kubectl OK (context: $(kubectl config current-context))"
