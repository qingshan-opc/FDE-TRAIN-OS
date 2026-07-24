# Production Gate — Go-Live Acceptance Checklist

Sign every row before flipping production traffic to a new environment or a
release that touches auth/identity/certificates/rate-limiting/security
headers. Attach the completed checklist to the release ticket. Related:
[dr-runbook.md](./dr-runbook.md) · [backup-restore.md](../../deploy/runbooks/backup-restore.md) ·
[FAULT_DRILL.md](../../deploy/runbooks/FAULT_DRILL.md).

## 1. Configuration

- [ ] `FDE_ENV=prod`
- [ ] `JWT_SECRET` changed from the dev default (`require_database_url()`
      hard-fails at boot in prod if it wasn't — confirm the boot log is clean)
- [ ] `FDE_ALLOW_RUNTIME_MIGRATE=0` — schema changes go through
      `migration-job.yaml` only (verify the Job succeeded, not the API Pod logs)
- [ ] `FDE_ALLOW_DEV_HEADERS=0`, `FDE_SEED_DEMO_USERS=0`
- [ ] `FDE_CERT_ALLOW_UNVERIFIED` has no effect in prod (hardcoded off in
      `services/application/certificates.py` regardless of the env var) —
      confirmed by test in `tests/test_certificates.py`
- [ ] `KYC_PROVIDER=http` + `KYC_HTTP_URL` set to the real vendor endpoint
      (never ship prod on `KYC_PROVIDER=stub`)
- [ ] Rate limit env vars reviewed for the target pod count
      (`RATE_LIMIT_LOGIN`/`RATE_LIMIT_UPLOAD`/`RATE_LIMIT_COACH_ASK`/`RATE_LIMIT_SQL_EXEC`
      — buckets are per-pod; see `services/shared/rate_limit.py` docstring)
- [ ] `CLAMAV_ENABLED=1` only if a ClamAV daemon is actually deployed and
      reachable — otherwise every learner upload fails closed by design

## 2. Identity & certificates

- [ ] KYC adapter smoke-tested end to end against the real provider in a
      staging namespace (`POST /api/v1/me/identity/start` → provider
      callback → `identity_verifications.status='verified'`)
- [ ] `POST /api/v1/me/identity/webhook` returns `404` when `FDE_ENV=prod`
      (dev-only stub; confirm with a live curl against the prod endpoint)
- [ ] Confirmed no raw ID number / face image ever appears in
      `identity_verifications` rows, application logs, or audit logs —
      spot-check a real verification's DB row and log lines
- [ ] `POST /api/v1/author/certificates/issue` requires author/admin role
      (403 for a learner token)
- [ ] Issuing a certificate for an enrollment below the completion/rubric
      gate returns `409` with a human-readable reason
- [ ] Revoking a certificate (`POST /api/v1/author/certificates/{id}/revoke`)
      then hitting the public verify endpoint returns `valid: false`
- [ ] Certificate artifact (`pdf_object_key`) lands in `fde-artifacts`;
      acceptable for it to be a JSON manifest if `reportlab` isn't installed

## 3. Rate limiting & abuse controls

- [ ] Hammering `/api/v1/auth/login` past `RATE_LIMIT_LOGIN` returns `429`
      with a `Retry-After` header
- [ ] Same for `/api/v1/labs/attachments`, `/api/v1/coach/ask`,
      `/api/v1/sql-lab/sessions/{id}/exec`
- [ ] Confirmed rate limiting is per-pod (in-memory) and the configured
      limits already account for `api.hpa.maxReplicas` /
      `worker.hpa.maxReplicas` in `values-prod.yaml`

## 4. Security headers / CSP

- [ ] `curl -sI https://<host>/api/v1/site/landing` shows
      `Content-Security-Policy`, `X-Content-Type-Options: nosniff`,
      `X-Frame-Options: DENY`, `Referrer-Policy`, and (prod only)
      `Strict-Transport-Security`
- [ ] `/api/docs` and `/api/redoc` still render (relaxed CSP for those two
      paths only — Swagger UI/Redoc load their JS bundle from
      `cdn.jsdelivr.net`)
- [ ] No other path is missing the strict default CSP (spot-check `/app/`,
      `/api/v1/auth/me`)

## 5. Observability

- [ ] `/metrics` is **not** reachable from outside the cluster — either
      removed from the public Ingress or restricted via
      `whitelist-source-range` / a monitoring-only NetworkPolicy (see
      comments in `deploy/helm/fde-platform/values.yaml` and
      `templates/networkpolicy.yaml`)
- [ ] Prometheus (or equivalent) is actually scraping `/metrics` in-cluster
      — `fde_http_requests_total` / `fde_http_request_duration_seconds`
      show up with real traffic
- [ ] `/readyz` checked under a synthetic queue backlog: `checks.queue_depth`
      is present and `checks.queue_depth_warning` appears once
      `FDE_QUEUE_DEPTH_WARN` is exceeded (readiness itself must NOT flip to
      `503` from queue depth alone — only from `postgres`/`minio` failures)
- [ ] Log lines from a real request show a non-`-` `request_id` that matches
      the `X-Request-Id` response header (structured logging contextvar —
      `services/shared/middleware.py` / `services/shared/__init__.py`)
- [ ] Worker pods: `kubectl get pods -l app.kubernetes.io/component=worker`
      shows both liveness and readiness probes green

## 6. Backup / DR

- [ ] CNPG `Cluster.spec.backup.barmanObjectStore` confirmed pointing at
      `s3://fde-backups/...` and a recent WAL/base backup exists
      (`kubectl get backups -n <ns>`)
- [ ] `docs/ops/dr-runbook.md` §4 quarterly drill checklist completed within
      the last 90 days, with recorded RPO/RTO measurements
- [ ] MinIO bucket versioning enabled on all four buckets
      (`services/storage/__init__.py ensure_buckets` best-effort enables
      this — confirm it actually took via `mc` or the MinIO console)

## 7. Helm / cluster

- [ ] `helm template` (or `helm install --dry-run`) with
      `-f values.yaml -f values-prod.yaml` produces no errors
- [ ] `api`/`worker`/`web` PodDisruptionBudgets + HPA are enabled
      (`values-prod.yaml`)
- [ ] NetworkPolicy enabled (`networkPolicy.enabled: true`) and reviewed —
      egress limited to DNS/PG/MinIO/LingZhi/HTTPS only
- [ ] `securityContext.runAsNonRoot: true` + `readOnlyRootFilesystem: true`
      confirmed on running Pods, not just the chart defaults

## 8. Sign-off

- [ ] All sections above checked, with any waivers documented + reasoned
- [ ] Rollback plan confirmed (previous Helm release revision + `helm rollback`)
- [ ] On-call rotation aware of the release window
- Operator: `______________`  Date: `______________`
