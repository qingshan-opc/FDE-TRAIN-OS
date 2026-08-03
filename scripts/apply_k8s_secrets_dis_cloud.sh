#!/usr/bin/env bash
# Create/update K8s secrets for dis-cloud deploy.
#
# Usage:
#   cp deploy/k8s/dis-cloud/secret.example.env deploy/k8s/dis-cloud/.env
#   # edit DATABASE_URL, S3 keys, etc.
#   NS=dis-cloud ./scripts/apply_k8s_secrets_dis_cloud.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=/dev/null
source "$ROOT/scripts/ensure_k8s_tunnel.sh"
NS="${NS:-dis-cloud}"
ENV_FILE="${ENV_FILE:-$ROOT/deploy/k8s/dis-cloud/.env}"
WECHAT_CERT_DIR="${WECHAT_CERT_DIR:-$ROOT/../llm-cli/anycode/deploy/account-service/secrets}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE — copy from deploy/k8s/dis-cloud/secret.example.env" >&2
  exit 1
fi

# shellcheck disable=SC1090
set -a
source "$ENV_FILE"
set +a

for key in JWT_SECRET DATABASE_URL S3_ACCESS_KEY S3_SECRET_KEY; do
  if [[ -z "${!key:-}" ]]; then
    echo "Required key empty in $ENV_FILE: $key" >&2
    exit 1
  fi
done

PRIVATE_KEY="${WECHAT_PRIVATE_KEY:-$WECHAT_CERT_DIR/apiclient_key.pem}"
PLATFORM_CERT="${WECHAT_PLATFORM_CERT:-$WECHAT_CERT_DIR/pub_key.pem}"

kubectl get ns "${NS}" >/dev/null 2>&1 || kubectl create namespace "${NS}"

args=(
  create secret generic dis-cloud-secrets
  -n "$NS"
  --from-literal=JWT_SECRET="$JWT_SECRET"
  --from-literal=DATABASE_URL="$DATABASE_URL"
  --from-literal=S3_ACCESS_KEY="$S3_ACCESS_KEY"
  --from-literal=S3_SECRET_KEY="$S3_SECRET_KEY"
)

[[ -n "${WECHAT_PAY_MCH_ID:-}" ]] && args+=(--from-literal=WECHAT_PAY_MCH_ID="$WECHAT_PAY_MCH_ID")
[[ -n "${WECHAT_PAY_APP_ID:-}" ]] && args+=(--from-literal=WECHAT_PAY_APP_ID="$WECHAT_PAY_APP_ID")
[[ -n "${WECHAT_PAY_SERIAL_NO:-}" ]] && args+=(--from-literal=WECHAT_PAY_SERIAL_NO="$WECHAT_PAY_SERIAL_NO")
[[ -n "${WECHAT_PAY_API_V3_KEY:-}" ]] && args+=(--from-literal=WECHAT_PAY_API_V3_KEY="$WECHAT_PAY_API_V3_KEY")
[[ -n "${WECHAT_APP_SECRET:-}" ]] && args+=(--from-literal=WECHAT_APP_SECRET="$WECHAT_APP_SECRET")
[[ -n "${WECHAT_MP_TOKEN:-}" ]] && args+=(--from-literal=WECHAT_MP_TOKEN="$WECHAT_MP_TOKEN")
[[ -n "${WECHAT_MP_AES_KEY:-}" ]] && args+=(--from-literal=WECHAT_MP_AES_KEY="$WECHAT_MP_AES_KEY")
[[ -n "${DEEPSEEK_API_KEY:-}" ]] && args+=(--from-literal=DEEPSEEK_API_KEY="$DEEPSEEK_API_KEY")

if [[ -f "$PRIVATE_KEY" ]]; then
  args+=(--from-file=WECHAT_PAY_PRIVATE_KEY="$PRIVATE_KEY")
fi
if [[ -f "$PLATFORM_CERT" ]]; then
  args+=(--from-file=WECHAT_PAY_PLATFORM_CERT="$PLATFORM_CERT")
fi

kubectl "${args[@]}" --dry-run=client -o yaml | kubectl apply -f -

echo "OK: secret/dis-cloud-secrets in namespace $NS"
