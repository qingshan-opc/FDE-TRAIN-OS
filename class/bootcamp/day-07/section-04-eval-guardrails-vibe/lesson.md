# 第 4 节 · 出考卷、加护栏、边聊边写代码（15′ · 概念）

> 一句话节引言：Eval 代替「我觉得还行」；Guardrails 拦越界；Vibe Coding 爽但验收责任在你——训练营练的就是「带验收的 vibe」。

## 🎬 视频位

> 动态 HTML PPT（对齐 `class/schedule` 编辑风）+ 右下角数字人口播。音色=dhx Qwen3-TTS 克隆（laowu）；口型=本地 Wav2Lip。

- 工程：`video/`
- 成片：`video/renders/day06-c4-eval.mp4`（已入库 MinIO）
- 口播源稿：`video/scripts/narration/`
- 样式参考：`class/schedule/index.html`、Day05 `section-01-worldview-plain/video/`

## 教学目标

- 设计朴素 Eval：固定题库 + 判分 + 可重复；
- 列举 Guardrails 三类：输入过滤、输出约束、越界降级；
- 说清 Vibe Coding 的生产力与风险，强调验收不 vibe。

## 讲解图

![Eval · Guardrails · Vibe 三角](../../assets/diagrams/llm-ops-triangle.svg)

## 讲授要点

### Eval · 评测

- 给 AI 产物出考卷：**固定输入 + 期望输出/判分规则 + 可重复跑**；
- 例子：20 条摘要 case，检查是否包含数据字段、是否 hallucinate 人名；
- Day 1 Rubric、快测选择题 = Eval 朴素版；
- 模型/Prompt 改版 → 重跑 Eval，分数掉就别发版。

### Guardrails · 护栏

拦在输入输出上的规则：

1. **输入过滤**：敏感词、PII、越权请求（「给我全员工资」）；
2. **输出约束**：必须 JSON、必须 cite 来源、禁止医疗/法律断言；
3. **越界降级**：检索为空 → 模板拒答；超时 → 缓存/人工；不要瞎编。

驾驶舱三条必须有：**敏感词 / 空结果 / 超时**。

### Vibe Coding · 氛围编程

- 自然语言描述意图，AI 写代码（Cursor、Copilot、Claude Code）；
- Day 3 大头 HTML = vibe 产物；
- **爽点**：快；**风险**：逻辑错、安全洞、不可维护；
- **带验收的 vibe**：diff 可以 vibe，合并进 main 必须 Eval + 人工看关键路径。

```
生产力 ────────► Vibe Coding
       │
       ▼
可靠性 ◄──────── Eval + Guardrails
```

## 🎬 口播稿（6 段 · 课堂口语风格 · 待过审）

> 过稿主文件：`PPT_AND_NARRATION.md`；分词稿：`video/scripts/narration/`。**未过稿前不跑 TTS/渲染。**


## 常见懵点

- 详见 `ai-tutor.yaml` suggested_questions；
- 所有「选型」题留到认知卡作业，课内只列事实不讲唯一答案。
