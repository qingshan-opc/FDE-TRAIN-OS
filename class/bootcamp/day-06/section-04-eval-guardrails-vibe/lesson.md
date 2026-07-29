# 第 4 节 · Eval / Guardrails / Vibe Coding（20′ · 概念）

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

## 🎬 口播稿（约 6 段 · 待审）

> 同学们，第四节三个词，都是你们已经在做、但今天给名字：Eval、Guardrails、Vibe Coding。训练营全程练的是带验收的 vibe coding——自然语言描述意图让 AI 写代码，爽点是真的，背锅也是真的。
> Eval 评测：给 AI 产物出考卷。固定题库、明确判分、可重复跑——代替我觉得还行。第一天 的 Rubric、快测的选择题，都是 Eval 的朴素版。上线前：准备 20 条边界 case，模型改版后重跑，分数掉了就别发版，对吧。
> Guardrails 护栏：拦在输入输出上的规则。什么不许问——比如要别人员工工资；什么不许答——比如没检索到就瞎编政策；越界怎么办——拒答、转人工、降级模板。企业驾驶舱必须有：敏感词、空结果、超时，三条降级路径，对吧。
> Vibe Coding 氛围编程：Cursor、Copilot、Claude Code——你描述意图，AI 写 diff。第三天 大头 HTML 是 AI 写的，对吧。但验收不能 vibe：接口返回 200 不够，要对契约；摘要对不上数据，要回滚 Prompt。会 vibe 的人变贵，只会 vibe 不验收的人变便宜。
> 三角关系：Eval 告诉你好不好；Guardrails 告诉你敢不敢上线；Vibe Coding 是生产力杠杆。缺 Eval 是盲飞；缺 Guardrails 是裸奔；缺验收的 Vibe 是技术债工厂，对吧。
> 带走一句：我觉得还行不是验收标准，Eval 才是。下一节 Agent 全家桶——Harness、MCP、Workflow 和 Agent 怎么分，对吧。


## 常见懵点

- 详见 `ai-tutor.yaml` suggested_questions；
- 所有「选型」题留到认知卡作业，课内只列事实不讲唯一答案。
