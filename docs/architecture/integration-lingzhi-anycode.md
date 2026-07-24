# 灵知 × anyCode × FDE 集成映射（anyCode 内核 / 无本地客户端）

## 1. 总览

| 能力 | 提供方 | FDE 服务 | 协议 |
|------|--------|----------|------|
| 知识列表 / RAG / 记忆写入 | 灵知 Open API | **KbKernel** | HTTP + `X-API-Key` |
| 长任务写代码（网页等） | **anyCode Workbench HTTP**（`AgentRuntime`，无头） | **AgentGateway → worker** | HTTP + session SSE |
| AI 导师 LEVEL + Skill | 灵知 citations + anyCode `fde-coach` Skill | **coach-gateway** | HTTP + `/ask/stream` SSE |
| 仿真 lab | SimAdapter | sim-router | 内部 |
| Agent lab 评测 | 工作区文件 rubric | agent-gateway | 内部 |

**不需要 anyCode Desktop.app / 浏览器 SPA。** 集成面仅为 Workbench HTTP（`anycode-dashboard-serve` 或同机 sidecar）。口播仓库 `research/anycode` **不**纳入底座；真源为 `llm-cli/anycode`。

## 2. 灵知 Open API

Base：`{LINGZHI_BASE_URL}`（例 `http://127.0.0.1:8230`）  
鉴权：`X-API-Key: {LINGZHI_API_KEY}`

| FDE | 方法 | 上游 |
|-----|------|------|
| KbKernel knowledge | GET | `/api/v2/open/knowledge` |
| KbKernel ask | POST | `/api/v2/open/rag/ask` |
| KbKernel ask/stream | POST | `/api/v2/open/rag/ask/stream` |
| KbKernel memories | POST | `/api/v2/open/memories` |

卡片详情仍无 Open API：用 YAML `learn.steps` 兜底。

## 3. anyCode Workbench（内核接入）

Base：`{ANYCODE_DASHBOARD_URL}`（例 sidecar `http://127.0.0.1:43180`）  
鉴权：`Authorization: Bearer {ANYCODE_API_TOKEN}`（loopback 可空；生产必填）

| 步骤 | 调用 |
|------|------|
| 探活 | `GET /api/health` |
| 绑定项目 | `POST /api/projects`（`root_path`=学员目录或 coach 沙箱） |
| 开对话/任务 | `POST /api/projects/{id}/conversations/start`（可选 `skills`） |
| 事件流 | `GET /api/sessions/{id}/events/stream`（等到 `turn_done`） |

实现：`services/shared/anycode_client.py`。

### Agent Lab

- worker `_run_anycode`：Bearer + SSE；`AGENT_MODE=live` 失败硬失败（禁止静默 stub）。
- Helm prod：`AGENT_MODE=live`；worker sidecar = 无头 serve + `fde-coach` skill ConfigMap。

### Coach

1. KbKernel 取 citations（知识对错以此为准）
2. 组装 LEVEL + `skills/fde-coach/SKILL.md` 提示
3. anyCode project `fde-coach`（沙箱目录，**不**绑学员可写 cwd）+ `skills: [fde-coach]`
4. `coach_mode=full`；不可达 → `rag_only` / `offline`
5. `POST /api/v1/coach/ask/stream` 转发 delta

Day YAML `lab.coach`（`help_mode` / `skill_id` / `max_help_level`）由 CoachPanel 传入 ask body。

## 4. 权限与租户

```text
Org
  └── LingZhi workspace + API Key（一营一 Key）
  └── FDE camp
        └── Learners
              └── workspace dir（路径沙箱）
              └── agent_jobs（并发 1）
              └── sim sessions（可选）
```

红线：

1. Key / anyCode token 不下发浏览器
2. Agent 产物不出学员目录
3. Coach 禁止把学员 bash 动作交给 anyCode 宿主机
4. 证书区分仿真 vs Agent 工作区交付

## 5. 环境变量

| 变量 | 必填 | 说明 |
|------|------|------|
| `LINGZHI_BASE_URL` | 否 | 默认 `http://127.0.0.1:8230` |
| `LINGZHI_API_KEY` | 演示可空 | 空则 KbKernel offline |
| `LINGZHI_CAMP_KEYS` | 否 | `campA:lz_xxx,campB:lz_yyy` |
| `ANYCODE_DASHBOARD_URL` | 否 | Workbench HTTP base；空/不可达时 Agent `auto`→stub，`live`→失败 |
| `ANYCODE_API_TOKEN` | 生产建议 | Bearer token |
| `ANYCODE_COACH_SKILL_ID` | 否 | 默认 `fde-coach` |
| `ANYCODE_SSE_TIMEOUT_SEC` | 否 | 默认 `180` |
| `AGENT_MODE` | 否 | `auto\|live\|stub`；**prod=live** |
| `FDE_WORKSPACE_ROOT` | 否 | `./data/workspaces` |
| `FDE_INTERNAL_BASE` | 否 | coach 调 Kb / evidence |

## 6. 配置确认表（打码）

| 项 | 来源 | 当前 |
|----|------|------|
| 灵知端口 | lingzhi `deploy/.env` | `8230` |
| 灵知 Key | 需在灵知管理台创建 | 未写入本仓（用 env） |
| anyCode Workbench | 无头 serve / sidecar | `127.0.0.1:43180` |
| anyCode Token | Secret `ANYCODE_API_TOKEN` | 生产必配 |
| FDE 统一 API | 本仓 | `8760` |

## 7. 验证清单

1. `curl -H "Authorization: Bearer $TOKEN" $ANYCODE/api/health`
2. Agent job：`runner=anycode`，`job_events` 含 `anycode` 进度，工作区有产物
3. Coach `/ask` → `coach_mode=full`；`/ask/stream` 有 `delta`
4. `AGENT_MODE=live` 且 anyCode 断开 → Agent **失败**而非 stub
