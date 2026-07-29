# FDE 全量迭代测试计划

> 版本：2026-07-23 · 环境：`http://127.0.0.1:8760` · 执行记录见 [`test-run-tracker.csv`](test-run-tracker.csv)

## 1. 测试环境与账号

```bash
docker compose up -d postgres minio
export FDE_SEED_DEMO_USERS=1
PYTHONPATH=. python3 -m services.migrations_runner
cd web && npm run build
./scripts/start.sh
cd e2e && npm run test:chromium
```

| 角色 | 邮箱 | 密码 | Camp | 入口 |
|------|------|------|------|------|
| 学员 | `demo@fde.local` | `demo1234` | `camp-v03` | `/login` → `/app/courses` → `/app` |
| 教研/导师 | `author@fde.local` | `author1234` | — | `/login` → `/author` |
| 隔离学员 | 邀请码 `FDE-DEMO` | 随机 | `camp-v03` | full-chain 专用 |

## 2. 四条业务闭环

| 闭环 | 数据 | 自动评分 | 人工 |
|------|------|----------|------|
| Learn 练习 | `practice_responses` | 无 | 无（gate 校验提交） |
| Lab Rubric | `submissions` + `evidence` | 规则引擎 | 可选 |
| 企业任务 | `submissions` | 继承 Lab eval | 导师复核 |
| AI 教练 | `coach_turns` → `mentor_reviews` | 诊断建议 | 导师反馈 |

**口径**：不存在 LLM 教师自动打分；Lab「自动批改」= Rubric（`services/shared/rubric_registry.py`）。

## 3. 模块 A — Demo 学员台三件套

| ID | 步骤 | 预期 | 自动化 |
|----|------|------|--------|
| A1 | 登录 → Day1 learn | 顶栏 `第1周 · Day 1`、进度、分钟 | `learner-coach.spec.ts` |
| A2 | 停留 ≥30s 刷新 | 分钟递增且持久 | `learner-learning-stats.spec.ts` |
| A3 | 右下角 AI 任务导师 FAB | 无重复入口、抽屉正确 | `learner-coach.spec.ts` |
| A4 | c6 → 本地实操 Tab | checklist + 复制 prompt | `learner-local-prep.spec.ts` |
| A5 | c6 导师 FAB | 推荐问题含 suggested_questions | 手测 / 见 chips |

## 4. 模块 B — 学员 Day 主路径

| ID | 流程 | 自动化 |
|----|------|--------|
| B1 | 课程选择 → `/app` | `learner-task-home.spec.ts` |
| B2 | 深链 `?node=` | `learner-task-home.spec.ts` |
| B3 | 练习提交 + 完成 learn | `learner-day1-full-chain.spec.ts` |
| B4 | 测验通过 | full-chain |
| B5 | 媒体 audio/video | `learner-media.spec.ts` |
| B6 | Agent Lab stub 评测 | `learner-agent-lab.spec.ts` |
| B7 | Sim Lab Day5 | `learner-sim-lab.spec.ts` |
| B8 | K8s Lab Day13 | `learner-k8s-lab.spec.ts` |
| B9 | Day2 workspace 继承 | full-chain |

## 5. 模块 C — Lab Rubric 闭环（手测 + agent-lab）

1. 故意提交不合格 HTML → 评测 failed
2. 修改后重评 → 全绿 pass
3. 完成 Lab → project 解锁
4. AI 导师问验收标准
5. （可选）申请导师复核

## 6. 模块 D — 企业任务 + 导师复核闭环

| 步骤 | 学员 | 教研 |
|------|------|------|
| D1 | project 提交复盘 | — |
| D2 | — | `/author/learners/submissions` 见新记录 |
| D3 | — | 复核 status=failed + feedback |
| D4 | 看到导师反馈，重新提交 | — |
| D5 | — | status=passed |

自动化：`grading-closed-loop.spec.ts`

## 7. 模块 E — AI 教练 handoff 闭环

| 步骤 | 学员 | 教研 |
|------|------|------|
| E1 | FAB 提问 | — |
| E2 | 申请导师复核 | — |
| E3 | — | `/author/learners/reviews` 队列 pending |
| E4 | — | 提交反馈 resolved |
| E5 | 教练抽屉见导师反馈 | — |

自动化：`coach-handoff-loop.spec.ts`

## 8. 模块 F — 教研台

| ID | 路径 | 自动化 |
|----|------|--------|
| F1 | `/author` 概览 | `author-console-v2.spec.ts` |
| F2 | 课纲 + local_prep Tab | `author-curriculum.spec.ts` |
| F3 | 提交资料复核 | `grading-closed-loop.spec.ts` |
| F4 | legacy 导师队列 | `coach-handoff-loop.spec.ts` |
| F5 | DOCX ingest | `author-docx-ingest.spec.ts` |
| F6 | YAML 上传 | `author-upload.spec.ts` |
| F7 | 权限 | `permissions.spec.ts` |

## 9. 模块 G — 公开站（P2 手测）

Landing、OpenCourses、About、VerifyCertificate、错误密码、登出 — 无系统 E2E。

## 10. 优化 Backlog

| 优先级 | ID | 问题 | 建议 |
|--------|-----|------|------|
| P0 | O10 | 学员看不到 submission 反馈 | ProjectSubmit 反馈卡片 + 重交 |
| P0 | O11 | handoff 后学员无结果 | coach 抽屉展示 mentor_review |
| P1 | O1 | 进度可能 >100% | API/前端 cap 100% |
| P1 | O2 | Coach SSE 断线 | 增加 stream 断言 |
| P1 | — | e2e login 重复 | `fixtures/auth.ts` |
| P2 | O6 | 测验失败重考 | 新增 spec |
| P2 | — | CI e2e 手动触发 | PR smoke 必跑 |

## 11. 执行 Phase

| Phase | 命令 | 时长 |
|-------|------|------|
| 1 冒烟 | `npx playwright test learner-coach learner-local-prep permissions learner-login-day1` | ~30min |
| 2 三件套 | `learner-learning-stats` + A5 手测 | ~20min |
| 3 全链 | `learner-day1-full-chain learner-agent-lab` | ~60min |
| 4 闭环 | `grading-closed-loop coach-handoff-loop` | ~30min |
