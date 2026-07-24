#!/usr/bin/env bash
set -euo pipefail
BASE="${FDE_INTERNAL_BASE:-http://127.0.0.1:8760}"

echo "== healthz =="
curl -sf "$BASE/healthz" | python3 -m json.tool >/dev/null
echo OK

echo "== login =="
LOGIN=$(curl -sf -X POST "$BASE/api/v1/auth/login" -H 'Content-Type: application/json' \
  -d '{"email":"demo@fde.local","password":"demo1234","camp_id":"camp-v03"}')
TOKEN=$(echo "$LOGIN" | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")
LEARNER_ID=$(echo "$LOGIN" | python3 -c "import sys,json; print(json.load(sys.stdin)['user']['id'])")
AUTH="Authorization: Bearer $TOKEN"

echo "== day package =="
curl -sf -H "$AUTH" "$BASE/api/v1/camps/camp-v03/days/1" | python3 -c "import sys,json; d=json.load(sys.stdin); assert d['lab']['runner']=='agent'; print(d['title'])"

echo "== complete learn =="
curl -sf -X POST -H "$AUTH" -H 'Content-Type: application/json' \
  "$BASE/api/v1/nodes/d1-learn/complete" \
  -d "{\"camp_id\":\"camp-v03\",\"day\":1,\"learner_id\":\"$LEARNER_ID\"}" >/dev/null

echo "== quiz =="
curl -sf -X POST -H "$AUTH" -H 'Content-Type: application/json' \
  "$BASE/api/v1/quiz/submit" \
  -d "{\"camp_id\":\"camp-v03\",\"day\":1,\"node_id\":\"d1-quiz\",\"learner_id\":\"$LEARNER_ID\",\"answers\":[0,1,1]}" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); assert d['pass'] is True; print('quiz', d['score'])"

echo "== agent job =="
curl -sf -X POST -H "$AUTH" -H 'Content-Type: application/json' \
  "$BASE/api/v1/agent/workspaces/ensure" \
  -d "{\"camp_id\":\"camp-v03\",\"learner_id\":\"$LEARNER_ID\"}" >/dev/null
JOB=$(curl -sf -X POST -H "$AUTH" -H 'Content-Type: application/json' \
  "$BASE/api/v1/agent/jobs" \
  -d "{\"camp_id\":\"camp-v03\",\"learner_id\":\"$LEARNER_ID\",\"prompt\":\"生成库存列表页\",\"force_stub\":true}")
JID=$(echo "$JOB" | python3 -c "import sys,json; print(json.load(sys.stdin)['job_id'])")
for i in $(seq 1 20); do
  ST=$(curl -sf -H "$AUTH" "$BASE/api/v1/agent/jobs/$JID" | python3 -c "import sys,json; print(json.load(sys.stdin)['status'])")
  [[ "$ST" == "succeeded" || "$ST" == "failed" ]] && break
  sleep 0.3
done
[[ "$ST" == "succeeded" ]] || { echo "job status=$ST"; exit 1; }

echo "== eval =="
curl -sf -X POST -H "$AUTH" -H 'Content-Type: application/json' \
  "$BASE/api/v1/eval/run" \
  -d "{\"runner\":\"agent\",\"job_id\":\"$JID\",\"learner_id\":\"$LEARNER_ID\",\"day\":1,\"node_id\":\"d1-lab\",\"rubric\":[{\"check\":\"file_exists\",\"args\":{\"path\":\"index.html\"}},{\"check\":\"text_contains\",\"args\":{\"path\":\"index.html\",\"needle\":\"库存\"}}]}" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); assert d['result']['pass'] is True; print('eval pass')"

echo "== evidence + passport =="
curl -sf -X POST -H "$AUTH" -H 'Content-Type: application/json' \
  "$BASE/api/v1/evidence" \
  -d "{\"learner_id\":\"$LEARNER_ID\",\"day\":1,\"node_id\":\"d1-lab\",\"kind\":\"agent\",\"capability_tags\":[\"agent:workspace\"],\"payload\":{\"job_id\":\"$JID\"}}" >/dev/null
curl -sf -X POST -H "$AUTH" -H 'Content-Type: application/json' \
  "$BASE/api/v1/nodes/d1-lab/complete" \
  -d "{\"camp_id\":\"camp-v03\",\"day\":1,\"learner_id\":\"$LEARNER_ID\"}" >/dev/null
curl -sf -H "$AUTH" "$BASE/api/v1/learners/$LEARNER_ID/passport" | python3 -c "import sys,json; d=json.load(sys.stdin); assert d['tracks']['agent'] is True; print(d['cert_id'])"

echo "== UI =="
curl -sf -o /dev/null "$BASE/app/"
curl -sf -o /dev/null "$BASE/author/"
echo "SMOKE OK"
