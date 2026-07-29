# Day 6 · LLM 理论日：18 词过线

> 结构依据：`class/schedule/index.html` 第 02 节 LLM 生态 + 第 03 节新概念词典 18 词
> 今日目标：**把前五天「用过 AI」的体感，升级为能讲清边界、能查词典、能验收产出的 LLM 理论框架**
> 总时长 120′ · 6 节 · 纯概念 + 抽测验收，不配新 Lab（部署/V1.0 内容保留在旧目录作参考，本日新节优先）

## 这一天在解决什么

Day 1 快测和公开课 O4 已经甩给你 18 个行业日常词——Harness、RAG、Eval、Vibe Coding……
前五天你在 PRD、架构、原型、接口、全栈理论里**碰过**其中大半，但可能还处在「听过、用过大模型、说不清机制」的状态。

理论课为什么放在第六天？**先有全栈地图，再补 LLM 词典。**
现在讲 Token 窗口，你能对着 API_Spec 里的请求体说「这段 context 快满了」；讲 RAG，你能指着驾驶舱的摘要接口说「这就是检索增强的一种」。

今天的节奏：没有新代码、没有新提示词——每节 18–25 分钟完整讲授，跟着讲解图把 18 词装进脑子。
下课前一道手续：**18 词抽测 ≥ 12/18**，加上个人 LLM 认知卡 `llm-cognition-card.md`。

> 部署上线 V1.0（旧版 Day 6）材料已归档至 [`_archive/day-06-deploy/`](../_archive/day-06-deploy/)，Week 2 或公开课 O3 按需自学。

## 章节地图

| 节 | 目录 | 标题 | 分钟 | 形式 | 可验收产出 |
|---|------|------|-----|------|-----------|
| 1 | `section-01-ecosystem-four-layers/` | 生态四层地图：你在哪一层 | 20′ | 概念 | 快测题 1–3 的答题依据 |
| 2 | `section-02-token-window-hallucination/` | Token / 窗口 / 幻觉：能力与边界 | 20′ | 概念 | 快测题 4–6 的答题依据 |
| 3 | `section-03-prompt-context-rag/` | Prompt / Context / RAG / Fine-tune vs Prompt | 20′ | 概念 | 快测题 7–9 的答题依据 |
| 4 | `section-04-eval-guardrails-vibe/` | Eval / Guardrails / Vibe Coding | 20′ | 概念 | 快测题 10–12 的答题依据 |
| 5 | `section-05-agent-harness-mcp/` | Agent / Harness / Tool / MCP / Workflow vs Agent | 25′ | 概念 | 快测题 13–15 的答题依据 |
| 6 | `section-06-accept-18words/` | 验收：18 词抽测 + 认知卡过闸 | 15′ | 验收 | 抽测 ≥12/18 + 认知卡提交 |

## 每节文件（tabs）

每节目录固定五个文件：`lesson.md`（课件，含 🎬 口播稿）· `practice.md`（练习）· `resources.md`（资源）· `homework.md`（作业）· `ai-tutor.yaml`（AI 导师配置）。

口播课件：`video/scripts/narration/` + `video/package.json` + `video/BRIEF.md`；**成片已全部入库 MinIO**（`day06-c1` … `day06-c6`）。

## 今日验收（GATE · LLM 认知过线）

- 18 词抽测 ≥ **12/18**（AI 导师按节级题库随机抽问，解析必须看懂，不是蒙对）；
- 企业任务：提交 LLM 认知卡 `llm-cognition-card.md`（**六大主题**：生态四层 / Token与幻觉 / Prompt与RAG / Eval与护栏 / Agent与Harness / Copilot vs Agent，每主题 2–3 条要点，每条配前五天真实实例或自己的类比，无照抄）；
- 词典自测：能口头解释任意 3 个词给同桌听，同桌能复述核心一句。
