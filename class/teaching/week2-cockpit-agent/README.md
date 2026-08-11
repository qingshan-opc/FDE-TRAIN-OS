# Week2 · Agent 内核实战（教学包）

> 学员用 **AI 编码工具**（Cursor / anyCode / Claude Code 等）在自己的 Week1 仓库里落地最小 Agent 内核。  
> 载体始终是 **自己的业务系统**（有看板更好看，驾驶舱桥接非必做）。  
> **自给自足**：提示词只描述「要建成什么」，不要求学员去读任何外部 Agent 产品源码。

## 叙事主线

```
Week1 业务系统（CRUD 可运行）
  → （选做）加成看板 / 助手位空槽
  → D6：应用内真实 LLM 多轮对话
  → D7：Skill 可加载、可调用
  → D8：Agent Loop（tool_calls 闭环）
  → D9：长任务 Loop + 人工确认闸
  → D10：UI 全链路接线 + 答辩 V2.0
```

同一应用，不是换产品。

## 本包文件

| 路径 | 用途 |
|------|------|
| [`prompts/01-cockpit-from-system.md`](prompts/01-cockpit-from-system.md) | **选做**：业务系统 → 看板/助手位 |
| [`prompts/02-llm-chat-panel.md`](prompts/02-llm-chat-panel.md) | D6：对话面板 / 助手位 LLM |
| [`prompts/03a-define-skill-md.md`](prompts/03a-define-skill-md.md) | D7 第4节：只写 `SKILL.md` |
| [`prompts/03b-skill-run-evidence.md`](prompts/03b-skill-run-evidence.md) | D7 第5节：加载 · 运行 · 证据 |
| [`prompts/03-skill-loader.md`](prompts/03-skill-loader.md) | （赶进度）03a+03b 合并版 |
| [`prompts/04-agent-loop.md`](prompts/04-agent-loop.md) | D8：turn loop |
| [`prompts/05-long-task-hitl.md`](prompts/05-long-task-hitl.md) | D9：长任务 + HITL |
| [`prompts/06-wire-cockpit-ui.md`](prompts/06-wire-cockpit-ui.md) | D10：事件流挂 UI |
| [`scaffold/README.md`](scaffold/README.md) | 学员仓库目录约定 |
| [`acceptance/checklist.md`](acceptance/checklist.md) | 导师 GATE 勾选 |
| [`agent-minimap.md`](agent-minimap.md) | 最小能力 ↔ 文件对照（自给自足） |

## 功能硬条件（V2.0 不可缺）

1. 应用内嵌对话（system prompt + 多轮）
2. `skills/*/SKILL.md` 可加载并可被调用
3. Agent loop：LLM → tool_calls → 执行 → 回灌 → 下一轮（有 turn 上限）
4. 长任务模式 + 写操作前人工确认闸
5. 关键路径有 `runs/` 或等价证据
