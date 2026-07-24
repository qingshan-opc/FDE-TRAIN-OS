# Disaster Recovery Runbook — FDE Learning OS

Companion to [`deploy/runbooks/backup-restore.md`](../../deploy/runbooks/backup-restore.md)
(mechanics) and [`deploy/runbooks/FAULT_DRILL.md`](../../deploy/runbooks/FAULT_DRILL.md)
(chaos drill matrix). This document is the **acceptance artifact**: targets,
who-does-what, and the checklist you actually sign off against during a
drill or a real incident.

## 1. Objectives

| Layer | RPO (max data loss) | RTO (max time to restore) |
|---|---|---|
| PostgreSQL (learner/course/enrollment/cert data) | ≤ 5 min (CNPG continuous WAL archiving) | ≤ 30 min to a fresh RW instance from latest base backup + WAL replay |
| MinIO objects (documents/workspaces/artifacts/backups) | ≤ 15 min (versioned buckets; last successful sync) | ≤ 60 min to restore a bucket/prefix from the MinIO Operator Tenant's own replication or backup target |
| In-cluster ephemeral state (`tmp_workspaces` emptyDir) | N/A — never a source of truth | Immediate — rehydrated from MinIO workspace snapshots on next request |
| Full platform (control plane down) | Bounded by PG RPO above | ≤ 2 h to a fully serving cluster (Helm install + secrets + migration Job + smoke test) |

These are **targets**, not guarantees from any specific managed-Postgres/MinIO
SLA — validate them empirically via the quarterly drill (§4) and record the
actual measured numbers in the drill ticket.

## 2. Source of truth per layer

| Data | Source of truth | Never a source of truth |
|---|---|---|
| Users, enrollments, progress, submissions, certificates, audit log | PostgreSQL (`migrations/*.sql` is the forward-only schema) | — |
| Documents, workspace snapshots, artifacts, PDF/JSON certificate manifests | MinIO (`fde-documents`, `fde-workspaces`, `fde-artifacts`) | Pod `emptyDir` |
| SQL Lab sandbox data (`fde_sandbox` DB) | Ephemeral, learner-scoped — **not** backed up; recreated per session | — |
| In-flight agent job state | `jobs`/`job_events`/`job_leases` tables (PG) | Worker process memory |

## 3. Restore procedure (summary — full steps in `backup-restore.md`)

1. **Freeze writes** — scale API/worker deployments to 0, or put the
   Ingress into maintenance mode. Do not restore into a database still
   receiving live traffic.
2. **PostgreSQL**: bootstrap a new CNPG `Cluster` from the target backup
   (PITR to a specific timestamp, or latest). Point the `DATABASE_URL`
   Secret at the restored RW service.
3. **Schema catch-up**: run the migration Job
   (`deploy/helm/fde-platform/templates/migration-job.yaml`) — migrations
   are forward-only; never hand-edit `schema_migrations`.
4. **MinIO**: if buckets themselves need restoring (not just PG), replay
   from the Tenant's own backup/replication target into fresh buckets with
   the same names; otherwise MinIO usually survives a PG-only incident
   untouched.
5. **Unfreeze**: scale API/worker back up, confirm `/readyz` → `200` with
   `checks.postgres=ok` and `checks.minio=ok`.
6. **Smoke test**: login as the demo learner, open a Day, verify a
   certificate at `/verify/<known-cert-id>`, confirm `/metrics` is scraping
   (in-cluster only — see §5).
7. **Announce** recovery + actual RPO/RTO achieved in the incident ticket.

## 4. Quarterly drill checklist (acceptance artifact)

Run this every quarter and before any major release; attach the completed
checklist (with timestamps + evidence links) to the release ticket.

- [ ] Fault-drill matrix rows 1–8 from `FAULT_DRILL.md` executed on staging
- [ ] PITR restore performed on a **cloned namespace** (never the live one)
- [ ] Measured PG restore time recorded (target: ≤ 30 min) — actual: `____`
- [ ] Measured MinIO restore time recorded (target: ≤ 60 min) — actual: `____`
- [ ] Post-restore data check: learner passport / enrollments / certificate
      list for a known test learner matches the pre-drill snapshot
- [ ] `/readyz` returns `200` with `postgres=ok`, `minio=ok` post-restore
- [ ] Playwright e2e smoke (`cd e2e && npm test -- --project=chromium`) green
      against the restored environment
- [ ] No production Secret values pasted into the ticket
- [ ] Backup object keys / snapshot IDs used in the drill are listed in the
      ticket for traceability
- [ ] Sign-off: operator name + date

## 5. Operational guardrails that protect DR posture

- `FDE_ALLOW_RUNTIME_MIGRATE=0` in prod (`values-prod.yaml`) — schema
  changes only via the dedicated migration Job, never a rolling app Pod, so
  a bad deploy can't race a restore.
- `/metrics` has no auth (Prometheus contract) and must stay in-cluster only
  — see the NetworkPolicy/Ingress comments in `deploy/helm/fde-platform/`.
  A public `/metrics` isn't itself a DR risk, but it is an info-leak risk
  that should be closed before go-live (tracked in `production-gate.md`).
- Certificate issuance writes a `completion_snapshot_json` at issue time
  (`services/application/certificates.py`) — a cert's validity can be
  re-derived from that snapshot even if `node_progress`/`submissions`
  history is later pruned or lost.
- `certificate_issuances` rows are treated as immutable (only
  `status`/`revoked_at`/`revoke_reason` ever change post-insert) — a
  restore that loses recent issuances is detectable by diffing issuance
  counts against the audit log (`audit_logs` action=`certificate.issue`).
