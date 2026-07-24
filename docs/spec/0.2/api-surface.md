# API Surface Spec（0.2 稳定面）

Base：`http://127.0.0.1:8760`  
鉴权：`Authorization: Bearer <jwt>` 或 Cookie `fde_token`  
开发兜底：`X-Learner-Id`（勿用于生产）

## 1. Auth / Camp

| Method | Path | 说明 |
|--------|------|------|
| POST | `/api/v1/auth/login` | `{email,password,camp_id}` → token + user |
| POST | `/api/v1/auth/invite` | `{invite_code,display_name}` |
| POST | `/api/v1/auth/logout` | 清 cookie |
| GET | `/api/v1/auth/me` | 当前用户 |
| GET | `/api/v1/camps` | 营期列表 |
| GET | `/api/v1/camps/{id}/config` | Key 打码配置 |
| PUT | `/api/v1/camps/{id}/lingzhi-key` | 教研写 Key |

## 2. Orchestrator

| Method | Path | 说明 |
|--------|------|------|
| GET | `/api/v1/camps/{camp}/days/{day}` | Day 包 + 节点状态 |
| POST | `/api/v1/nodes/{node_id}/complete` | 完成节点（门禁） |
| POST | `/api/v1/quiz/submit` | 提交测验 |
| GET | `/api/v1/contracts` | 契约列表 |

## 3. KbKernel

| Method | Path | 说明 |
|--------|------|------|
| GET | `/api/v1/kb/knowledge` | 知识列表 |
| POST | `/api/v1/kb/ask` | RAG；无 Key → `mode=offline` |
| POST | `/api/v1/kb/ask/stream` | SSE |
| POST | `/api/v1/kb/memories` | 写入记忆（需 Key） |

## 4. AgentGateway

| Method | Path | 说明 |
|--------|------|------|
| POST | `/api/v1/agent/workspaces/ensure` | 确保工作区 |
| GET | `/api/v1/agent/workspaces/{camp}/{learner}/files` | 列文件 |
| GET | `/api/v1/agent/workspaces/{camp}/{learner}/file` | 读文件 |
| PUT | `/api/v1/agent/workspaces/{camp}/{learner}/files` | 写文件并新建 head 快照 |
| POST | `/api/v1/agent/workspaces/{camp}/{learner}/evaluate` | 对当前工作区做 rubric 评测 |
| POST | `/api/v1/agent/jobs` | 创建任务（`force_stub` 可选） |
| GET | `/api/v1/agent/jobs/{id}` | 任务详情 |
| GET | `/api/v1/agent/jobs/{id}/events` | SSE |
| POST | `/api/v1/agent/jobs/{id}/evaluate` | rubric |
| POST | `/api/v1/agent/jobs/{id}/cancel` | 取消 |
| GET | `/api/v1/agent/jobs/{id}/summary` | Coach 摘要 |

## 5. Eval / Progress / Coach / Author

| Method | Path | 说明 |
|--------|------|------|
| POST | `/api/v1/eval/run` | 统一评测 |
| POST | `/api/v1/evidence` | 写证据 |
| GET | `/api/v1/learners/{id}/evidence` | 证据列表 |
| GET | `/api/v1/learners/{id}/passport` | Passport |
| POST | `/api/v1/coach/ask` | AI 导师（同步） |
| POST | `/api/v1/coach/ask/stream` | AI 导师 SSE（meta/delta/done） |
| POST | `/api/v1/author/contracts/upload` | 上传 YAML |
| GET | `/api/v1/author/evidence` | 教研证据 |
| GET | `/api/v1/author/jobs` | 教研 jobs |

## 6. 运维

| Method | Path |
|--------|------|
| GET | `/healthz` |
| GET | `/metrics` |
| GET | `/api/docs` |

## 7. 错误约定

| HTTP | 场景 |
|------|------|
| 401 | 未登录 / token 无效 |
| 403 | 非教研调用 author API |
| 409 | 节点未解锁 |
| 429 | 学员已有进行中 Agent job |
| 503 | 灵知 Key 缺失（memories）或 live Agent 不可达 |
