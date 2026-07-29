# 后端服务

入口聚合在 [`api/`](api/)（FastAPI monolith 挂载各 router）。本地 `./scripts/start.sh` 启动 `8760`。

## 命名说明

部分目录同时存在 **连字符** 与 **下划线** 两种名字：

| 展示名（连字符） | 可 import 包（下划线） |
|------------------|------------------------|
| `agent-gateway/` | [`agent_gateway/`](agent_gateway/) |
| `coach-gateway/` | [`coach_gateway/`](coach_gateway/) |
| `sim-router/` | [`sim_router/`](sim_router/) |

连字符目录仅保留 README 指向；**代码与 import 一律用下划线包名**。

## 主要模块

| 包 | 职责 |
|----|------|
| `auth/` | 登录 / JWT |
| `learner/` | 学员日包、资源 |
| `author/` | 教研台 curriculum CRUD |
| `orchestrator/` | 日任务编排 |
| `agent_gateway/` | Agent 调用入口 |
| `coach_gateway/` | FDE Coach |
| `kb_kernel/` | 知识库 |
| `media/` | 媒体 presign |
| `storage/` | MinIO / S3 |
| `worker/` | 异步任务 |
| `shared/` | 配置、DB、seed |

API 文档：http://127.0.0.1:8760/api/docs
