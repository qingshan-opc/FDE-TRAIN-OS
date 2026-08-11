# 提示词 02 · 驾驶舱助手位接 LLM 多轮对话（D6）

> 整份粘贴到编码 AI。前置：周末驾驶舱首页与助手位空槽已存在。

---

你是资深工程师。请把学员驾驶舱右侧 **AI 助手位** 接到真实 LLM（优先 DeepSeek，兼容 OpenAI Chat Completions）。

## 目标

1. 浏览器里可多轮对话（流式 SSE 优先，不行则一次性响应并注明）。
2. system prompt 放在仓库文件中（例如 `agent/prompts/cockpit_assistant.md`），修改文件后重启即生效。
3. 后端提供最小 API：`POST /api/agent/chat`（或等价），body 含 `messages[]`。
4. API Key 只放环境变量（`DEEPSEEK_API_KEY` / `OPENAI_API_KEY`），禁止写进前端。

## 目录约定

按 `class/teaching/week2-cockpit-agent/scaffold/README.md`：

- `agent/llm_client.py`
- `agent/prompts/cockpit_assistant.md`
- 驾驶舱前端助手位绑定到该 API

## 验收

- 改 system prompt 后，助手口吻/职责明显变化。
- 连续 ≥3 轮对话上下文不断。
- 在 `runs/chat-smoke/` 保存一次请求摘要（可脱敏）与截图说明。

## 先做

1. 检查现有后端语言与启动方式，选择最小侵入接入点。
2. 列出改动计划，等我「确认」后再写代码。
3. 给一份本地 `.env.example` 与启动步骤。

原则：今天只做「能聊」；工具 / Skill 下周再挂，别一次做完。
