#!/usr/bin/env bash
# Start FDE API (uvicorn) on FDE_API_PORT (default 8760).
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

export FDE_ENV="${FDE_ENV:-dev}"
export PYTHONPATH="$ROOT"
export FDE_INTERNAL_BASE="${FDE_INTERNAL_BASE:-http://127.0.0.1:8760}"
PORT="${FDE_API_PORT:-8760}"

if lsof -tiTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "port $PORT already in use — refusing to kill (use scripts/start.sh to force)"
  exit 1
fi

echo "Starting FDE API on :$PORT"
exec uvicorn services.api.app:app --host 127.0.0.1 --port "$PORT"
