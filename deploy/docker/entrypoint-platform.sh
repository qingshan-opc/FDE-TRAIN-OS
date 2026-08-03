#!/usr/bin/env bash
# Start API + worker in background, nginx in foreground (single pod).
set -euo pipefail

API_PORT="${FDE_API_PORT:-8760}"

echo "==> starting API on 127.0.0.1:${API_PORT}"
uvicorn services.api.app:app \
  --host 127.0.0.1 \
  --port "${API_PORT}" \
  --log-level info &
API_PID=$!

echo "==> starting worker"
python -m services.worker &
WORKER_PID=$!

cleanup() {
  echo "==> shutting down"
  kill "${API_PID}" "${WORKER_PID}" 2>/dev/null || true
  wait "${API_PID}" "${WORKER_PID}" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# Wait for API before nginx accepts traffic.
for i in $(seq 1 60); do
  if curl -sf "http://127.0.0.1:${API_PORT}/livez" >/dev/null 2>&1; then
    echo "==> API ready"
    break
  fi
  if ! kill -0 "${API_PID}" 2>/dev/null; then
    echo "ERROR: API process exited during startup" >&2
    wait "${API_PID}" || true
    exit 1
  fi
  sleep 1
done

echo "==> starting nginx on :8080"
exec nginx -g 'daemon off;'
