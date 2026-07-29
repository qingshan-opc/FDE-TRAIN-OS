# FDE Learning OS — 发布交付清单

## 镜像 tag（建议）

| 组件 | Dockerfile | 建议 tag |
|------|------------|----------|
| API | `deploy/docker/Dockerfile.api` | `fde-api:0.4.0` |
| Worker | `deploy/docker/Dockerfile.worker` | `fde-worker:0.4.0` |
| Web | `deploy/docker/Dockerfile.web` | `fde-web:0.4.0` |

本地构建示例：

```bash
docker build -f deploy/docker/Dockerfile.api -t fde-api:0.4.0 .
docker build -f deploy/docker/Dockerfile.worker -t fde-worker:0.4.0 .
docker build -f deploy/docker/Dockerfile.web -t fde-web:0.4.0 .
```

## Migration 路径

按序执行（Kubernetes migration Job / 本地 runner）；SQL 位于 `backend/migrations/`：

1. `backend/migrations/001_init.sql`
2. `backend/migrations/002_production.sql`
3. `backend/migrations/003_submissions_feedback.sql`

命令：`PYTHONPATH=backend:. python -m services.migrations_runner`

## Helm

- Chart: `deploy/helm/fde-platform/`
- E2E values: `values-e2e.yaml`（单副本 PG/MinIO）
- Prod values: `values-prod.yaml`（CNPG 三副本 + MinIO Operator Tenant）

安装前创建 Secret `fde-platform-secrets`（`JWT_SECRET`、`DATABASE_URL`、`S3_*`、`LINGZHI_*`、`ANYCODE_API_TOKEN`）。
生产 `AGENT_MODE=live`；anyCode 为 worker sidecar 无头 Workbench（无需 Desktop 客户端）。

## 本地验证 URL

| 项 | URL |
|----|-----|
| API livez | http://127.0.0.1:8760/livez |
| API readyz | http://127.0.0.1:8760/readyz |
| 学员 SPA | http://127.0.0.1:8760/app/ |
| 教研 SPA | http://127.0.0.1:8760/author/ |
| 登录 | http://127.0.0.1:8760/login |
| OpenAPI | http://127.0.0.1:8760/api/docs |

演示账号：`demo@fde.local` / `demo1234`（学员）、`author@fde.local` / `author1234`（教研）。

## 进程

```bash
./scripts/run_api.sh
./scripts/run_worker.sh
# 浏览器冒烟
./scripts/browser_smoke.sh
```

## Runbook

- 备份恢复：`deploy/runbooks/backup-restore.md`
- 滚动发布：`deploy/runbooks/rollout.md`
- 故障演练：`deploy/runbooks/FAULT_DRILL.md`

## 本地灵知 live 入库

同机需已启动 FDE MinIO（`:9000`）。一键：

```bash
./scripts/setup_lingzhi_local.sh
./scripts/run_api.sh
./scripts/run_worker.sh
```

使用 `digital-lingzhi-platform/deploy/docker-compose.fde-ports.yml` 避开 MinIO 端口冲突，并共用 FDE MinIO 的 `lingzhi-files` bucket。

## 验收证据（本机已验证）

- PostgreSQL-only + migration 003 已应用
- MinIO bucket 自动创建；Agent stub job → workspace snapshot
- 教员 DOCX → MinIO → Worker → 灵知 `ingest/publish` → `ready`（含 `lingzhi_knowledge_id`）
- Cookie 会话 + CSRF；登录不再自动 enroll
- Playwright Chromium（React UI 选择器）+ axe
- Pod 重启后进度/作品：依赖 PG + MinIO snapshot（临时 emptyDir 可丢）
