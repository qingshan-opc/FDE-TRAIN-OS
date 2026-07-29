#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

HOST="${FDE_DEPLOY_HOST:-192.168.0.138}"
USER="${FDE_DEPLOY_USER:-qingjiuzys}"
REMOTE_DIR="${FDE_DEPLOY_DIR:-fde-platform}"
PORT="${FDE_GATEWAY_PORT:-80}"
PASS="${FDE_DEPLOY_PASSWORD:?set FDE_DEPLOY_PASSWORD}"

SSH_BASE=(ssh -o StrictHostKeyChecking=accept-new -o ConnectTimeout=15
  -o PreferredAuthentications=password -o PubkeyAuthentication=no)

remote() {
  expect <<EOF
set timeout 900
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

echo "==> ensure remote dir"
remote "mkdir -p $REMOTE_DIR"

echo "==> rsync"
expect <<EOF
set timeout 900
log_user 1
spawn   rsync -az --delete \
    --exclude .git --exclude .venv --exclude node_modules --exclude web/node_modules \
    --exclude data --exclude __pycache__ --exclude .env --exclude dist --exclude .tools \
  -e "${SSH_BASE[*]}" \
  $ROOT/ $USER@$HOST:$REMOTE_DIR/
expect {
  -re "(?i)password:" { send "$PASS\r"; exp_continue }
  eof
}
catch wait result
exit [lindex \$result 3]
EOF

echo "==> docker compose up"
remote "bash -lc 'chmod +x $REMOTE_DIR/deploy/docker/remote-up.sh && FDE_GATEWAY_PORT=$PORT $REMOTE_DIR/deploy/docker/remote-up.sh'"

echo ""
echo "Done: http://${HOST}:${PORT}/app/"
