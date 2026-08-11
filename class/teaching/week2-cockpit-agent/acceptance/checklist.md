# Week2 GATE 勾选总表（导师用）

## 选做 · 看板/助手位（不进硬闸）

- [ ] （可选）同仓可打开带摘要的首页
- [ ] （可选）有 AI 助手位或对话入口占位

**未做也不阻断 D6 Lab。**

## D6 · 应用内 LLM 对话（day-07）

- [ ] 助手位或对话面板可多轮对话（真实 LLM，非写死假回复）
- [ ] system prompt 可在文件中修改并生效
- [ ] 有至少 1 段对话截图或 `runs/` 记录

## D7 · Skill（day-08）

- [ ] ≥1 个 `skills/<id>/SKILL.md`（含 name/description）
- [ ] 能从对话或 CLI 触发该 Skill
- [ ] `runs/<date>-<skill>/` 有 input/output/verdict

## D8 · Agent Loop（day-09）

- [ ] `agent/loop.py`（或等价）可跑：LLM → tool_calls → 执行 → 回灌
- [ ] 有 turn 上限（建议 20）
- [ ] `runs/` 中有 tool 调用日志

## D9 · 长任务 + HITL（day-10）

- [ ] `task_runner` 对一个 goal 跑 ≥3 turn
- [ ] 写操作前出现人工确认闸（approve / reject 两条路径都有证据）
- [ ] ≥2 个 Skill 参与编排或可被选中

## D10 · V2.0 收官（day-11）

- [ ] 助手位 UI 接到真实 loop/task 事件（至少：开始 / 工具调用 / 结束）
- [ ] 答辩 8′ 能讲清：业务系统 / 驾驶舱 / Skill / Loop 四层关系
- [ ] 十条能力证据或本清单关键项齐全
