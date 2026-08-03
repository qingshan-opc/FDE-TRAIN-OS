#!/usr/bin/env bash
# Upload bootcamp course-media renders + sync day.yaml media_fields to remote.
#
# Usage:
#   FDE_DEPLOY_PASSWORD='***' ./scripts/deploy_bootcamp_media.sh --days 1
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

HOST="${FDE_DEPLOY_HOST:-192.168.0.138}"
USER="${FDE_DEPLOY_USER:-qingjiuzys}"
REMOTE_DIR="${FDE_DEPLOY_DIR:-fde-platform}"
PASS="${FDE_DEPLOY_PASSWORD:?set FDE_DEPLOY_PASSWORD}"
DAYS="${1:-1}"
if [[ "${1:-}" == "--days" ]]; then DAYS="${2:-1}"; fi

SSH_BASE=(ssh -o StrictHostKeyChecking=accept-new -o ConnectTimeout=15
  -o PreferredAuthentications=password -o PubkeyAuthentication=no)

remote() {
  expect <<EOF
set timeout 3600
log_user 1
spawn ${SSH_BASE[*]} $USER@$HOST $1
expect {
  -re "(?i)password:" { send "$PASS\r"; exp_continue }
  eof
}
catch wait result
exit [lindex \$result 3]
EOF
}

rsync_pw() {
  expect <<EOF
set timeout 3600
log_user 1
spawn rsync -az -e "${SSH_BASE[*]}" $1 $USER@$HOST:$2
expect {
  -re "(?i)password:" { send "$PASS\r"; exp_continue }
  eof
}
catch wait result
exit [lindex \$result 3]
EOF
}

STAGING="$ROOT/.upload/deploy-media"
rm -rf "$STAGING"
mkdir -p "$STAGING"

python3 - <<PY
from pathlib import Path
import yaml

ROOT = Path("$ROOT")
days = {int(x) for x in "$DAYS".split(",") if x.strip()}
keys = set()
for p in sorted((ROOT / "class" / "bootcamp").glob("day-*/day.yaml")):
    day_n = int(p.parent.name.split("-")[1])
    if day_n not in days:
        continue
    data = yaml.safe_load(p.read_text(encoding="utf-8")) or {}
    for extra in (data.get("capsule_extra") or {}).values():
        for m in extra.get("media") or []:
            if m.get("object_key"):
                keys.add(m["object_key"])
            if m.get("poster_key"):
                keys.add(m["poster_key"])

def find_local(key: str):
    name = key.rsplit("/", 1)[-1]
    hits = list((ROOT / "class" / "bootcamp").glob(f"day-*/section-*/video/renders/{name}"))
    return max(hits, key=lambda p: p.stat().st_mtime) if hits else None

staging = ROOT / ".upload/deploy-media"
staging.mkdir(parents=True, exist_ok=True)
copied = 0
for key in sorted(keys):
    local = find_local(key)
    if not local:
        print(f"skip (no local) {key}")
        continue
    dest = staging / key.rsplit("/", 1)[-1]
    dest.write_bytes(local.read_bytes())
    copied += 1
    print(f"stage {dest.name}")
print(f"staged {copied} files")
PY

echo "==> rsync scripts"
rsync_pw \
  "\"$ROOT/scripts/sync_course_media_to_minio.py\" \"$ROOT/scripts/sync_bootcamp_media_to_db.py\"" \
  "$REMOTE_DIR/scripts/"
rsync_pw "\"$ROOT/deploy/docker/remote-upload-media.sh\"" "$REMOTE_DIR/deploy/docker/"

IFS=',' read -ra DAY_ARR <<< "$DAYS"
for d in "${DAY_ARR[@]}"; do
  dd=$(printf '%02d' "$d")
  echo "==> rsync day-${dd}/day.yaml"
  rsync_pw "\"$ROOT/class/bootcamp/day-${dd}/day.yaml\"" "$REMOTE_DIR/class/bootcamp/day-${dd}/day.yaml"
done

echo "==> rsync media"
expect <<EOF
set timeout 3600
log_user 1
spawn rsync -av -e "${SSH_BASE[*]}" "$STAGING/" $USER@$HOST:$REMOTE_DIR/.upload/course-media/
expect {
  -re "(?i)password:" { send "$PASS\r"; exp_continue }
  eof
}
EOF

for d in "${DAY_ARR[@]}"; do
  dd=$(printf '%02d' "$d")
  remote "bash -lc '/usr/local/bin/docker cp $REMOTE_DIR/class/bootcamp/day-${dd}/day.yaml fde-platform-api-1:/app/class/bootcamp/day-${dd}/day.yaml'"
done

remote "bash -lc 'bash $REMOTE_DIR/deploy/docker/remote-upload-media.sh $DAYS'"

echo ""
echo "Done: http://${HOST}/app/ Day ${DAYS} videos uploaded."
