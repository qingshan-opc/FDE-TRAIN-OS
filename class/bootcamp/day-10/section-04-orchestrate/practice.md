# 第 4 节 · 练习：长跑任务机 + 人在回路确认闸

## 任务

实现并演示 `agent/task_runner.py`：

1. 一个业务 goal 跑 ≥3 turn；
2. 写操作前确认闸；
3. **approve** 与 **reject** 各留一次 `runs/` 证据；
4. 工具表 ≥2 个 Skill。

## 一键粘贴提示词

[`class/teaching/week2-cockpit-agent/prompts/05-long-task-hitl.md`](../../../teaching/week2-cockpit-agent/prompts/05-long-task-hitl.md)

## 检查表

| 检查点 | ✓/✗ |
|--------|-----|
| goal ≥3 turn | |
| 到闸自动停 | |
| 批准后继续 | |
| 驳回留痕并停止或回退 | |
| log 可回放 | |

## 过关标准

对照 [`acceptance/checklist.md`](../../../teaching/week2-cockpit-agent/acceptance/checklist.md) D9 段。
