# AgentGateway

共享 Agent 网关 + 每学员隔离工作区。对接 **anyCode Workbench HTTP**（无头 `AgentRuntime`，无需 Desktop 客户端）。

## 行为

1. `POST /api/v1/agent/workspaces/ensure` → 创建 `FDE_WORKSPACE_ROOT/{camp_id}/{learner_id}/`
2. `POST /api/v1/agent/jobs` → 入队；worker 调 anyCode 或 stub
3. `GET /api/v1/agent/jobs/{id}` / `GET .../events`（SSE，含 anyCode 进度事件）
4. `GET /api/v1/agent/workspaces/.../files` → 列产物
5. `POST /api/v1/agent/jobs/{id}/evaluate` → 按 rubric 检查文件

## anyCode 对接（worker）

实现：`services/shared/anycode_client.py` + `services/worker` `_run_anycode`。

当 `ANYCODE_DASHBOARD_URL` 可达：

1. `Authorization: Bearer {ANYCODE_API_TOKEN}`（若配置）
2. `POST /api/projects`（`root_path` = 学员临时工作区）
3. `POST /api/projects/{id}/conversations/start`（可选 `skills`）
4. `GET /api/sessions/{id}/events/stream` 直到 `turn_done` / `session_error`

| `AGENT_MODE` | 行为 |
|--------------|------|
| `live` | 不可达或失败 → **硬失败**（禁止静默 stub） |
| `auto` | 不可达 → stub（仅演示） |
| `stub` | 始终 stub |

生产 Helm：`AGENT_MODE=live`。

## 安全

- 路径必须在学员根目录下（`resolve_safe`）
- 每学员并发 job ≤ 1
- 禁止建议拉起 Docker/K8s（prompt 系统前缀约束）
- 宿主机共享进程；隔离靠目录，非容器

## Job 状态

`queued | running | succeeded | failed | cancelled`
