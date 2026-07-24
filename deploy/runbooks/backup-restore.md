# Backup & restore — FDE Learning OS

## Scope

| Layer | Source of truth | Backup target |
|-------|-----------------|---------------|
| PostgreSQL | CloudNativePG Cluster (prod 3 replicas) | WAL + base backups → MinIO bucket `fde-backups` |
| Objects | MinIO Tenant | Versioned buckets `fde-documents`, `fde-workspaces`, `fde-artifacts`, `fde-backups` |
| Ephemeral | Pod emptyDir (`/data/tmp_workspaces`) | **Not backed up** — hydrate from MinIO snapshots |

E2E (`values-e2e.yaml`) uses single-replica Postgres/MinIO — still exercise backup scripts, but RPO/RTO numbers below apply to prod only.

## PostgreSQL (CloudNativePG)

### Backup

1. Confirm CNPG `Cluster` has `.spec.backup.barmanObjectStore` pointing at `s3://fde-backups/...`.
2. On-demand:

```bash
kubectl cnpg backup <cluster-name> -n <ns>
kubectl get backups -n <ns> -w
```

3. Verify object keys appear under the barman prefix in MinIO.

### Restore (PITR)

1. Create a new Cluster (or bootstrap) from backup — never overwrite live RW without a freeze window.
2. Point `DATABASE_URL` (Secret `fde-platform-secrets`) at the restored RW service.
3. Run migration Job if schema lag is expected: `python -m services.migrations_runner` (forward-only).
4. Roll API/worker so connections pick up the new URL; verify `/readyz`.

### Migration rollback principle

- Migrations in `migrations/*.sql` are **forward-only**.
- Rollback = restore DB from PITR / base backup taken **before** the bad migration Job.
- Do not hand-edit `schema_migrations` in prod.

## MinIO objects

### Lifecycle

- `fde-documents`: retain originals; versioning on.
- `fde-workspaces`: workspace snapshots; prune orphan prefixes after learner churn policy (e.g. 90d inactive).
- `fde-artifacts`: submissions / eval bundles; align with compliance retention.
- `fde-backups`: CNPG WAL + base; retention set in Barman / bucket lifecycle (≥ 7d WAL, ≥ 14d base recommended).

### Restore a single workspace

```bash
# list
mc ls minio/fde-workspaces/<camp>/<learner>/
# copy prefix back; worker hydrate_workspace will rebuild local emptyDir
```

## Drill checklist

See [FAULT_DRILL.md](./FAULT_DRILL.md) for the quarterly restore drill.
