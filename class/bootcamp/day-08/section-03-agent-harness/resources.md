# 第 3 节 · 资源

## 必读

- 讲解图：[Harness 解剖](../../assets/diagrams/harness-anatomy.svg) · [决策环](../../assets/diagrams/agent-loop.svg) · [workflow vs agent](../../assets/diagrams/workflow-vs-agent.svg)

## 词汇卡

| 词 | 一句话 |
|---|--------|
| Harness | 让模型干活的骨架：模型+工具表+记忆+循环 |
| Agent | 跑在骨架上的角色（说明书+人格+目标） |
| 决策环 | 理解→规划→调工具→观察→继续 |
| 工具调用（tool call） | 模型输出「我要用 X 工具，参数是 Y」的结构化请求 |
| workflow | 步骤定死的自动化（明天学） |

## 你已经在造的 Agent（对照表）

```
ai-tutor.yaml 的 persona   → Agent 的角色/人格
rules                     → Agent 的行为约束
suggested_questions       → Agent 的引导策略
acceptance                → Agent 的验收工具
你的 Skill                → Agent 工具表上的一件工具
```

## 选读（公开课）

- O2 Agent 篇：ReAct 循环、MCP 协议、多 Agent 协作
- O4 词典：「harness / agent / 决策环 / tool call」词条
