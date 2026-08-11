# Day 10 · V2.0 收官：驾驶舱 Agent 全接线（展示 D10）

> 今日目标：把已跑通的 chat / loop / task_runner **挂进驾驶舱 UI**；答辩讲清四层关系。
> 总时长 110′

## 这一天在解决什么

助手位不是「空了九天的装饰」——你本周每天都在给它通电。今天收口：

1. UI 事件流：turn / tool / confirm / done；
2. 十条证据自证；
3. 8′ 答辩 + 两周复盘。

教学包：[`prompts/06-wire-cockpit-ui.md`](../../teaching/week2-cockpit-agent/prompts/06-wire-cockpit-ui.md)  
总验收：[`acceptance/checklist.md`](../../teaching/week2-cockpit-agent/acceptance/checklist.md)

## 章节地图

| 节 | 目录 | 标题 | 分钟 | 形式 | 可验收产出 |
|---|------|------|-----|------|-----------|
| 1 | `section-01-agent-in-cockpit/` | UI 接线 Agent | 30′ | 实战 | 页内可聊可确认 |
| 2 | `section-02-ten-evidences/` | 十条能力证据 | 20′ | 实战 | 自证 10/10 |
| 3 | `section-03-defense-prep/` | 答辩提纲 | 15′ | 实战 | defense 一页纸 |
| 4 | `section-04-defense/` | 答辩与互评 | 30′ | 答辩 | GATE 10 |
| 5 | `section-05-two-week-review/` | 复盘与路线 | 15′ | 概念 | final-review.md |

## 今日验收（GATE 10）

- 助手位多轮 + Skill 调用 + 确认闸在页内可操作；
- loop 有上限与日志；长任务 ≥3 turn 可演示；
- 答辩讲清：业务系统 / 驾驶舱 / Skill / Loop；
- `docs/final-review.md` + `docs/defense-demo.md`；
- commit：`feat: cockpit agent v2.0`.
