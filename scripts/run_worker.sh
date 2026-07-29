#!/usr/bin/env bash
# Start FDE background worker (agent jobs + document ingest).
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
export PYTHONPATH="${ROOT}/backend:${ROOT}"
export AGENT_MODE="${AGENT_MODE:-auto}"

echo "Starting FDE worker (AGENT_MODE=$AGENT_MODE)"
exec python -m services.worker
