#!/usr/bin/env bash
# Week1 Day1–5 package + stub artifact smoke
set -euo pipefail
BASE="${FDE_INTERNAL_BASE:-http://127.0.0.1:8760}"

echo "== healthz =="
curl -sf "$BASE/healthz" >/dev/null

LOGIN=$(curl -sf -X POST "$BASE/api/v1/auth/login" -H 'Content-Type: application/json' \
  -d '{"email":"demo@fde.local","password":"demo1234","camp_id":"camp-v03"}')
TOKEN=$(echo "$LOGIN" | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")
LEARNER_ID=$(echo "$LOGIN" | python3 -c "import sys,json; print(json.load(sys.stdin)['user']['id'])")
AUTH="Authorization: Bearer $TOKEN"

echo "== camp days list =="
curl -sf -H "$AUTH" "$BASE/api/v1/camps/camp-v03/days" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); assert d['count']>=8; days={x['day'] for x in d['days']}; assert {1,2,3,4,5,6,7,8}<=days; print('days', sorted(days))"

run_day_stub() {
  local day=$1
  local prompt=$2
  local path=$3
  local needle=$4
  echo "== Day${day} package+stub =="
  curl -sf -H "$AUTH" "$BASE/api/v1/camps/camp-v03/days/${day}?learner_id=$LEARNER_ID" \
    | python3 -c "import sys,json; d=json.load(sys.stdin); assert d['lab']['runner']=='agent'; print(d['title'], d.get('source'))"
  curl -sf -X POST -H "$AUTH" -H 'Content-Type: application/json' \
    "$BASE/api/v1/agent/workspaces/ensure" \
    -d "{\"camp_id\":\"camp-v03\",\"learner_id\":\"$LEARNER_ID\"}" >/dev/null
  JOB=$(curl -sf -X POST -H "$AUTH" -H 'Content-Type: application/json' \
    "$BASE/api/v1/agent/jobs" \
    -d "{\"camp_id\":\"camp-v03\",\"learner_id\":\"$LEARNER_ID\",\"prompt\":$(python3 -c "import json; print(json.dumps('''$prompt'''))"),\"force_stub\":true}")
  JID=$(echo "$JOB" | python3 -c "import sys,json; print(json.load(sys.stdin)['job_id'])")
  for _ in $(seq 1 40); do
    ST=$(curl -sf -H "$AUTH" "$BASE/api/v1/agent/jobs/$JID" | python3 -c "import sys,json; print(json.load(sys.stdin)['status'])")
    [[ "$ST" == "succeeded" || "$ST" == "failed" ]] && break
    sleep 0.2
  done
  [[ "$ST" == "succeeded" ]] || { echo "day$day job=$ST"; exit 1; }
  curl -sf -X POST -H "$AUTH" -H 'Content-Type: application/json' \
    "$BASE/api/v1/eval/run" \
    -d "{\"runner\":\"agent\",\"job_id\":\"$JID\",\"learner_id\":\"$LEARNER_ID\",\"day\":$day,\"node_id\":\"d${day}-lab\",\"rubric\":[{\"check\":\"file_exists\",\"args\":{\"path\":\"$path\"}},{\"check\":\"text_contains\",\"args\":{\"path\":\"$path\",\"needle\":\"$needle\"}}]}" \
    | python3 -c "import sys,json; d=json.load(sys.stdin); assert d['result']['pass'] is True; print('eval day$day pass')"
}

run_day_stub 1 "生成库存列表页" "index.html" "库存"
run_day_stub 2 "创建线索落地页 index.html：form#lead 与 cta" "index.html" "lead"
run_day_stub 3 "创建 api.html：入库 API 路径 /api/inventory/inbound 方法 POST" "api.html" "inbound"
run_day_stub 4 "创建 inventory.html：含 SKU 与按钮刷新数据" "inventory.html" "SKU"
run_day_stub 5 "创建 deploy-checklist.html：标题上线 SOP 与 .env" "deploy-checklist.html" "SOP"
run_day_stub 6 "创建 rag-faq.html：库存 FAQ，含 RAG 与知识卡片 id=faq" "rag-faq.html" "RAG"
run_day_stub 7 "创建 agent-runtime.html：Agent Runtime，含 workspace job SSE quota，禁止扫盘" "agent-runtime.html" "quota"
run_day_stub 8 "创建 passport-guide.html：Passport 与 rubric evidence" "passport-guide.html" "Passport"

test -f "$(dirname "$0")/../docs/spec/vision-closed-loop.md"
echo "SMOKE WEEK1+2 MID OK"
