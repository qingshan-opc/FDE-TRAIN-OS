# 数据访问约定

## 两层并存（过渡期）

| 层 | 入口 | 用途 |
|----|------|------|
| **ORM / Repository（推荐新代码）** | `services.db.session_scope` + `services.repositories.*` + `services.models.*` | 业务读写、领域模型 v2 |
| **Legacy psycopg** | `services.shared.db.db_cursor` | 存量 SQL；仅维护，禁止新增大段硬编码 SQL |

两者共用同一 PostgreSQL（`DATABASE_URL`）。

## 规则

1. **新功能**必须走 SQLAlchemy Session + Repository，不得在 router/service 里再拼长 SQL 字符串。
2. **改存量**时优先把该路径抽到 Repository；热点路径（auth 用户、enrollment、progress）优先清债。
3. **Schema 变更**只走 `backend/migrations/*.sql`（或后续 Alembic），应用进程内禁止 ad-hoc DDL（prod 已禁 runtime migrate）。
4. SQL Lab 学员沙箱等「故意执行用户 SQL」的路径除外，须隔离在 `lab_runtime/sql_sandbox`。

## 已迁移热点（本轮）

| 路径 | Repository |
|------|------------|
| `shared.get_user_*` / `authenticate` · `auth.register` | `UserRepository` |
| `orchestrator` `_get/_set/_fetch` node_progress | `ProgressRepository` |
| `progress` day 进度计数 | `ProgressRepository.day_passed_total` |
| enrollment / course / seed_domain_v2 | `EnrollmentRepository` · `CourseRepository` · `ProgressRepository` |

## 存量债（兼容层，禁止再扩大）

`author/app.py`、`learner/app.py` 站点/证书、`progress` evidence/submissions、`lab_completion` 事务内进度、billing/partners 等仍可用 `db_cursor`；改这些文件时顺手抽 Repository。

## 示例

```python
from services.db import session_scope
from services.repositories import UserRepository

with session_scope() as session:
    user = UserRepository(session).get_by_email("learner@fde.local")
```
