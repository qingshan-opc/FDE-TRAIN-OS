# 仿真适配侧（Simulation Adapter Layer）

> `runner: sim` 的交互实验 **不启动** Docker / K8s / 云 IDE 真环境。  
> 打开实验 = 加载对应 `SimAdapter` 前端 + 服务端状态机。  
> 网页制作等长任务请用 `runner: agent`（见 [agent-gateway.md](./agent-gateway.md)）。

## 1. 统一契约

所有适配器实现同一协议（Python 伪接口，见 `sim/protocol.py`）：

```text
SimAdapter {
  kind: web_dev | server | k8s | arch_design | ...
  createSession(taskSpec, learnerSeed) -> sessionId
  getViewModel(sessionId) -> UI schema + state snapshot
  applyAction(sessionId, action) -> { state, events, hints }
  evaluate(sessionId, rubric) -> { pass, checks[], artifacts }
  exportEvidence(sessionId) -> files/logs for passport
  reset(sessionId) / destroy(sessionId)
  getStateSummary(sessionId) -> coach-facing text/json  # AI 导师用
}
```

### 1.1 HTTP 面（由 `services/sim-router` 暴露）

| Method | Path | 说明 |
|--------|------|------|
| POST | `/api/v1/sim/sessions` | body: `{ task_id, learner_id, seed? }` → session |
| GET | `/api/v1/sim/sessions/{id}` | view model + snapshot |
| POST | `/api/v1/sim/sessions/{id}/actions` | 执行学员动作 |
| POST | `/api/v1/sim/sessions/{id}/evaluate` | 跑 rubric |
| GET | `/api/v1/sim/sessions/{id}/evidence` | 导出证据 |
| POST | `/api/v1/sim/sessions/{id}/reset` | 重置到 seed |
| DELETE | `/api/v1/sim/sessions/{id}` | 销毁 |

### 1.2 Action 信封

```json
{
  "type": "terminal.exec | fs.write | preview.refresh | kubectl | canvas.update | ...",
  "payload": {},
  "client_ts": "ISO-8601"
}
```

### 1.3 Evaluate 结果

```json
{
  "pass": false,
  "checks": [
    { "id": "resource_exists", "ok": true, "detail": "Deployment/api found" },
    { "id": "command_sequence", "ok": false, "detail": "missing rollout status" }
  ],
  "artifacts": [{ "name": "transcript.json", "uri": "s3://..." }],
  "score": 0.5
}
```

## 2. 四类首发 kind

### 2.1 `web_dev` — 网页开发

| 项 | 说明 |
|----|------|
| 学员 UI | 虚拟文件树 + 编辑器 + 预览 iframe |
| 服务端 | 内存 FS；HTML/CSS/JS 在浏览器沙箱 iframe 运行 |
| 典型动作 | `fs.write`, `fs.read`, `preview.refresh` |
| 验收 | DOM 断言、表单校验、可访问性、必现文案 |
| 目录 | `sim/adapters/web_dev/` |

### 2.2 `server` — 服务器学习

| 项 | 说明 |
|----|------|
| 学员 UI | 伪终端 + 进程/端口/日志面板 |
| 服务端 | 状态机：进程、文件树、systemd unit、nginx 效果 |
| 典型动作 | `terminal.exec`（白名单命令语义解析，非真 shell） |
| 验收 | 命令序列、端口监听、配置生效标志 |
| 目录 | `sim/adapters/server/` |

### 2.3 `k8s` — Kubernetes 学习

| 项 | 说明 |
|----|------|
| 学员 UI | kubectl 风格 CLI + 资源拓扑图 |
| 服务端 | 集群对象图（Pod/Deploy/Svc/Ingress）+ 故障注入 |
| 典型动作 | `kubectl` 子命令解析 → 变更对象图 |
| 验收 | 资源存在、Ready、故障恢复、事件日志 |
| 目录 | `sim/adapters/k8s/` |

### 2.4 `arch_design` — 架构设计

| 项 | 说明 |
|----|------|
| 学员 UI | 约束画布（组件 / 依赖 / 非功能约束） |
| 服务端 | 图模型 + 规则引擎（成本 / 安全 / 时延） |
| 典型动作 | `canvas.add_node`, `canvas.link`, `canvas.set_nfr` |
| 验收 | 约束满足分 + 决策说明文本必填 |
| 目录 | `sim/adapters/arch_design/` |

## 3. 任务 YAML 中的 lab 段

```yaml
lab:
  sim_kind: k8s                 # 必填：路由键
  adapter_version: "1.0"
  seed:
    cluster_fixture: prod-like-mini
    faults: [CrashLoop]
    # 可选：按学员哈希做差异化
    diversify_by: learner_id
  ui:
    layout: cli_plus_topology
  rubric:
    - check: resource_exists
      args: { kind: Deployment, name: api }
    - check: command_sequence
      args: { contains: ["kubectl apply", "kubectl rollout status"] }
  coach:
    allow_state_summary: true
    max_help_level: 2           # LEVEL1–2；LEVEL3 需失败计数
```

完整日任务样例见：

- [`contracts/examples/day-02-web-landing.yaml`](../../contracts/examples/day-02-web-landing.yaml)
- [`contracts/examples/day-03-k8s-rollout.yaml`](../../contracts/examples/day-03-k8s-rollout.yaml)
- [`contracts/examples/day-07-arch-tradeoff.yaml`](../../contracts/examples/day-07-arch-tradeoff.yaml)
- [`contracts/examples/day-01-server-nginx.yaml`](../../contracts/examples/day-01-server-nginx.yaml)

## 4. 与真环境边界

| 路径 | 行为 |
|------|------|
| 学员 | 100% 仿真，无容器、无学员端口 |
| 教研出题 | 可用 anyCode / 本地工具生成 fixture、黄金轨迹 |
| 后期（不做） | `sim_kind: hybrid_container` 仅高阶班 |

## 5. 扩展新适配器

1. 在 `sim/adapters/<kind>/` 实现 `SimAdapter`
2. 在 `sim/registry.py` 注册 `kind → factory`
3. 增加任务 YAML 样例与 rubric checks
4. **不必改** orchestrator / coach-gateway（只认 `sim_kind`）

## 6. 路由逻辑

```text
SimRouter.create(task):
  kind = task.lab.sim_kind
  adapter = registry.get(kind)           # KeyError → 400
  assert adapter.version compatible with task.lab.adapter_version
  session = adapter.createSession(task.lab, seed)
  persist(session_id, kind, learner_id, task_id)
  return session_id
```
