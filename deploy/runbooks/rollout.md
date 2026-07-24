# Rollout — FDE Learning OS

## Prerequisites

1. Images built and pushed:
   - `fde-api:<tag>` (API + worker + migrations)
   - `fde-web:<tag>` (static `/app` + `/author`)
2. Secret `fde-platform-secrets` present in target namespace.
3. Prod: CloudNativePG Cluster Ready (3 replicas); MinIO Operator Tenant healthy.
4. E2E: single-replica Postgres/MinIO reachable at values in `values-e2e.yaml`.

## Image tags

Record in the release note:

| Component | Image | Tag |
|-----------|-------|-----|
| api / worker / migrate | `fde-api` | e.g. `0.1.0` |
| web | `fde-web` | e.g. `0.1.0` |
| anyCode sidecar | `anycode-dashboard` | pinned digest preferred |

SQL path: `migrations/*.sql` applied by Job `python -m services.migrations_runner`.

## Install / upgrade

```bash
NS=fde
CHART=deploy/helm/fde-platform

# e2e
helm upgrade --install fde "$CHART" -n "$NS" --create-namespace \
  -f "$CHART/values-e2e.yaml" \
  --set image.api.tag="$TAG" --set image.worker.tag="$TAG" \
  --set image.web.tag="$TAG" --set image.migrate.tag="$TAG" \
  --wait --atomic

# prod
helm upgrade --install fde "$CHART" -n "$NS" --create-namespace \
  -f "$CHART/values-prod.yaml" \
  --set image.api.tag="$TAG" --set image.worker.tag="$TAG" \
  --set image.web.tag="$TAG" --set image.migrate.tag="$TAG" \
  --wait --atomic
```

Migration Job runs as `pre-install` / `pre-upgrade` hook. If it fails, Helm aborts (`--atomic` rolls back).

## Rolling update notes

- API/web Deployments: `maxUnavailable: 0`, `maxSurge: 1`.
- Probes: `/livez` (process), `/readyz` (PG + MinIO). LingZhi/anyCode degraded ≠ not ready.
- Worker shares `emptyDir` with anyCode sidecar; killing the Pod drops local temp workspaces — durable state is PG + MinIO.

## Verify

```bash
kubectl -n "$NS" rollout status deploy/fde-platform-api
kubectl -n "$NS" rollout status deploy/fde-platform-worker
kubectl -n "$NS" rollout status deploy/fde-platform-web

curl -sf "https://<host>/livez"
curl -sf "https://<host>/readyz"
curl -sf "https://<host>/healthz"

# browser smoke (from repo root, API port-forward or ingress)
./scripts/browser_smoke.sh
```

## Rollback

```bash
helm -n "$NS" rollback fde
# If schema already migrated forward: restore PG from backup (see backup-restore.md)
# — do not reverse SQL by hand.
```

## Validation URLs

| Env | App | Author | Health |
|-----|-----|--------|--------|
| local | http://127.0.0.1:8760/app/ | http://127.0.0.1:8760/author/ | `/healthz` `/livez` `/readyz` |
| e2e | https://fde.e2e.local/app/ | https://fde.e2e.local/author/ | same paths |
| prod | https://fde.example.com/app/ | https://fde.example.com/author/ | same paths |
