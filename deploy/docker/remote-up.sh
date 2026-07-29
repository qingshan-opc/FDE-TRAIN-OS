#!/usr/bin/env bash
set -euo pipefail
ROOT="${HOME}/fde-platform"
PORT="${FDE_GATEWAY_PORT:-80}"
COMPOSE_BIN="${ROOT}/.tools/docker-compose"

mkdir -p "${ROOT}/.tools"
if [[ ! -x "${COMPOSE_BIN}" ]]; then
  echo "==> install docker compose standalone"
  COMPOSE_URL="${COMPOSE_URL:-https://mirror.ghproxy.com/https://github.com/docker/compose/releases/download/v2.27.1/docker-compose-darwin-x86_64}"
  if ! curl -fsSL -o "${COMPOSE_BIN}" "${COMPOSE_URL}"; then
    curl -fsSL -o "${COMPOSE_BIN}" \
      "https://github.com/docker/compose/releases/download/v2.27.1/docker-compose-darwin-x86_64"
  fi
  chmod +x "${COMPOSE_BIN}"
fi
if [[ ! -x "${COMPOSE_BIN}" ]]; then
  echo "ERROR: docker compose not found at ${COMPOSE_BIN}" >&2
  exit 1
fi

cd "${ROOT}/deploy/docker"
FDE_GATEWAY_PORT="${FDE_GATEWAY_PORT:-80}"
test -f .env.prod || cp .env.prod.example .env.prod
if grep -q '^FDE_GATEWAY_PORT=' .env.prod; then
  sed -i.bak "s/^FDE_GATEWAY_PORT=.*/FDE_GATEWAY_PORT=${FDE_GATEWAY_PORT}/" .env.prod 2>/dev/null || \
    sed -i '' "s/^FDE_GATEWAY_PORT=.*/FDE_GATEWAY_PORT=${FDE_GATEWAY_PORT}/" .env.prod
else
  echo "FDE_GATEWAY_PORT=${FDE_GATEWAY_PORT}" >> .env.prod
fi
if grep -q '^FDE_COOKIE_SECURE=' .env.prod; then
  sed -i.bak "s/^FDE_COOKIE_SECURE=.*/FDE_COOKIE_SECURE=0/" .env.prod 2>/dev/null || \
    sed -i '' "s/^FDE_COOKIE_SECURE=.*/FDE_COOKIE_SECURE=0/" .env.prod
else
  echo "FDE_COOKIE_SECURE=0" >> .env.prod
fi

"${COMPOSE_BIN}" -p fde-platform -f docker-compose.prod.yml --env-file .env.prod build
"${COMPOSE_BIN}" -p fde-platform -f docker-compose.prod.yml --env-file .env.prod pull postgres minio gateway 2>/dev/null || true
"${COMPOSE_BIN}" -p fde-platform -f docker-compose.prod.yml --env-file .env.prod up -d
"${COMPOSE_BIN}" -p fde-platform -f docker-compose.prod.yml --env-file .env.prod ps

curl -sf "http://127.0.0.1:${PORT}/livez" && echo " livez ok"
curl -sf "http://127.0.0.1:${PORT}/readyz" | head -c 240 || true
echo
