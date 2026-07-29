# Backend（FDE Learning OS API）

本目录是后端实现边界：API、Worker、迁移与后端测试。前端见仓库根下 [`../web/`](../web/)。

| 路径 | 说明 |
|------|------|
| [`services/`](services/) | FastAPI 模块化单体、Worker、存储、ORM / Repository |
| [`migrations/`](migrations/) | PostgreSQL SQL 迁移（schema 唯一权威） |
| [`tests/`](tests/) | 后端 pytest |

## 数据访问

见 [`services/DATA_ACCESS.md`](services/DATA_ACCESS.md)。新代码走 SQLAlchemy + Repository；禁止在业务层继续堆硬编码 SQL。

## 本地启动

在**仓库根**执行（会把 `backend/` 加入 `PYTHONPATH`）：

```bash
docker compose up -d postgres minio
./scripts/start.sh          # API :8760 + worker
cd web && npm run dev       # 前端 :5173
```

健康检查：`http://127.0.0.1:8760/livez` · `http://127.0.0.1:8760/readyz`

## 迁移

```bash
PYTHONPATH=backend:. .venv/bin/python -m services.migrations_runner
```
