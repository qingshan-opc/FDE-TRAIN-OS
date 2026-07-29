# 第 1 节 · 生态四层地图：你在哪一层（30′ · 概念 + SSE 接电实战）

> 一句话节引言：LLM 不是黑盒——先看清生态四层，再学会用 **API + SSE** 把模型接到产品里。

## 🎬 视频位

> 动态 HTML PPT（对齐 `class/schedule` 编辑风）+ 右下角数字人口播。音色=dhx Qwen3-TTS 克隆（laowu）；口型=本地 Wav2Lip。

- 工程：`video/`
- 成片：`video/renders/day06-c1-ecosystem.mp4`（已入库 MinIO；改稿后需重渲）
- 口播源稿：`video/scripts/narration/`
- 样式参考：`class/schedule/index.html`、Day05 `section-01-worldview-plain/video/`

## 教学目标

- 说清 LLM 的本质机制：预测下一个词，生成/理解/推理由此长出；
- 区分「调云端 API」与「自部署权重」；本课优先开源模型的云 API（如 DeepSeek）；
- 看懂四层地图（基建→模型→编排→应用），标出 FDE 主要工作层；
- **区分一次性 JSON 响应与 SSE 流式推送**；助手位/摘要类 UX **建议 SSE**；
- 完成最小实战：按给定提示词，集成 DeepSeek（flash）的 SSE 流式对话（或摘要）能力。

## 讲解图

![LLM 生态分层图](../../assets/diagrams/llm-ecosystem.svg)

## 讲授要点

### 四层生态地图（讲解图主线）

```
L4 应用层    驾驶舱 · Cursor · 企业 SaaS · 聊天产品
L3 编排层    RAG · Agent · Workflow · Prompt 管线
L2 模型层    GPT-4o · Claude 3.5 · Qwen · DeepSeek
L1 基建层    GPU 集群 · 向量库 · 模型网关 · 托管平台
```

### LLM · 大语言模型

- 机制：用海量文本训练，**预测下一个 Token**；
- 能力：生成、理解、推理、Tool Call——都从接龙机制长出；
- 边界：不是事实库，输出必须验收（下节细讲幻觉）。

### 开源权重 vs 闭源 API

| | 闭源 API | 开源权重（也可走云 API） |
|---|---------|-------------------------|
| 代表 | OpenAI、Anthropic、Google | DeepSeek、Qwen、Llama… |
| 拿到方式 | 调 endpoint，按 Token 付费 | 云 API 按量，或下载权重自部署 |
| 权衡 | 快、省心、能力顶 | 成本/隐私/运维——训练营默认 **云 API** |

### 接入形态：一次性 API 响应 vs SSE 流式

> 很多人把「API」和「SSE」对立——不对。**SSE 是 API 的一种返回方式**（流式通道），不是另一家供应商。

| | 一次性响应（非流式） | SSE 流式（推荐） |
|---|---------------------|------------------|
| 行为 | 请求发出 → 等整包 JSON → 一次渲染 | 请求发出 → 服务端按 Token/事件一段段推 → 边收边显示 |
| 协议感 | 普通 HTTP `POST` + `application/json` | 多为 `stream: true` + `text/event-stream`（Server-Sent Events） |
| 用户体验 | 干等十几秒突然蹦出全文 | 像 ChatGPT：字一个个出来，体感快、可中途停 |
| 适用 | 批处理、离线任务、只要最终结果 | **驾驶舱助手位、摘要预览、任何「人在等」的对话** |
| 和 WebSocket | — | SSE **单向**（服务端→浏览器）就够聊天流；双向长连才上 WS（本课不深挖） |

**本课接入建议**

1. 模型：DeepSeek 云 API（课内示例模型名可用 `deepseek-flash` / 教务指定型号）；
2. 通道：**开流式 + 用 SSE 收事件**（前端 `EventSource` 或 `fetch` 读 stream；后端代理密钥，禁止把 Key 写进前端仓库）；
3. 降级：流断了 → 显示「生成中断，可重试」；网关挂了 → 模板摘要/空态，**禁止假装成功**。

### 多模态 · Multimodal

- 不只文本：看图、听音、出图；
- **本课边界**：驾驶舱只用文本能力——摘要、问答、Tool Call；
- 先把文本 + SSE 链路跑通，再谈多模态。

### FDE 站在哪一层？

- **应用层**：驾驶舱、验收、用户体验（含「字一个个出来」的体感）；
- **编排层**：Prompt、流式状态机、超时/重试——Week 2 主战场；
- 模型层/基建层：知道名字和权衡即可。

## 🎬 口播稿

> 过稿主文件：`PPT_AND_NARRATION.md`；分词稿：`video/scripts/narration/`。  
> 真相源：`scripts/section_narrations/day06_s01.yaml`。

## 常见懵点

- 「SSE 是不是另一种 API？」→ 不是；是流式返回通道。
- 「密钥写进 HTML？」→ 绝不；走后端或平台代持。
- 详见 `ai-tutor.yaml` suggested_questions。
