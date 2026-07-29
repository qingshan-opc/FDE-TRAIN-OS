#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -d .venv ]]; then
  python3 -m venv .venv
  .venv/bin/pip install -q -r requirements-skeleton.txt
fi
# shellcheck disable=SC1091
source .venv/bin/activate

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "created .env from example"
fi

# Optional infra
if command -v docker >/dev/null 2>&1; then
  if [[ "${FDE_START_COMPOSE:-0}" == "1" ]]; then
    docker compose up -d postgres minio || true
    export DATABASE_URL="${DATABASE_URL:-postgresql://fde:fde@127.0.0.1:5433/fde}"
  fi
fi

export FDE_ENV="${FDE_ENV:-dev}"
# backend/ holds the `services` package; repo root still needed for `sim` etc.
export PYTHONPATH="${ROOT}/backend:${ROOT}${PYTHONPATH:+:$PYTHONPATH}"
export FDE_INTERNAL_BASE="${FDE_INTERNAL_BASE:-http://127.0.0.1:8760}"
export AGENT_MODE="${AGENT_MODE:-auto}"
PORT="${FDE_API_PORT:-8760}"

# free port
if lsof -tiTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  lsof -tiTCP:"$PORT" -sTCP:LISTEN | xargs kill -9 || true
  sleep 0.5
fi

WORKER_PID=""
cleanup() {
  if [[ -n "$WORKER_PID" ]] && kill -0 "$WORKER_PID" 2>/dev/null; then
    echo "Stopping FDE worker (pid $WORKER_PID)"
    kill "$WORKER_PID" 2>/dev/null || true
    wait "$WORKER_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

mkdir -p "$ROOT/data"
echo "Starting FDE worker (AGENT_MODE=$AGENT_MODE) in background"
python -m services.worker >>"$ROOT/data/worker.log" 2>&1 &
WORKER_PID=$!
echo "$WORKER_PID" >"$ROOT/data/worker.pid"
echo "worker pid=$WORKER_PID (logs: data/worker.log)"

echo "Starting FDE API on :$PORT"
# Note: intentionally NOT `exec`'d — an exec would replace this shell process,
# so the EXIT trap above (which stops the background worker) would never run.
uvicorn services.api.app:app --host 127.0.0.1 --port "$PORT"
