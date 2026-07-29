# FDE Learning OS

生产级学习平台：鉴权营期 · 课程编排 · 学员/教研台 · Agent Lab · 证据闸口。

## 快速启动

```bash
python3 -m venv .venv && .venv/bin/pip install -r requirements-skeleton.txt
cp .env.example .env
docker compose up -d postgres minio   # 可选
chmod +x scripts/*.sh
./scripts/start.sh                    # API :8760 + worker（PYTHONPATH 含 backend/）
cd web && npm run dev                 # 前端 :5173
```

| 入口 | URL |
|------|-----|
| 学员台 | http://127.0.0.1:5173/app/ |
| 教研台 | http://127.0.0.1:5173/author/ |
| API | http://127.0.0.1:8760/api/docs |

演示：`learner@fde.local` / `learner1234`（学员）· `author@fde.local` / `author1234`（教研）

## 渐进披露（从哪进）

| 你想… | 从这里进 |
|--------|-----------|
| **跑通平台 / 冒烟** | 本文「快速启动」→ [`scripts/README.md`](scripts/README.md) |
| **改前端** | [`web/`](web/) |
| **改后端 / 迁移 / 测试** | [`backend/README.md`](backend/README.md) → `backend/services` · `backend/migrations` · `backend/tests` |
| **改课 / 做口播视频** | [`class/README.md`](class/README.md) → [`class/bootcamp/`](class/bootcamp/) → [口播 Skill](.cursor/skills/fde-section-courseware/SKILL.md) |
| **改 spec / 架构 / 发布** | [`docs/README.md`](docs/README.md) → [`docs/spec/0.4/`](docs/spec/0.4/) |

## 仓库结构（一级）

```
├── web/              Frontend：学员台 + 教研台（Vite/React）
├── backend/          Backend：API / worker / migrations / pytest → backend/README.md
├── class/            课程包（公开课 + 训练营）→ class/README.md
├── scripts/          启动、合约、口播流水线、MinIO 同步 → scripts/README.md
├── docs/             Spec 与架构 → docs/README.md
├── contracts/        curriculum YAML
├── sim/              仿真适配器
├── deploy/           Docker / Helm
└── e2e/              Playwright
```

## 冒烟

```bash
./scripts/smoke_e2e.sh
./scripts/run_tests.sh
```

## 文档

- [文档总索引](docs/README.md)
- [课程包总览](class/README.md)
- [后端与数据访问](backend/README.md) · [DATA_ACCESS](backend/services/DATA_ACCESS.md)
- [当前 curriculum v0.7](docs/spec/0.4/curriculum-v0.7.md)
- [发布清单](docs/RELEASE.md)
