#!/usr/bin/env bash
# Ensure exactly one FDE worker is running (idempotent).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -d .venv ]]; then
  echo "missing .venv — run scripts/start.sh once first" >&2
  exit 1
fi
# shellcheck disable=SC1091
source .venv/bin/activate

export FDE_ENV="${FDE_ENV:-dev}"
export PYTHONPATH="$ROOT"
export AGENT_MODE="${AGENT_MODE:-auto}"

mkdir -p "$ROOT/data"
PID_FILE="$ROOT/data/worker.pid"

# Stop any stray workers (stale pid file, duplicate nohup runs, etc.)
for _ in 1 2 3 4 5; do
  pids=$(pgrep -f "[P]ython.*services\.worker" || true)
  if [[ -z "$pids" ]]; then
    break
  fi
  echo "$pids" | xargs kill 2>/dev/null || true
  sleep 0.8
done
if pgrep -f "[P]ython.*services\.worker" >/dev/null; then
  echo "could not stop existing worker processes" >&2
  pgrep -fl "services.worker" >&2 || true
  exit 1
fi

nohup python -m services.worker >>"$ROOT/data/worker.log" 2>&1 &
NEW_PID=$!
echo "$NEW_PID" >"$PID_FILE"
sleep 1

if kill -0 "$NEW_PID" 2>/dev/null; then
  echo "worker pid=$NEW_PID (logs: data/worker.log)"
else
  echo "worker failed to start — see data/worker.log" >&2
  exit 1
fi
