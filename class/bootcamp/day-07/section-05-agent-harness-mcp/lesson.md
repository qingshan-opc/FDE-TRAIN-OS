# 第 5 节 · 智能体、骨架、工具手、统一插座（20′ · 概念）

> 一句话节引言：Agent 决策，Harness 骨架，Tool 是手，MCP 是插座——Workflow 写死，副驾模式 只递扳手。

## 🎬 视频位

> 动态 HTML PPT（对齐 `class/schedule` 编辑风）+ 右下角数字人口播。音色=dhx Qwen3-TTS 克隆（laowu）；口型=本地 Wav2Lip。

- 工程：`video/`
- 成片：`video/renders/day06-c5-agent.mp4`（已入库 MinIO）
- 口播源稿：`video/scripts/narration/`
- 样式参考：`class/schedule/index.html`、Day05 `section-01-worldview-plain/video/`

## 教学目标

- 描述 Agent 循环：理解→规划→Tool Call→观察→继续；
- 说清 Harness 组成及同一模型不同 Harness 的差异；
- 对比 Workflow vs Agent、副驾模式 vs 智能体；解释 MCP 与 Skill 关系。

## 讲解图

![Agent 循环 · Harness · MCP](../../assets/diagrams/agent-loop.svg)

## 讲授要点

### Agent · 智能体

```
理解任务 → 规划步骤 → Tool Call → 观察结果 → 继续/完成/求助
```

- 代表：TRAE 智能体；
- 你定**目的地 + 验收**；它选路线。

### Harness · 智能体骨架

模型之外的循环：**工具表 · 记忆 · 规划器 · 重试 · 日志 · 权限**

- 同一 GPT-4，TRAE vs 简陋脚本 = 不同 Harness；
- Week 2 封装 Skill = 给 Agent 加可靠 Harness。

### Tool Calling · 工具调用

模型输出结构化请求 → Harness 执行 → 结果塞回上下文：

```json
{"tool": "search_db", "args": {"week": "2026-W30"}}
```

驾驶舱 API 的 function calling 已是雏形。

### MCP · Model Context Protocol

- AI 接工具/数据源的 **USB-C 标准**；
- 写一个 MCP Server，TRAE 都能用；
- **Skill ≈ 朴素版 MCP**：SKILL.md + 工具描述 + 执行约定。

### Workflow vs Agent

| Workflow | Agent |
|----------|-------|
| 人画死流程图 | 模型现场决策下一步 |
| 稳定、可审计 | 灵活、需 Eval |
| 报销审批 | 「整理乱文件成 PRD」 |

**原则**：能写死就写死，写不死才 Agent。

### 副驾模式 vs 智能体

| 副驾模式 | Agent |
|---------|-------|
| 你开车，它递扳手 | 你定目的地，它开 |
| 补全、局部问答 | 多步、跨文件、调工具 |
| 错一行改一行 | 错可能改坏十文件 |

信任与验收要求：Agent >> 副驾模式。

## 🎬 口播稿（7 段 · 课堂口语风格 · 待过审）

> 过稿主文件：`PPT_AND_NARRATION.md`；分词稿：`video/scripts/narration/`。**未过稿前不跑 TTS/渲染。**


## 常见懵点

- 详见 `ai-tutor.yaml` suggested_questions；
- 所有「选型」题留到认知卡作业，课内只列事实不讲唯一答案。
