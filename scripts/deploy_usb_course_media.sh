#!/usr/bin/env bash
# Upload course videos (e.g. /Volumes/USB/ps) to remote MinIO and sync day_packages media.
#
# Usage:
#   FDE_DEPLOY_PASSWORD='***' ./scripts/deploy_usb_course_media.sh /Volumes/USB/ps
#   FDE_DEPLOY_PASSWORD='***' ./scripts/deploy_usb_course_media.sh /Volumes/USB/ps --days 6,7,8,9
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

HOST="${FDE_DEPLOY_HOST:-192.168.0.138}"
USER="${FDE_DEPLOY_USER:-qingjiuzys}"
REMOTE_DIR="${FDE_DEPLOY_DIR:-fde-platform}"
PASS="${FDE_DEPLOY_PASSWORD:?set FDE_DEPLOY_PASSWORD}"
SOURCE_DIR="${1:?usage: $0 /path/to/mp4-dir [--days 6,7,8,9]}"
shift
DAYS="${1:-6,7,8,9}"
if [[ "$DAYS" == "--days" ]]; then
  DAYS="${2:-6,7,8,9}"
fi

SSH_BASE=(ssh -o StrictHostKeyChecking=accept-new -o ConnectTimeout=15
  -o PreferredAuthentications=password -o PubkeyAuthentication=no)
REMOTE_UPLOAD="$REMOTE_DIR/.upload/course-media"

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

echo "==> rsync upload scripts"
expect <<EOF
set timeout 120
log_user 1
spawn rsync -az \
  -e "${SSH_BASE[*]}" \
  "$ROOT/scripts/sync_course_media_to_minio.py" \
  "$ROOT/scripts/sync_bootcamp_media_to_db.py" \
  $USER@$HOST:$REMOTE_DIR/scripts/
spawn rsync -az \
  -e "${SSH_BASE[*]}" \
  "$ROOT/deploy/docker/remote-upload-media.sh" \
  $USER@$HOST:$REMOTE_DIR/deploy/docker/
expect {
  -re "(?i)password:" { send "$PASS\r"; exp_continue }
  eof
}
catch wait result
exit [lindex \$result 3]
EOF

remote "chmod +x $REMOTE_DIR/deploy/docker/remote-upload-media.sh"

echo "==> rsync videos to $HOST:$REMOTE_UPLOAD"
expect <<EOF
set timeout 3600
log_user 1
spawn rsync -av --progress --include='*.mp4' --exclude='*' \
  -e "${SSH_BASE[*]}" \
  "$SOURCE_DIR/" $USER@$HOST:$REMOTE_UPLOAD/
expect {
  -re "(?i)password:" { send "$PASS\r"; exp_continue }
  eof
}
catch wait result
exit [lindex \$result 3]
EOF

echo "==> upload MinIO + sync DB (days=$DAYS)"
remote "bash -lc 'bash $REMOTE_DIR/deploy/docker/remote-upload-media.sh $DAYS'"

echo ""
echo "Done. Open http://${HOST}/app/ → Day6+ capsules should play uploaded videos."
