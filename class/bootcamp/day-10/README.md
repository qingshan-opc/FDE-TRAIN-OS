# Day 9 · 长任务 Loop + 人工确认（展示 D9）

> 今日目标：自建 `task_runner` 长跑 + 写操作 **HITL 确认闸** + ≥2 Skill 编排；approve/reject 双路径留证。
> 总时长 95′

## 这一天在解决什么

1. 编排观：流程可拆成 Skill 串联；
2. 确认闸三问：不可撤回步骤前必须人点头；
3. **真跑** `task_runner.py`：goal ≥3 turn；UI/API 可 approve/reject。

教学包：[`prompts/05-long-task-hitl.md`](../../teaching/week2-cockpit-agent/prompts/05-long-task-hitl.md)

## 章节地图

| 节 | 目录 | 标题 | 分钟 | 形式 | 可验收产出 |
|---|------|------|-----|------|-----------|
| 1 | `section-01-process-as-orchestration/` | 业务流程即编排 | 15′ | 概念 | 串联图 |
| 2 | `section-02-human-confirm/` | 人工确认与日志 | 15′ | 概念 | 确认闸三问 |
| 3 | `section-03-two-more-skills/` | 再封装 Skill | 25′ | 实战 | 工具表 ≥2 |
| 4 | `section-04-orchestrate/` | task_runner + HITL | 40′ | 实战 | 双路径证据 |

## 今日验收（GATE 9）

- ≥2 个 Skill；
- 一个 goal ≥3 turn；
- approve 与 reject 各有一次 `runs/` 证据；
- 执行日志可回放；
- commit：`feat: long-task runner with HITL`.
