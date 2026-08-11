#!/usr/bin/env bash
# Remove known oversized dis-cloud image tags (class/ media baked in before .dockerignore).
#
# Default targets: dis-cloud-v0.7.0-20260803, dis-cloud-v0.7.1-20260803 (~2.88GB).
#
# Usage:
#   ./scripts/cleanup_dis_cloud_fat_images.sh
#   TAGS='dis-cloud-v0.7.0-20260803' ./scripts/cleanup_dis_cloud_fat_images.sh
set -euo pipefail

REGISTRY_HOST="${REGISTRY_HOST:-registry.cn-zhangjiakou.aliyuncs.com}"
REPO="${REPO:-818cloud/fde}"
TAGS="${TAGS:-dis-cloud-v0.7.0-20260803 dis-cloud-v0.7.1-20260803}"

echo "==> remove local tags (if present)"
for tag in ${TAGS}; do
  ref="${REGISTRY_HOST}/${REPO}:${tag}"
  if docker image inspect "${ref}" >/dev/null 2>&1; then
    docker rmi "${ref}" || true
    echo "  deleted local ${ref}"
  else
    echo "  skip local (missing) ${ref}"
  fi
  local_ref="fde-dis-cloud-local:${tag#dis-cloud-}"
  if docker image inspect "${local_ref}" >/dev/null 2>&1; then
    docker rmi "${local_ref}" || true
    echo "  deleted local ${local_ref}"
  fi
done

echo "==> delete remote manifests via registry API"
python3 - "${REGISTRY_HOST}" "${REPO}" ${TAGS} <<'PY'
import json, subprocess, sys, base64, ssl, urllib.request, urllib.error, urllib.parse

host, repo, *tags = sys.argv[1:]
cfg_path = __import__("pathlib").Path.home() / ".docker" / "config.json"
cfg = json.loads(cfg_path.read_text()) if cfg_path.exists() else {}
user = pw = None
store = cfg.get("credsStore") or cfg.get("credStore")
if store:
    try:
        out = subprocess.check_output(
            [f"docker-credential-{store}", "get"],
            input=host.encode(),
            stderr=subprocess.STDOUT,
        )
        data = json.loads(out.decode())
        user, pw = data.get("Username"), data.get("Secret")
    except Exception as exc:
        print(f"cred helper failed: {exc}", file=sys.stderr)
auth = (cfg.get("auths") or {}).get(host) or (cfg.get("auths") or {}).get(f"https://{host}") or {}
if not user and auth.get("auth"):
    raw = base64.b64decode(auth["auth"]).decode()
    user, _, pw = raw.partition(":")
if not user or not pw:
    print("ERROR: no Docker credentials for", host, file=sys.stderr)
    sys.exit(1)

ctx = ssl.create_default_context()

def http(url, method="GET", headers=None):
    req = urllib.request.Request(url, method=method, headers=headers or {})
    try:
        with urllib.request.urlopen(req, context=ctx, timeout=45) as resp:
            return resp.status, resp.headers, resp.read()
    except urllib.error.HTTPError as e:
        return e.code, e.headers, e.read()

# Probe for auth challenge
st, hdrs, _ = http(
    f"https://{host}/v2/{repo}/tags/list",
    headers={"Accept": "application/json"},
)
www = hdrs.get("Www-Authenticate") if hdrs else ""
if st not in (200, 401) or "Bearer" not in (www or ""):
    # still try token endpoint used by Zhangjiakou ACR
    realm = "https://dockerauth-cn-zhangjiakou.aliyuncs.com/auth"
    service = "registry.aliyuncs.com:cn-zhangjiakou:26842"
else:
    parts = {}
    for chunk in www.replace("Bearer ", "").split(","):
        if "=" in chunk:
            k, v = chunk.strip().split("=", 1)
            parts[k] = v.strip('"')
    realm = parts["realm"]
    service = parts["service"]

scope = f"repository:{repo}:*"
token_url = f"{realm}?service={urllib.parse.quote(service)}&scope={urllib.parse.quote(scope)}"
basic = base64.b64encode(f"{user}:{pw}".encode()).decode()
st, _, body = http(token_url, headers={"Authorization": f"Basic {basic}"})
if st != 200:
    print("ERROR: token", st, body[:300], file=sys.stderr)
    sys.exit(1)
token = json.loads(body).get("token") or json.loads(body).get("access_token")
if not token:
    print("ERROR: empty token", file=sys.stderr)
    sys.exit(1)

for tag in tags:
    st, hdrs, body = http(
        f"https://{host}/v2/{repo}/manifests/{tag}",
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.docker.distribution.manifest.v2+json",
        },
    )
    digest = hdrs.get("Docker-Content-Digest") if hdrs else None
    if st == 404:
        print(f"  skip remote (missing) {repo}:{tag}")
        continue
    if not digest:
        print(f"  ERROR get {tag}: {st} {body[:200]}", file=sys.stderr)
        sys.exit(1)
    st, _, body = http(
        f"https://{host}/v2/{repo}/manifests/{digest}",
        method="DELETE",
        headers={"Authorization": f"Bearer {token}"},
    )
    if st in (200, 202, 204):
        print(f"  deleted remote {repo}:{tag} ({digest[:19]}…) → HTTP {st}")
    else:
        print(f"  ERROR delete {tag}: {st} {body[:200]}", file=sys.stderr)
        sys.exit(1)

print("Done.")
PY
