#!/usr/bin/env bash
# Start local LingZhi (alongside FDE MinIO) and write ingest creds into FDE .env.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LZ="$(cd "$ROOT/../digital-lingzhi-platform" && pwd)"
DEPLOY="$LZ/deploy"

if [[ ! -f "$DEPLOY/docker-compose.yml" ]]; then
  echo "missing sibling repo: $LZ" >&2
  exit 1
fi

# Ensure shared MinIO bucket for LingZhi files
cd "$ROOT"
PYTHONPATH=. .venv/bin/python - <<'PY'
import boto3
from botocore.client import Config
c = boto3.client(
    "s3",
    endpoint_url="http://127.0.0.1:9000",
    aws_access_key_id="fdeadmin",
    aws_secret_access_key="fdeadmin123",
    region_name="us-east-1",
    config=Config(signature_version="s3v4", s3={"addressing_style": "path"}),
)
try:
    c.head_bucket(Bucket="lingzhi-files")
except Exception:
    c.create_bucket(Bucket="lingzhi-files")
print("minio bucket lingzhi-files ok")
PY

cd "$DEPLOY"
docker compose -f docker-compose.yml -f docker-compose.fde-ports.yml up -d postgres redis qdrant minio minio-init api worker web
echo "waiting for lingzhi api..."
for i in $(seq 1 60); do
  if curl -sf http://127.0.0.1:8230/api/healthz >/dev/null; then
    break
  fi
  sleep 2
done
curl -sf http://127.0.0.1:8230/api/healthz >/dev/null
docker compose -f docker-compose.yml -f docker-compose.fde-ports.yml exec -T api python /app/scripts/init_admin.py || true

python3 <<'PY'
import json
import httpx
from pathlib import Path

root = Path("'''"$ROOT"'''")
base = "http://127.0.0.1:8230"
c = httpx.Client(base_url=base, timeout=60.0, follow_redirects=True)
c.post("/api/auth/login", json={"email": "admin@lingzhi.local", "password": "changeme123"}).raise_for_status()
code = c.post("/api/v1/client/pairing-code").json()["code"]
reg = c.post(
    "/api/v1/client/register",
    json={"name": "fde-local", "pairing_code": code, "platform": "fde"},
)
reg.raise_for_status()
token = reg.json()["token"]
src = c.post(
    "/api/v1/client/sources",
    headers={"X-Client-Token": token},
    json={"root_path": "/fde/camp-v03", "label": "fde-camp-v03"},
)
src.raise_for_status()
source_id = src.json()["id"]
key = c.post("/api/v2/open/keys", json={"name": "fde-rag", "scopes": ["search", "ask"]})
key.raise_for_status()
api_key = key.json()["key"]

updates = {
    "LINGZHI_BASE_URL": base,
    "LINGZHI_API_KEY": api_key,
    "LINGZHI_CLIENT_TOKEN": token,
    "LINGZHI_SOURCE_ID": source_id,
    "LINGZHI_CAMP_KEYS": f"camp-v03:{api_key}",
}
env_path = root / ".env"
lines = env_path.read_text().splitlines() if env_path.exists() else []
seen = set()
out = []
for line in lines:
    if "=" in line and not line.strip().startswith("#"):
        k = line.split("=", 1)[0].strip()
        if k in updates:
            out.append(f"{k}={updates[k]}")
            seen.add(k)
            continue
    out.append(line)
for k, v in updates.items():
    if k not in seen:
        out.append(f"{k}={v}")
env_path.write_text("\n".join(out) + "\n")
print("wrote", env_path)
print("LINGZHI_SOURCE_ID=", source_id)
print("LINGZHI_API_KEY prefix=", api_key[:12])
PY

echo "LingZhi local ready. Restart FDE api+worker to load .env."
