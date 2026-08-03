#!/usr/bin/env bash
# Create/update K8s secrets for 818cloud fde-study deploy.
#
# Usage:
#   cp deploy/k8s/818cloud/secret.example.env deploy/k8s/818cloud/.env
#   # edit deploy/k8s/818cloud/.env (DATABASE_URL, MinIO keys, etc.)
#   ./scripts/apply_k8s_secrets_818cloud.sh
#
# WeChat PEMs default to anycode deploy/account-service/secrets/ if present.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
NS="${NS:-fde-study}"
ENV_FILE="${ENV_FILE:-$ROOT/deploy/k8s/818cloud/.env}"
WECHAT_CERT_DIR="${WECHAT_CERT_DIR:-$ROOT/../llm-cli/anycode/deploy/account-service/secrets}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE — copy from deploy/k8s/818cloud/secret.example.env" >&2
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

args=(
  create secret generic fde-platform-secrets
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
[[ -n "${DEEPSEEK_API_KEY:-}" ]] && args+=(--from-literal=DEEPSEEK_API_KEY="$DEEPSEEK_API_KEY")
[[ -n "${LINGZHI_API_KEY:-}" ]] && args+=(--from-literal=LINGZHI_API_KEY="$LINGZHI_API_KEY")
[[ -n "${ANYCODE_API_TOKEN:-}" ]] && args+=(--from-literal=ANYCODE_API_TOKEN="$ANYCODE_API_TOKEN")

if [[ -f "$PRIVATE_KEY" ]]; then
  args+=(--from-file=WECHAT_PAY_PRIVATE_KEY="$PRIVATE_KEY")
else
  echo "WARN: missing WeChat private key: $PRIVATE_KEY" >&2
fi

if [[ -f "$PLATFORM_CERT" ]]; then
  args+=(--from-file=WECHAT_PAY_PLATFORM_CERT="$PLATFORM_CERT")
else
  echo "WARN: missing WeChat platform cert: $PLATFORM_CERT" >&2
fi

kubectl "${args[@]}" --dry-run=client -o yaml | kubectl apply -f -

echo "OK: secret/fde-platform-secrets in namespace $NS"
