# 第 4 节 · 练习：实现「想→做→看→再想」循环

## 任务

落地 `agent/loop.py`（或等价）：LLM → tool_calls → 执行 → 回灌 → 下一轮；`max_turns` 默认 20。

最小工具：`file_read` + `skill`。日志写入 `runs/.../log.jsonl`。

## 一键粘贴提示词（编码任务）
> 整份粘贴给 **编码 AI / TRAE** 改仓库。尖括号 `〈〉` 换成你的路径或名称。


[`class/teaching/week2-cockpit-agent/prompts/04-agent-loop.md`](../../../teaching/week2-cockpit-agent/prompts/04-agent-loop.md)

地图：[`agent-minimap.md`](../../../teaching/week2-cockpit-agent/agent-minimap.md)

## 实测三任务

| 任务 | 期望 |
|------|------|
| A「根据最新列表生成周报」 | 应调 skill / file_read |
| B「现在几点了」 | 不应乱调业务 Skill |
| C 模糊指令 | 记录选错并改 system/工具描述 |

## 过关标准

- loop 可演示 ≥2 turn 工具调用；
- 超限可停止；
- 选错图谱记入 `docs/agent-tool-map.md`。
