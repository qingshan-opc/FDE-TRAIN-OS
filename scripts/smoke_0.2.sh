#!/usr/bin/env bash
set -euo pipefail
BASE="${FDE_INTERNAL_BASE:-http://127.0.0.1:8760}"

echo "== 0.2 healthz =="
curl -sf "$BASE/healthz" | python3 -m json.tool >/dev/null
echo OK

echo "== login =="
LOGIN=$(curl -sf -X POST "$BASE/api/v1/auth/login" -H 'Content-Type: application/json' \
  -d '{"email":"demo@fde.local","password":"demo1234","camp_id":"camp-v03"}')
TOKEN=$(echo "$LOGIN" | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")
LEARNER_ID=$(echo "$LOGIN" | python3 -c "import sys,json; print(json.load(sys.stdin)['user']['id'])")
AUTH="Authorization: Bearer $TOKEN"

echo "== Day1 package =="
curl -sf -H "$AUTH" "$BASE/api/v1/camps/camp-v03/days/1?learner_id=$LEARNER_ID" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); assert d['lab']['runner']=='agent'; assert d['learn'].get('steps'); print(d['title'])"

satisfy_learn_gate() {
  # M7: `learn` completion is gated on every capsule being opened *and*
  # every required `practice` being submitted — mirror what CapsuleReader
  # does client-side before letting the smoke test call `nodes/{id}/complete`.
  local day="$1"
  BASE="$BASE" TOKEN="$TOKEN" LEARNER_ID="$LEARNER_ID" DAY="$day" python3 - <<'PYEOF'
import json
import os
import urllib.request

base = os.environ["BASE"]
token = os.environ["TOKEN"]
learner_id = os.environ["LEARNER_ID"]
day = int(os.environ["DAY"])
camp_id = "camp-v03"


def _call(method, path, body=None):
    req = urllib.request.Request(
        f"{base}{path}",
        data=json.dumps(body).encode("utf-8") if body is not None else None,
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {token}"},
        method=method,
    )
    with urllib.request.urlopen(req) as resp:
        return json.load(resp)


pkg = _call("GET", f"/api/v1/camps/{camp_id}/days/{day}?learner_id={learner_id}")
capsules = (pkg.get("learn") or {}).get("capsules") or []
for i, c in enumerate(capsules):
    cid = c.get("id") or f"c{i + 1}"
    _call("POST", "/api/v1/capsules/progress", {"camp_id": camp_id, "day": day, "capsule_id": cid, "learner_id": learner_id})
    practice = c.get("practice")
    if isinstance(practice, str):
        required = bool(practice.strip())
    elif isinstance(practice, dict):
        required = bool(practice.get("required"))
    else:
        required = False
    if required:
        _call(
            "PUT",
            "/api/v1/practice",
            {"camp_id": camp_id, "day": day, "capsule_id": cid, "response_text": "烟测练习答案", "status": "submitted"},
        )
print(f"satisfied learn gate for day {day}: {len(capsules)} capsules")
PYEOF
}

echo "== Day1 learn =="
satisfy_learn_gate 1
curl -sf -X POST -H "$AUTH" -H 'Content-Type: application/json' \
  "$BASE/api/v1/nodes/d1-learn/complete" \
  -d "{\"camp_id\":\"camp-v03\",\"day\":1,\"learner_id\":\"$LEARNER_ID\"}" >/dev/null

echo "== Day1 quiz =="
curl -sf -X POST -H "$AUTH" -H 'Content-Type: application/json' \
  "$BASE/api/v1/quiz/submit" \
  -d "{\"camp_id\":\"camp-v03\",\"day\":1,\"node_id\":\"d1-quiz\",\"learner_id\":\"$LEARNER_ID\",\"answers\":[0,1,1]}" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); assert d['pass'] is True; print('quiz', d['score'])"

echo "== Day1 agent =="
curl -sf -X POST -H "$AUTH" -H 'Content-Type: application/json' \
  "$BASE/api/v1/agent/workspaces/ensure" \
  -d "{\"camp_id\":\"camp-v03\",\"learner_id\":\"$LEARNER_ID\"}" >/dev/null
