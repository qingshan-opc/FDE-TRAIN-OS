#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export PYTHONPATH="$ROOT"
# load .env into process for DATABASE_URL / S3
set -a
[[ -f .env ]] && . ./.env
set +a

echo "== unit =="
.venv/bin/python -m pytest -q tests/test_unit_keys_magic.py tests/test_sandbox.py

echo "== integration (skip if PG/MinIO down) =="
.venv/bin/python -m pytest -q tests/test_jobs_queue.py tests/test_storage_workspace.py tests/test_document_ingest.py

echo "== api contract (skip if api down) =="
.venv/bin/python -m pytest -q tests/test_api_rbac.py

if [[ "${RUN_PLAYWRIGHT:-1}" == "1" ]] && [[ -d e2e/node_modules ]]; then
  echo "== playwright chromium =="
  (cd e2e && npx playwright test --project=chromium)
fi

echo "OK all requested suites finished"
