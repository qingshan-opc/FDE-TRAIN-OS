# 第 5 节 · Agent / Harness / Tool / MCP / Workflow vs Agent（25′ · 概念）

> 一句话节引言：Agent 决策，Harness 骨架，Tool 是手，MCP 是插座——Workflow 写死，Copilot 只递扳手。

## 🎬 视频位

> 动态 HTML PPT（对齐 `class/schedule` 编辑风）+ 右下角数字人口播。音色=dhx Qwen3-TTS 克隆（laowu）；口型=本地 Wav2Lip。

- 工程：`video/`
- 成片：`video/renders/day06-c5-agent.mp4`（已入库 MinIO）
- 口播源稿：`video/scripts/narration/`
- 样式参考：`class/schedule/index.html`、Day05 `section-01-worldview-plain/video/`

## 教学目标

- 描述 Agent 循环：理解→规划→Tool Call→观察→继续；
- 说清 Harness 组成及同一模型不同 Harness 的差异；
- 对比 Workflow vs Agent、Copilot vs Agent；解释 MCP 与 Skill 关系。

## 讲解图

![Agent 循环 · Harness · MCP](../../assets/diagrams/agent-loop.svg)

## 讲授要点

### Agent · 智能体

```
理解任务 → 规划步骤 → Tool Call → 观察结果 → 继续/完成/求助
```

- 代表：Cursor Agent、Claude Code、OpenAI Assistants；
- 你定**目的地 + 验收**；它选路线。

### Harness · 智能体骨架

模型之外的循环：**工具表 · 记忆 · 规划器 · 重试 · 日志 · 权限**

- 同一 GPT-4，Cursor vs 简陋脚本 = 不同 Harness；
- Week 2 封装 Skill = 给 Agent 加可靠 Harness。

### Tool Calling · 工具调用

模型输出结构化请求 → Harness 执行 → 结果塞回上下文：

```json
{"tool": "search_db", "args": {"week": "2026-W30"}}
```

驾驶舱 API 的 function calling 已是雏形。

### MCP · Model Context Protocol

- AI 接工具/数据源的 **USB-C 标准**；
- 写一个 MCP Server，Cursor / Claude Desktop 都能用；
- **Skill ≈ 朴素版 MCP**：SKILL.md + 工具描述 + 执行约定。

### Workflow vs Agent

| Workflow | Agent |
|----------|-------|
| 人画死流程图 | 模型现场决策下一步 |
| 稳定、可审计 | 灵活、需 Eval |
| 报销审批 | 「整理乱文件成 PRD」 |

**原则**：能写死就写死，写不死才 Agent。

### Copilot vs Agent

| Copilot | Agent |
|---------|-------|
| 你开车，它递扳手 | 你定目的地，它开 |
| 补全、局部问答 | 多步、跨文件、调工具 |
| 错一行改一行 | 错可能改坏十文件 |

信任与验收要求：Agent >> Copilot。

## 🎬 口播稿（约 7 段 · 待审）

> 同学们，第五节最长，六个词一次讲清：Agent、Harness、Tool Calling、MCP、Workflow vs Agent、Copilot vs Agent。第二周 你们要封装 Skill——今天先把骨架名词对齐，别到时候 Harness 和 MCP 混成一团。
> Agent 智能体：能自己决定下一步的 AI。理解任务、规划、调工具、看结果、继续——直到完成或求助。Cursor Agent 模式、Claude Code、OpenAI Assistants 都是。你定目的地和验收，它选路线，对吧。
> Harness 是模型外面的循环：工具表、记忆、规划、重试、日志。同一个 GPT-4，换一副 Harness，能力天差地别。Tool Calling 是模型输出结构化请求我要调 search，参数 q=周报——Harness 执行后把结果喂回去。你们 API 里的 function calling 就是这个，对吧。
> MCP Model Context Protocol：给 AI 接工具和数据源的 USB-C 标准。按 MCP 写一个服务，Cursor、Claude Desktop、各种 Agent 都能插。训练营 Skill 是朴素版 MCP——读 SKILL.md，调工具，交付结果。第二周 会亲手写，对吧。
> Workflow vs Agent：Workflow 是人画死的流程图——先 A 再 B 再 C；Agent 是模型现场决定下一步。能写死就写死，写不死才上 Agent。报销审批适合 Workflow；帮我把这堆乱文件整理成 PRD适合 Agent，对吧。
> Copilot vs Agent：Copilot 是你开车它递扳手——补全、问答、局部改写；Agent 是你定目的地它开——接任务、跑多步、调工具。信任要求和验收完全不同。Copilot 错了改一行；Agent 错了可能改坏十个文件——所以日志、回滚、Eval 更关键，对吧。
> 六词口诀：Agent 决策，Harness 骨架，Tool 手，MCP 插座，Workflow 写死，Copilot 副驾。最后一节 18 词抽测——检验今天有没有真过线，对吧。


## 常见懵点

- 详见 `ai-tutor.yaml` suggested_questions；
- 所有「选型」题留到认知卡作业，课内只列事实不讲唯一答案。
