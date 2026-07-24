# FDE Learning OS — Playwright E2E

Chromium is the primary acceptance browser. See also [`docs/qa/full-iteration-test-plan.md`](../docs/qa/full-iteration-test-plan.md) and [`docs/qa/test-run-tracker.csv`](../docs/qa/test-run-tracker.csv).

## Prerequisites

1. API on `http://127.0.0.1:8760` (`../scripts/start.sh`).
2. Postgres + MinIO (`docker compose up -d postgres minio`).
3. Demo users seeded (`FDE_SEED_DEMO_USERS=1`).
4. Frontend built (`cd web && npm run build`).

## Accounts

| Role | Email | Password | Camp |
|------|-------|----------|------|
| Learner | `demo@fde.local` | `demo1234` | `camp-v03` |
| Author | `author@fde.local` | `author1234` | — |

Shared helpers: [`fixtures/auth.ts`](fixtures/auth.ts).

## Install

```bash
cd e2e
npm install
npx playwright install chromium
```

## Run

```bash
# Phase 1 smoke
npx playwright test learner-coach learner-local-prep permissions learner-login-day1

# Closed-loop specs
npx playwright test grading-closed-loop coach-handoff-loop learner-learning-stats

# Full regression (Chromium)
npm run test:chromium
```

Override base URL: `FDE_E2E_BASE_URL=https://fde.e2e.local npm run test:chromium`

## Spec catalog

| Spec | Coverage |
|------|----------|
| `learner-login-day1.spec.ts` | Login + Day1 capsule smoke |
| `learner-coach.spec.ts` | 三件套顶栏 + 全局 AI 导师 FAB |
| `learner-local-prep.spec.ts` | 本地实操 Tab + 复制 prompt |
| `learner-learning-stats.spec.ts` | 学习时长 heartbeat 持久化 |
| `grading-closed-loop.spec.ts` | 导师打回 → 学员重交 → 通过 |
| `coach-handoff-loop.spec.ts` | 教练 handoff → 导师反馈 → 学员可见 |
| `learner-day1-full-chain.spec.ts` | Day1 全链路 + Day2 解锁 |
| `learner-agent-lab.spec.ts` | Agent Lab IDE + Rubric |
| `learner-sim-lab.spec.ts` | Day5 Sim Lab |
| `learner-k8s-lab.spec.ts` | Day13 K8s Lab |
| `learner-task-home.spec.ts` | 任务首页 / 深链 |
| `learner-media.spec.ts` | 媒体播放 |
| `permissions.spec.ts` | 学员 RBAC |
| `a11y.spec.ts` | axe-core |
| `author-console-v2.spec.ts` | 教研 Ant Design 控制台 |
| `author-curriculum.spec.ts` | 课纲编辑器 |
| `author-upload.spec.ts` | YAML 上传 |
| `author-docx-ingest.spec.ts` | DOCX ingest |
| `author-antd-paths.spec.ts` | Legacy smoke |

## Artifacts

| Path | Contents |
|------|----------|
| `artifacts/` | Screenshots from specs |
| `test-results/` | Failure dumps |
| `playwright-report/` | HTML report (`npm run report`) |
