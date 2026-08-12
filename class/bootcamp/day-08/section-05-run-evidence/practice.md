# 第 5 节 · 练习：加载·运行·证据

## 任务

1. 实现扫描器 + `skill` 工具/API（可与对话打通，或先 CLI）。
2. 跑通一次真实业务输入。
3. 归档：

```
runs/<日期>-<skill>/
├── input.md
├── output.md
└── verdict.md
```

## 一键粘贴提示词

**本节专用**（假定上一节 `SKILL.md` 已定稿；不要重写说明书）：

[`class/teaching/week2-cockpit-agent/prompts/03b-skill-run-evidence.md`](../../../teaching/week2-cockpit-agent/prompts/03b-skill-run-evidence.md)

若上一节会话还开着，也可回复「继续完成加载与 run」，但改动范围仍以本节为准。

## 过关标准

- Skill 可被列出（Available skills）；
- 至少成功 run 1 次且 verdict 通过或诚实记录失败原因；
- 证据进 Git。
