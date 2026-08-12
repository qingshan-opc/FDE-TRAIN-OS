# 第 2 节 · 字数账单、记忆上限、一本正经胡说（15′ · 概念）

> 一句话节引言：Token 是钱也是注意力；窗口是硬顶；幻觉是机制——三件绑在一起理解，才不会对模型有不切实际的期待。

## 🎬 视频位

> 动态 HTML PPT（对齐 `class/schedule` 编辑风）+ 右下角数字人口播。音色=dhx Qwen3-TTS 克隆（laowu）；口型=本地 Wav2Lip。

- 工程：`video/`
- 成片：`video/renders/day06-c2-token.mp4`（已入库 MinIO）
- 口播源稿：`video/scripts/narration/`
- 样式参考：`class/schedule/index.html`、Day05 `section-01-worldview-plain/video/`

## 教学目标

- 解释 Token 计量方式及与成本/速度的关系；
- 说清上下文窗口上限及满了之后的三种策略；
- 把幻觉定义为机制而非 bug，并给出 FDE 验收对策。

## 讲解图

![LLM 能力与边界](../../assets/diagrams/llm-capability.svg)

## 讲授要点

### Token 与上下文窗口

- **Token**：模型读写最小单位；中文约 0.6–1 字/Token，英文约 0.75 词/Token；
- **计费**：API 按 input + output Token 收费——对话越长越贵；
- **上下文窗口**：一次调用能「看到」的 Token 上限（如 GPT-4o 128K、Claude 200K）。

窗口满了怎么办？

1. **截断**：丢掉最早的消息（简单但有信息损失）；
2. **摘要压缩**：让模型先把历史总结成短段（省 Token，有摘要误差）；
3. **RAG**：只检索相关片段进窗口（第三节细讲）。

### 幻觉 · Hallucination

- 定义：给「最像真的」而非「核实过的」答案；
- 例子：编造不存在的论文 DOI、错认 API 字段、捏造数据；
- **不是 bug**：训练目标是流畅 plausible，不是 fact-check；
- **FDE 对策**：关键事实可溯源（RAG/数据库）、Rubric 验收、Guardrails 空结果拒答。

### 能力边界清单

| 擅长 | 不擅长 |
|------|--------|
| 语言生成、模式匹配、代码补全 | 实时股价、未训练私有事实 |
| 结构化输出（配合 Prompt） | 精确大数计算（要工具） |
| 多步推理（配合 CoT） | 100% 无幻觉（不可能） |

## 🎬 口播稿（6 段 · 课堂口语风格 · 待过审）

> 过稿主文件：`PPT_AND_NARRATION.md`；分词稿：`video/scripts/narration/`。**未过稿前不跑 TTS/渲染。**


## 常见懵点

- 详见 `ai-tutor.yaml` suggested_questions；
- 所有「选型」题留到认知卡作业，课内只列事实不讲唯一答案。
