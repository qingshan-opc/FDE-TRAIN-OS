# Day 8 · Skill 工程化 + Agent Loop（展示 D8）

> 今日目标：Skill 可依赖（边界+注入测试）+ 落地 **`agent/loop.py` tool_calls 闭环**。
> 总时长 105′

## 这一天在解决什么

1. Skill v1：边界声明 + ≥3 坏输入按声明失败；
2. 掀开 Harness：模型 + 工具 + 记忆 + **循环**；
3. **必须跑通** `loop.py`：LLM → tool_calls → 执行 → 回灌 → 下一轮（`max_turns` 默认 20）。

教学包：[`prompts/04-agent-loop.md`](../../teaching/week2-cockpit-agent/prompts/04-agent-loop.md)  
地图：[`agent-minimap.md`](../../teaching/week2-cockpit-agent/agent-minimap.md)

## 章节地图

| 节 | 目录 | 标题 | 分钟 | 形式 | 可验收产出 |
|---|------|------|-----|------|-----------|
| 1 | `section-01-boundary-exceptions/` | 边界与异常 | 15′ | 概念 | 异常四分类 |
| 2 | `section-02-harden-skill/` | Skill v1 + 注入测试 | 35′ | 实战 | 边界声明 + 测试 |
| 3 | `section-03-agent-harness/` | Harness 与决策环 | 20′ | 概念 | 四要素 + 环 |
| 4 | `section-04-agent-calls-skill/` | 实现 Agent Loop | 35′ | 实战 | `loop.py` + log.jsonl |

## 今日验收（GATE 8）

- Skill v1 边界 + ≥3 注入失败符合声明；
- `agent/loop.py`（或等价）可演示 tool_calls 闭环；
- `runs/` 有多 turn 工具日志；
- 口答：什么时候会选错 Skill；
- commit：`feat: agent loop + skill v1`.
