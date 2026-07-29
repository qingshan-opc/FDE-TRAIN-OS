#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export PYTHONPATH="${ROOT}/backend:${ROOT}"
# load .env into process for DATABASE_URL / S3
set -a
[[ -f .env ]] && . ./.env
set +a

echo "== unit =="
.venv/bin/python -m pytest -q backend/tests/test_unit_keys_magic.py backend/tests/test_sandbox.py backend/tests/test_unit_progress_repository.py

echo "== integration (skip if PG/MinIO down) =="
.venv/bin/python -m pytest -q backend/tests/test_jobs_queue.py backend/tests/test_storage_workspace.py backend/tests/test_document_ingest.py

echo "== api contract (skip if api down) =="
.venv/bin/python -m pytest -q backend/tests/test_api_rbac.py

if [[ "${RUN_PLAYWRIGHT:-1}" == "1" ]] && [[ -d e2e/node_modules ]]; then
  echo "== playwright chromium =="
  (cd e2e && npx playwright test --project=chromium)
fi

echo "OK all requested suites finished"
