# Day 6 · 把大模型接到你的业务对话里

> 今日目标：把 DeepSeek（或兼容协议）接到 **你的业务系统助手位（或任意页面对话面板）**，完成 **真实多轮对话**；其余节用最短时间巩固 18 词与 Agent/Harness 地图，为本周 Skill/Loop 铺路。
> 总时长约 105′ · 五节概念/实战

## 这一天在解决什么

载体仍是 **Week1 同一应用**，不是换新产品。  
有看板更好看；没有就直接挂对话面板。

今天硬交付：

1. 助手位（或对话面板）**真实 LLM 多轮对话**（system prompt 可改），证据进 `runs/chat-smoke/`；
2. 理论词典过线：18 词与 Agent 循环图——重心是「应用内可聊」。

教学包：[`class/teaching/week2-cockpit-agent/`](../../teaching/week2-cockpit-agent/README.md)

## 章节地图

| 节 | 目录 | 标题 | 分钟 | 形式 | 可验收产出 |
|---|------|------|-----|------|-----------|
| 1 | `section-01-ecosystem-four-layers/` | 四层地图：在哪儿接上大模型 | 30′ | 概念+实战 | 应用内多轮对话 |
| 2 | `section-02-token-window-hallucination/` | 字数账单、记忆上限、一本正经胡说 | 15′ | 概念 | 快测依据 |
| 3 | `section-03-prompt-context-rag/` | 怎么下指令、塞材料、查资料再答 | 15′ | 概念 | 快测依据 |
| 4 | `section-04-eval-guardrails-vibe/` | 出考卷、加护栏、边聊边写代码 | 15′ | 概念 | 快测依据 |
| 5 | `section-05-agent-harness-mcp/` | 智能体、骨架、工具手、统一插座 | 20′ | 概念 | 预告 Loop |

## 今日验收（GATE）

- 助手位/对话面板可多轮对话；system prompt 在仓库文件中可改；
- 日级概念快测过线；
- 企业任务：`llm-cognition-card.md`（可写上「接电」体会）。

## 每节文件

`lesson.md` · `practice.md` · `resources.md` · `homework.md` · `ai-tutor.yaml`