JOB=$(curl -sf -X POST -H "$AUTH" -H 'Content-Type: application/json' \
  "$BASE/api/v1/agent/jobs" \
  -d "{\"camp_id\":\"camp-v03\",\"learner_id\":\"$LEARNER_ID\",\"prompt\":\"生成库存列表页\",\"force_stub\":true}")
JID=$(echo "$JOB" | python3 -c "import sys,json; print(json.load(sys.stdin)['job_id'])")
for _ in $(seq 1 30); do
  ST=$(curl -sf -H "$AUTH" "$BASE/api/v1/agent/jobs/$JID" | python3 -c "import sys,json; print(json.load(sys.stdin)['status'])")
  [[ "$ST" == "succeeded" || "$ST" == "failed" ]] && break
  sleep 0.25
done
[[ "$ST" == "succeeded" ]] || { echo "job=$ST"; exit 1; }

echo "== Day1 eval =="
EVAL=$(curl -sf -X POST -H "$AUTH" -H 'Content-Type: application/json' \
  "$BASE/api/v1/eval/run" \
  -d "{\"runner\":\"agent\",\"job_id\":\"$JID\",\"learner_id\":\"$LEARNER_ID\",\"day\":1,\"node_id\":\"d1-lab\",\"write_evidence\":false,\"rubric\":[{\"check\":\"file_exists\",\"args\":{\"path\":\"index.html\"}},{\"check\":\"text_contains\",\"args\":{\"path\":\"index.html\",\"needle\":\"库存\"}}]}")
echo "$EVAL" | python3 -c "import sys,json; d=json.load(sys.stdin); assert d['result']['pass'] is True; print('eval pass')"
EVAL_RESULT=$(echo "$EVAL" | python3 -c "import sys,json; print(json.dumps(json.load(sys.stdin)['result']))")

echo "== Day1 lab complete (atomic: submission + evidence + node_progress) =="
curl -sf -X POST -H "$AUTH" -H 'Content-Type: application/json' \
  "$BASE/api/v1/labs/complete" \
  -d "{\"camp_id\":\"camp-v03\",\"day\":1,\"node_id\":\"d1-lab\",\"learner_id\":\"$LEARNER_ID\",\"job_id\":\"$JID\",\"eval_result\":$EVAL_RESULT}" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); assert d['status'] == 'passed'; print('lab complete', d['submission_id'])"

echo "== Day2 package =="
curl -sf -H "$AUTH" "$BASE/api/v1/camps/camp-v03/days/2?learner_id=$LEARNER_ID" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); assert d['lab']['runner']=='agent'; assert 'day-02' in (d.get('source') or ''); print(d['title'], d['source'])"

echo "== Day2 learn+quiz short =="
satisfy_learn_gate 2
curl -sf -X POST -H "$AUTH" -H 'Content-Type: application/json' \
  "$BASE/api/v1/nodes/d2-learn/complete" \
  -d "{\"camp_id\":\"camp-v03\",\"day\":2,\"learner_id\":\"$LEARNER_ID\"}" >/dev/null
curl -sf -X POST -H "$AUTH" -H 'Content-Type: application/json' \
  "$BASE/api/v1/quiz/submit" \
  -d "{\"camp_id\":\"camp-v03\",\"day\":2,\"node_id\":\"d2-quiz\",\"learner_id\":\"$LEARNER_ID\",\"answers\":[0,1,1]}" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); assert d['pass'] is True; print('day2 quiz', d['score'])"

echo "== passport =="
curl -sf -H "$AUTH" "$BASE/api/v1/learners/$LEARNER_ID/passport" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); assert d['tracks']['agent'] is True; print(d['cert_id'])"

echo "== UI =="
curl -sf -o /dev/null "$BASE/app/"
test -f "$(dirname "$0")/../docs/spec/0.2/README.md"
test -f "$(dirname "$0")/../docs/spec/0.2/acceptance.md"
echo "SMOKE 0.2 OK"
