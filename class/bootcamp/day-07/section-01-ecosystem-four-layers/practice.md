# 第 1 节 · 练习：四层地图：在哪儿接上大模型

## 知识确认（3′）

1. LLM 的核心机制用一句话怎么说？
2. 「调云端 API」和「自部署权重」各适合什么场景（各一句）？
3. 一次性 JSON 响应和 SSE 流式，用户体验差在哪？本课助手位建议用哪种？

## 实操任务（15′）· 驾驶舱助手位接 LLM

目标：在 **你的应用**（助手位或任意对话面板）跑通真实多轮对话（优先 SSE）。

### 一键粘贴提示词（教学包全文）

整份打开并复制：

[`class/teaching/week2-cockpit-agent/prompts/02-llm-chat-panel.md`](../../../teaching/week2-cockpit-agent/prompts/02-llm-chat-panel.md)

粘贴到 TRAE，按提示先出计划，你回复「确认」后再改代码。

### 手工检查清单

- [ ] Key 不在前端；环境变量或教务网关
- [ ] 助手位可 ≥3 轮连续对话
- [ ] system prompt 在仓库文件中，改完重启生效
- [ ] `runs/chat-smoke/` 有一次脱敏记录或截图说明

## 完成标志

- [ ] 四层名称顺序正确；
- [ ] 驾驶舱内可聊（或书面 blocker + 助教确认的降级）；
- [ ] 能向同桌演示改 system prompt 前后差异。
