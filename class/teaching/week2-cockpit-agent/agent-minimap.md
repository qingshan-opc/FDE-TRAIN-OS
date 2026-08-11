# 学员最小 Agent 地图（自给自足）

学员只在自己的 Week1 仓库里实现下表；**不需要、也不应去读任何外部 Agent 产品源码**。

| 能力 | 你要落地的文件 / 行为 |
|------|------------------------|
| 对话入口 | `POST /api/agent/chat` + 助手位 UI |
| Skill 说明书 | `skills/<id>/SKILL.md`（frontmatter + 四部件） |
| Skill 扫描 | 启动时扫描 `skills/*/SKILL.md`，列出可用 Skill |
| Skill 调用 | 工具 `skill(name, input)` → 写 `runs/` |
| 单轮循环 | `agent/loop.py`：`run_turn(messages)` |
| 长任务 | `agent/task_runner.py`：`run_goal(goal)` + 人工确认闸 |
| 轮次上限 | 默认 `max_turns=20`，可配置，超限停止 |
| 系统提示 | `agent/prompts/agent_loop.md` |
| 工具分发 | `agent/tools.py`：`dispatch(name, args)` |

## 刻意不做（MVP 外）

MCP、嵌套 Agent、完整记忆管线、独立桌面客户端。
