# Fault drill — FDE Learning OS

Quarterly (or pre-release) chaos checklist. Record start/end time, operator, and evidence (screenshot / curl / MinIO key).

## Goals

- Prove progress, jobs, and artifacts survive API/worker restarts.
- Prove MinIO / LingZhi brief outages degrade soft paths without blocking `/readyz` incorrectly.
- Prove backup restore recovers learner state.

## Drill matrix

| # | Inject | Expect | Pass criteria |
|---|--------|--------|---------------|
| 1 | Delete API Pod mid-session | Ingress routes to healthy replica; client retries | Learner refresh keeps Day progress |
| 2 | Delete Worker Pod during agent job | Job lease expires; another worker claims | Job reaches `succeeded` or clean `failed` with event |
| 3 | Block MinIO 60s | `/readyz` → 503; `/livez` OK; learning UI may show retry | After restore, `/readyz` 200; uploads resume |
| 4 | Block LingZhi 60s | `/readyz` still OK; coach/Kb degraded | Content read from cache/day YAML still works |
| 5 | Block anyCode sidecar | `AGENT_MODE=auto` falls back to stub | Stub job completes; UI shows mode |
| 6 | Duplicate quiz/submit | Idempotent or 409 | No double-credit in passport |
| 7 | Wipe Pod emptyDir workspace | Open existing work | Hydrate from `fde-workspaces` snapshot |
| 8 | Restore PG from yesterday backup (staging) | Point Secret + restart | Learner passport / enrollments match backup epoch |

## Procedure (staging)

```bash
NS=fde
API=$(kubectl -n "$NS" get pod -l app.kubernetes.io/component=api -o name | head -1)
WORKER=$(kubectl -n "$NS" get pod -l app.kubernetes.io/component=worker -o name | head -1)

# 1–2
kubectl -n "$NS" delete "$API"
kubectl -n "$NS" delete "$WORKER"
kubectl -n "$NS" rollout status deploy/fde-platform-api
kubectl -n "$NS" rollout status deploy/fde-platform-worker

# 3 — network policy or `kubectl port-forward` kill; or temporarily wrong S3_ENDPOINT
curl -si "https://<host>/readyz" | head -1

# 7 — after worker restart, open prior job preview in browser; confirm MinIO keys

# 8 — follow backup-restore.md PITR on a clone namespace only
```

## Browser evidence

Run Playwright after drills 1–2 and 7:

```bash
cd e2e && npm test -- --project=chromium
# artifacts: e2e/artifacts/
```

## Sign-off

- [ ] All rows Pass or Waived with reason  
- [ ] Screenshots / traces under `e2e/artifacts/fault-drill-<date>/`  
- [ ] Backup object keys listed in ticket  
- [ ] No production Secret values pasted into tickets  

Related: [backup-restore.md](./backup-restore.md) · [rollout.md](./rollout.md)
