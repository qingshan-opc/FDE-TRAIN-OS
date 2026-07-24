#!/usr/bin/env bash
# Camp Day1–12 curriculum smoke (721)
set -euo pipefail
BASE="${FDE_INTERNAL_BASE:-http://127.0.0.1:8760}"

echo "== healthz =="
curl -sf "$BASE/healthz" | python3 -m json.tool >/dev/null

LOGIN=$(curl -sf -X POST "$BASE/api/v1/auth/login" -H 'Content-Type: application/json' \
  -d '{"email":"demo@fde.local","password":"demo1234","camp_id":"camp-v03"}')
TOKEN=$(echo "$LOGIN" | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")
LEARNER_ID=$(echo "$LOGIN" | python3 -c "import sys,json; print(json.load(sys.stdin)['user']['id'])")
AUTH="Authorization: Bearer $TOKEN"

echo "== list days =="
curl -sf -H "$AUTH" "$BASE/api/v1/camps/camp-v03/days" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); assert d['count']>=12; days={x['day'] for x in d['days']}; assert set(range(1,13))<=days; src={x['day']:x['source'] for x in d['days']}; assert all('curriculum' in src[i] for i in range(1,13)); print('days',sorted(days)); print('d2',src[2],'d5',src[5],'runner5',[x['runner'] for x in d['days'] if x['day']==5][0])"

for d in 2 5 7 9 12; do
  echo "== package day $d =="
  curl -sf -H "$AUTH" "$BASE/api/v1/camps/camp-v03/days/$d?learner_id=$LEARNER_ID" \
    | python3 -c "import sys,json; d=json.load(sys.stdin); assert len(d['learn'].get('capsules') or [])==6; assert d['project_brief']; print(d['day'], d['title'], d['lab'].get('runner'), d.get('source'))"
done

echo "== Day1 agent stub =="
curl -sf -X POST -H "$AUTH" -H 'Content-Type: application/json' \
  "$BASE/api/v1/agent/workspaces/ensure" \
  -d "{\"camp_id\":\"camp-v03\",\"learner_id\":\"$LEARNER_ID\"}" >/dev/null
JOB=$(curl -sf -X POST -H "$AUTH" -H 'Content-Type: application/json' \
  "$BASE/api/v1/agent/jobs" \
  -d "{\"camp_id\":\"camp-v03\",\"learner_id\":\"$LEARNER_ID\",\"prompt\":\"在工作区生成库存列表页 index.html：标题库存列表与警戒线\",\"force_stub\":true}")
JID=$(echo "$JOB" | python3 -c "import sys,json; print(json.load(sys.stdin)['job_id'])")
for _ in $(seq 1 40); do
  ST=$(curl -sf -H "$AUTH" "$BASE/api/v1/agent/jobs/$JID" | python3 -c "import sys,json; print(json.load(sys.stdin)['status'])")
  [[ "$ST" == "succeeded" || "$ST" == "failed" ]] && break
  sleep 0.2
done
[[ "$ST" == "succeeded" ]] || { echo "job=$ST"; exit 1; }
curl -sf -X POST -H "$AUTH" -H 'Content-Type: application/json' \
  "$BASE/api/v1/eval/run" \
  -d "{\"runner\":\"agent\",\"job_id\":\"$JID\",\"learner_id\":\"$LEARNER_ID\",\"day\":1,\"node_id\":\"d1-lab\",\"rubric\":[{\"check\":\"file_exists\",\"args\":{\"path\":\"index.html\"}},{\"check\":\"text_contains\",\"args\":{\"path\":\"index.html\",\"needle\":\"库存\"}}]}" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); assert d['result']['pass'] is True; print('day1 eval ok')"

echo "== Day2 schema stub =="
JOB2=$(curl -sf -X POST -H "$AUTH" -H 'Content-Type: application/json' \
  "$BASE/api/v1/agent/jobs" \
  -d "{\"camp_id\":\"camp-v03\",\"learner_id\":\"$LEARNER_ID\",\"prompt\":\"创建 schema.sql：含 CREATE TABLE products\",\"force_stub\":true}")
JID2=$(echo "$JOB2" | python3 -c "import sys,json; print(json.load(sys.stdin)['job_id'])")
for _ in $(seq 1 40); do
  ST=$(curl -sf -H "$AUTH" "$BASE/api/v1/agent/jobs/$JID2" | python3 -c "import sys,json; print(json.load(sys.stdin)['status'])")
  [[ "$ST" == "succeeded" || "$ST" == "failed" ]] && break
  sleep 0.2
