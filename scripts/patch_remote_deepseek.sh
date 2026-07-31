#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

HOST="${FDE_DEPLOY_HOST:-192.168.0.138}"
USER="${FDE_DEPLOY_USER:-qingjiuzys}"
REMOTE_DIR="${FDE_DEPLOY_DIR:-fde-platform}"
PASS="${FDE_DEPLOY_PASSWORD:?set FDE_DEPLOY_PASSWORD}"

DEEPSEEK_API_KEY="$(grep '^DEEPSEEK_API_KEY=' .env | cut -d= -f2-)"
DEEPSEEK_API_BASE="$(grep '^DEEPSEEK_API_BASE=' .env | cut -d= -f2-)"
DEEPSEEK_MODEL="$(grep '^DEEPSEEK_MODEL=' .env | cut -d= -f2-)"
[[ -n "${DEEPSEEK_API_KEY}" ]] || { echo "DEEPSEEK_API_KEY empty in .env" >&2; exit 1; }

SSH_BASE=(ssh -o StrictHostKeyChecking=accept-new -o ConnectTimeout=15
  -o PreferredAuthentications=password -o PubkeyAuthentication=no)

remote() {
  expect <<EOF
set timeout 300
spawn ${SSH_BASE[*]} $USER@$HOST $1
expect {
  -re "(?i)password:" { send "$PASS\r"; exp_continue }
  eof
}
catch wait result
exit [lindex \$result 3]
EOF
}

echo "==> rsync compose + patch script"
expect <<EOF
set timeout 120
spawn rsync -az deploy/docker/docker-compose.prod.yml deploy/docker/.env.prod.example deploy/docker/patch-deepseek.sh -e "${SSH_BASE[*]}" $USER@$HOST:$REMOTE_DIR/deploy/docker/
expect {
  -re "(?i)password:" { send "$PASS\r"; exp_continue }
  eof
}
catch wait result
exit [lindex \$result 3]
EOF

echo "==> apply DeepSeek on remote"
remote "bash $REMOTE_DIR/deploy/docker/patch-deepseek.sh ${DEEPSEEK_API_KEY} ${DEEPSEEK_API_BASE} ${DEEPSEEK_MODEL}"

echo ""
echo "DeepSeek configured: http://${HOST}/app/"
