# Day 8 · Skill 工程化 + 遇见 Agent

> 结构依据：`docs/spec/0.4/curriculum-v0.6.md`（实战主课 + 公开课拆分）
> 今日目标：**Skill 从「能跑」到「可依赖」（边界声明 + 异常注入测试），并掀开引擎盖——理解 Agent 怎么跑起来，让 Agent 正确调用你的 Skill**
> 总时长 105′ · 4 节 · 概念 35′，实战 70′；GATE 走 Lab / 企业任务，不单开验收课

## 这一天在解决什么

Day 7 的 Skill 在「乖数据」上二连过了。但真实世界的输入不乖：数据缺失、格式错误、接口超时。今天做两件事：

1. **工程化**：给 Skill 声明边界（什么输入我不接）、分类异常（坏了怎么坏）——然后用异常注入测试证明「它按声明的方式失败」（第 1–2 节，55′）；
2. **掀引擎盖**：Harness = 模型 + 工具 + 记忆 + 循环；Agent = 跑在骨架上的角色；决策环 = 理解→规划→调工具→观察→继续。你的 Skill 从此成为 Agent 工具表上的一件工具（第 3–4 节，50′）。

**不再单开一节「验收课」**——Agent 闭环与 GATE 8 在 Lab / 企业任务节点完成。

> 概念只讲最小必要版；ReAct 论文、多 Agent 框架、MCP 深入 → 公开课 O2。

## 章节地图

| 节 | 目录 | 标题 | 分钟 | 形式 | 可验收产出 |
|---|------|------|-----|------|-----------|
| 1 | `section-01-boundary-exceptions/` | 概念：边界与异常——从能跑到可依赖 | 15′ | 概念 | 口答：异常四分类 |
| 2 | `section-02-harden-skill/` | 实战：Skill v1 + 异常注入测试 | 40′ | 实战 | Skill v1（带边界声明）+ 注入测试全过 |
| 3 | `section-03-agent-harness/` | 概念：Agent 与 Harness 解剖 | 20′ | 概念 | 快答：Harness 四要素 + 决策环 |
| 4 | `section-04-agent-calls-skill/` | 实战：让 Agent 调用你的 Skill | 30′ | 实战 | 自然语言任务 → Agent 正确调用 Skill |

## 每节文件（tabs）

每节目录固定五个文件：`lesson.md`（课件，含 🎬 口播稿位）· `practice.md`（练习）· `resources.md`（资源）· `homework.md`（作业）· `ai-tutor.yaml`（AI 导师配置：规则 / 快捷问题 / 验收规则）。

口播课件：`video/scripts/narration/`（若有）；第 5 节验收口播已撤出大纲（素材可留在旧目录，不进课表）。

## 今日验收（GATE 8）

- Skill v1 含边界声明（不接受的输入 + 失败时的行为）；
- 异常注入 ≥3 种坏输入，Skill 均「按声明的方式失败」（不胡编、不硬撑）；
- Agent 闭环演示：自然语言下任务 → Agent 选对并调用你的 Skill → 产出过验收；
- 口答：Harness 四要素、决策环、workflow vs agent 的区别、你的 Agent「什么时候会选错」；
- commit：`feat: Skill v1 工程化 + Agent v0.1`。
