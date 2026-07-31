#!/usr/bin/env bash
# Run on 192.168.0.138 after deploy — merge DeepSeek vars into .env.prod and restart api.
set -euo pipefail
KEY="${1:?DEEPSEEK_API_KEY required}"
BASE="${2:-https://api.deepseek.com}"
MODEL="${3:-deepseek-v4-flash}"
ROOT="${HOME}/fde-platform"
COMPOSE="${ROOT}/.tools/docker-compose"
DIR="${ROOT}/deploy/docker"

cd "${DIR}"
test -f .env.prod || cp .env.prod.example .env.prod

upsert() {
  local k="$1" v="$2"
  if grep -q "^${k}=" .env.prod; then
    if sed --version 2>/dev/null | grep -q GNU; then
      sed -i "s|^${k}=.*|${k}=${v}|" .env.prod
    else
      sed -i.bak "s|^${k}=.*|${k}=${v}|" .env.prod
    fi
  else
    echo "${k}=${v}" >> .env.prod
  fi
}

upsert DEEPSEEK_API_KEY "${KEY}"
upsert DEEPSEEK_API_BASE "${BASE}"
upsert DEEPSEEK_MODEL "${MODEL}"

"${COMPOSE}" -p fde-platform -f docker-compose.prod.yml --env-file .env.prod up -d api
sleep 10
curl -sf "http://127.0.0.1:80/livez" && echo " livez ok"