done
curl -sf -X POST -H "$AUTH" -H 'Content-Type: application/json' \
  "$BASE/api/v1/eval/run" \
  -d "{\"runner\":\"agent\",\"job_id\":\"$JID2\",\"learner_id\":\"$LEARNER_ID\",\"day\":2,\"rubric\":[{\"check\":\"file_exists\",\"args\":{\"path\":\"schema.sql\"}},{\"check\":\"text_contains\",\"args\":{\"path\":\"schema.sql\",\"needle\":\"products\"}}]}" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); assert d['result']['pass'] is True; print('day2 eval ok')"

echo "== Day5 sim =="
python3 - <<PY
import json, urllib.request
BASE = "$BASE"
AUTH = "$AUTH"
LEARNER_ID = "$LEARNER_ID"

def req(method, path, body=None):
    data = None if body is None else json.dumps(body).encode()
    r = urllib.request.Request(BASE + path, data=data, method=method, headers={"Authorization": AUTH, "Content-Type": "application/json"})
    with urllib.request.urlopen(r) as resp:
        return json.load(resp)

day = req("GET", f"/api/v1/camps/camp-v03/days/5?learner_id={LEARNER_ID}")
assert day["lab"]["runner"] == "sim"
sid = req("POST", "/api/v1/sim/sessions", {"sim_kind": day["lab"]["sim_kind"], "task_spec": {"lab": day["lab"]}, "learner_seed": {"learner_id": LEARNER_ID}})["session_id"]
for cmd in [
    'echo "proxy_pass http://127.0.0.1:3000;" > /etc/nginx/sites-enabled/docs',
    "nginx -t",
    "systemctl reload nginx",
]:
    req("POST", f"/api/v1/sim/sessions/{sid}/actions", {"type": "terminal.exec", "payload": {"cmd": cmd}})
ev = req("POST", "/api/v1/eval/run", {"runner": "sim", "sim_session_id": sid, "learner_id": LEARNER_ID, "day": 5, "node_id": "d5-lab", "rubric": day["lab"]["rubric"]})
assert ev["result"]["pass"] is True, ev
print("day5 sim ok", ev["result"]["checks"])
PY

echo "== Day7 arch sim =="
python3 - <<PY
import json, urllib.request
BASE = "$BASE"
AUTH = "$AUTH"
LEARNER_ID = "$LEARNER_ID"

def req(method, path, body=None):
    data = None if body is None else json.dumps(body).encode()
    r = urllib.request.Request(BASE + path, data=data, method=method, headers={"Authorization": AUTH, "Content-Type": "application/json"})
    with urllib.request.urlopen(r) as resp:
        return json.load(resp)

day = req("GET", f"/api/v1/camps/camp-v03/days/7?learner_id={LEARNER_ID}")
sid = req("POST", "/api/v1/sim/sessions", {"sim_kind": day["lab"]["sim_kind"], "task_spec": {"lab": day["lab"]}, "learner_seed": {}})["session_id"]
for cid in ("api", "warehouse", "auth"):
    req("POST", f"/api/v1/sim/sessions/{sid}/actions", {"type": "canvas.add_node", "payload": {"id": cid, "type": "service"}})
req("POST", f"/api/v1/sim/sessions/{sid}/actions", {"type": "canvas.set_nfr", "payload": {"monthly_cost_usd": 600, "p95_latency_ms": 300, "data_residency": "cn"}})
req("POST", f"/api/v1/sim/sessions/{sid}/actions", {"type": "canvas.set_decision_note", "payload": {"text": "x" * 130}})
ev = req("POST", "/api/v1/eval/run", {"runner": "sim", "sim_session_id": sid, "learner_id": LEARNER_ID, "day": 7, "node_id": "d7-lab", "rubric": day["lab"]["rubric"]})
assert ev["result"]["pass"] is True, ev
print("day7 sim ok")
PY
echo "== UI =="
curl -sf -o /dev/null "$BASE/app/"
test -f "$(dirname "$0")/../docs/spec/0.3/curriculum-721.md"
test -f "$(dirname "$0")/../contracts/examples/day-12-curriculum.yaml"
echo "SMOKE CAMP12 OK"
