# 提示词 05 · 长任务 Loop + 人工确认闸（D9）

> 整份粘贴。前置：`loop.py` 已能 tool_calls。

---

在本仓库实现 `agent/task_runner.py`：把「一个 goal」拆成多 turn，并在写操作前停下来等人确认。

## 长任务

```
run_goal(goal: str):
  messages = [system_task, user(goal)]
  while turns < max_turns:
    result = run_one_turn(messages)  # 复用 loop
    if result.done: break
    if result.needs_human_confirm:
      pause → 等待 approve/reject API 或 CLI
      if reject: 记录并停止或改计划
  写 runs/<date>-goal/ 全量日志
```

## HITL（人工确认闸）硬性要求

- 任何 **写操作**（写文件、改数据库、调用变更类 API）前必须 `needs_human_confirm=true`  
- 提供：
  - `POST /api/agent/tasks` 启动  
  - `POST /api/agent/tasks/{id}/approve`  
  - `POST /api/agent/tasks/{id}/reject`  
- 证据：`runs/` 中同时保留 **approve 成功路径** 与 **reject 中止路径** 各一次

## Skill 编排

仓库内 ≥2 个 Skill；长任务 goal 应能依次用到至少两个（例如：拉数 → 生成报告 →（确认后）写入 `runs/` 或草稿文件）。

## 验收

- 单个 goal ≥3 个 turn  
- 确认闸可演示通过与拒绝  
- 日志可回放  

先计划后编码。
