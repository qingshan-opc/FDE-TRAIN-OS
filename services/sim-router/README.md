# sim-router

按任务 `lab.sim_kind` 路由到 `SimAdapter`，暴露统一 HTTP 面。

## 职责

- 创建 / 读写 / 评测 / 证据 / 重置仿真会话
- 学员路径 **零真环境**（无 Docker/K8s 拉起）
- 评测优先 `adapter.evaluate(rubric)`；教研侧可选 anyCode host gate（本阶段不做）

## HTTP

见 `docs/architecture/sim-adapters.md` §1.1。

实现入口：`app.py`；适配器注册见 `sim/registry.py`。
