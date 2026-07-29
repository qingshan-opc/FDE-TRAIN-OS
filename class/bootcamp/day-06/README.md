# Day 6 · LLM 理论日：18 词过线

> 结构依据：`class/schedule/index.html` 第 02 节 LLM 生态 + 第 03 节新概念词典 18 词
> 今日目标：**把前五天「用过 AI」的体感，升级为能讲清边界、能查词典、能连到自己项目的 LLM 理论框架**
> 总时长 105′ · 5 节 · 纯概念；抽测走概念验收节点，收束靠企业任务认知卡（带提示词）

## 这一天在解决什么

Day 1 快测和公开课 O4 已经甩给你 18 个行业日常词——Harness、RAG、Eval、Vibe Coding……
前五天你在 PRD、架构、原型、接口、全栈理论里**碰过**其中大半，但可能还处在「听过、用过大模型、说不清机制」的状态。

理论课为什么放在第六天？**先有全栈地图，再补 LLM 词典。**
现在讲 Token 窗口，你能对着 API_Spec 里的请求体说「这段 context 快满了」；讲 RAG，你能指着驾驶舱的摘要接口说「这就是检索增强的一种」。

今天的节奏：没有新代码——每节 18–25 分钟完整讲授，跟着讲解图把词装进脑子。
**不再单开一节「验收课」**——抽测走「Day6 概念验收」节点；收束靠企业任务：提交 LLM 认知卡（可用提示词先梳理，实例必须自己填）。

> 部署上线 V1.0（旧版 Day 6）材料已归档至 [`_archive/day-06-deploy/`](../_archive/day-06-deploy/)，Week 2 或公开课 O3 按需自学。

## 章节地图

| 节 | 目录 | 标题 | 分钟 | 形式 | 可验收产出 |
|---|------|------|-----|------|-----------|
| 1 | `section-01-ecosystem-four-layers/` | 生态四层地图：你在哪一层 | 20′ | 概念 | 快测题依据 |
| 2 | `section-02-token-window-hallucination/` | Token / 窗口 / 幻觉：能力与边界 | 20′ | 概念 | 快测题依据 |
| 3 | `section-03-prompt-context-rag/` | Prompt / Context / RAG / Fine-tune vs Prompt | 20′ | 概念 | 快测题依据 |
| 4 | `section-04-eval-guardrails-vibe/` | Eval / Guardrails / Vibe Coding | 20′ | 概念 | 快测题依据 |
| 5 | `section-05-agent-harness-mcp/` | Agent / Harness / Tool / MCP / Workflow vs Agent | 25′ | 概念 | 快测题依据 |

## 每节文件（tabs）

每节目录固定：`lesson.md` · `practice.md` · `resources.md` · `homework.md` · `ai-tutor.yaml`（若有）。

口播课件：`video/scripts/narration/`；成片在 MinIO（`day06-c1` … `day06-c5`）。第 6 节验收口播已撤出大纲（素材可留在旧目录，不进课表）。

## 今日验收（GATE · LLM 认知过线）

- 18 词抽测 ≥ **12/18**（「Day6 概念验收」节点，解析必须看懂）；
- 企业任务：提交 LLM 认知卡 `llm-cognition-card.md`（**六大主题**：生态四层 / Token与幻觉 / Prompt与RAG / Eval与护栏 / Agent与Harness / Copilot vs Agent；每主题 2–3 条要点，每条配前五天真实实例或自己的类比；可用「认知卡 · 搭档提示词」先梳骨架）。
