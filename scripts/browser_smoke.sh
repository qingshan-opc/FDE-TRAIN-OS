#!/usr/bin/env bash
# Health curl smoke + optional Playwright Chromium if e2e/ is installed.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BASE="${FDE_INTERNAL_BASE:-http://127.0.0.1:8760}"

echo "== curl livez =="
curl -sf "$BASE/livez" | head -c 200
echo

echo "== curl healthz =="
curl -sf "$BASE/healthz" | python3 -m json.tool >/dev/null
echo OK

echo "== curl readyz (may 503 if PG/MinIO down) =="
set +e
READY=$(curl -s -o /tmp/fde-readyz.json -w "%{http_code}" "$BASE/readyz")
set -e
echo "readyz HTTP $READY"
python3 -m json.tool </tmp/fde-readyz.json 2>/dev/null || cat /tmp/fde-readyz.json
echo

if [[ -d "$ROOT/e2e/node_modules/@playwright/test" ]]; then
  echo "== playwright chromium =="
  (cd "$ROOT/e2e" && npx playwright test --project=chromium)
else
  echo "== playwright skipped (run: cd e2e && npm install && npx playwright install chromium) =="
fi

echo "browser_smoke done"
