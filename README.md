# FDE Learning OS 0.1

生产级首期内核：鉴权营期 · KbKernel · AgentGateway · 日任务门禁 · 证据/Passport · 学员/教研台。

## 启动

```bash
cd digital-fde-platform
python3 -m venv .venv && .venv/bin/pip install -r requirements-skeleton.txt
cp .env.example .env
# 推荐：先起依赖，再在 .env 写入 DATABASE_URL
docker compose up -d postgres minio
# DATABASE_URL=postgresql://fde:fde@127.0.0.1:5433/fde
chmod +x scripts/*.sh
./scripts/start.sh
```

镜像：`docker build -t fde-api:0.1.0 .`

## 入口

| 用途 | URL |
|------|-----|
| 学员工作台 | http://127.0.0.1:8760/app/ |
| 教研台 | http://127.0.0.1:8760/author/ |
| API 文档 | http://127.0.0.1:8760/api/docs |
| 健康/指标 | `/healthz` · `/metrics` |

演示账号：`demo@fde.local` / `demo1234` · 教研：`author@fde.local` / `author1234`

## 冒烟

```bash
./scripts/smoke_e2e.sh    # 0.1 主路径
./scripts/smoke_0.2.sh    # 0.2 Day1–2 + Spec 齐套
```

## 文档

- [0.2 Spec 包](docs/spec/0.2/README.md)（学员台 / Day YAML / API / 验收）
- [生产拓扑](docs/architecture/fde-0.1-production.md)
- [发布清单](docs/release/0.1-checklist.md)
