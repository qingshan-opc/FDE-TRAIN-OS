# Day 7 · 第一个可执行 Skill（展示 D7）

> 今日目标：在 **已接通 LLM 的应用** 上，落地可加载、可调用的第一个 Skill。
> 总时长 100′ · 概念 45′ · 实战 55′

## 这一天在解决什么

叙事（请背下来）：

```
Week1 业务系统 → 昨天应用内可聊 → 今天给它装「可执行能力」= Skill
```

系统是壳，Skill 是被 Agent 调用的说明书+工具。

1. 换档：系统被使用，能力被执行；
2. 解剖四部件；三筛法选题；
3. 用教学包提示词实现 `skills/*/SKILL.md` 扫描 + 可 run，证据进 `runs/`。

教学包：第4节 [`03a-define-skill-md.md`](../../teaching/week2-cockpit-agent/prompts/03a-define-skill-md.md) · 第5节 [`03b-skill-run-evidence.md`](../../teaching/week2-cockpit-agent/prompts/03b-skill-run-evidence.md)

## 章节地图

| 节 | 目录 | 标题 | 分钟 | 形式 | 可验收产出 |
|---|------|------|-----|------|-----------|
| 1 | `section-01-system-to-skill/` | 从系统到能力 | 15′ | 概念 | 口答 Prompt vs Skill |
| 2 | `section-02-skill-anatomy/` | Skill 四部件 | 15′ | 概念 | 四部件快答 |
| 3 | `section-03-pick-first/` | 三筛法选题 | 15′ | 方法 | 选定第一 Skill |
| 4 | `section-04-define-skill/` | 定义 SKILL.md | 30′ | 实战 | `skills/<id>/SKILL.md` |
| 5 | `section-05-run-evidence/` | 加载·运行·证据 | 25′ | 实战 | 扫描器 + runs/ |

## 今日验收（GATE 7）

- ≥1 个合格 `SKILL.md`（name/description + 四部件）；
- 能从 API/CLI/对话触发一次真实业务数据上的运行；
- `runs/<date>-<skill>/` 含 input/output/verdict；
- commit：`feat: first executable skill`.
