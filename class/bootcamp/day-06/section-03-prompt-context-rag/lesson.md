# 第 3 节 · Prompt / Context / RAG / Fine-tune vs Prompt（20′ · 概念）

> 一句话节引言：Prompt 是说明书，Context 是装填术，RAG 是外挂记忆——Fine-tune 是最后才动的那把刀。

## 🎬 视频位

> 动态 HTML PPT（对齐 `class/schedule` 编辑风）+ 右下角数字人口播。音色=dhx Qwen3-TTS 克隆（laowu）；口型=本地 Wav2Lip。

- 工程：`video/`
- 成片：`video/renders/day06-c3-rag.mp4`（已入库 MinIO）
- 口播源稿：`video/scripts/narration/`
- 样式参考：`class/schedule/index.html`、Day05 `section-01-worldview-plain/video/`

## 教学目标

- 用四要素+约束+格式复述 Prompt 工程；
- 解释 Context Engineering：给少瞎编、给多迷失；
- 走通 RAG 五步管线，对比 Fine-tuning vs Prompting 选型。

## 讲解图

![Context 组装与 RAG 管线](../../assets/diagrams/context-assembly.svg)

## 讲授要点

### Prompt 工程

四要素（Day 1 已练）：**角色 + 背景 + 任务 + 输出格式**，再加 **约束**（不许做什么）。

坏 Prompt：「帮我写个摘要」——缺格式、缺边界。
好 Prompt：「你是部门助理；基于下列 JSON 数据；生成 200 字以内周报摘要；不许编造未出现的人名。」

### Context Engineering

决定**这次调用放什么进窗口**：

```
[系统 Prompt] + [检索到的文档块] + [用户最新消息] + [必要工具说明]
```

- 给少了 → 模型用训练记忆瞎编（幻觉）；
- 给多了 → 「迷失在中间」——忽略关键约束。

驾驶舱摘要：放本周 JSON 数据 + PRD 摘要风格 + 用户问题——不放整份 Git 历史。

### RAG · 检索增强生成

```
文档 → 切块 → 嵌入向量 → 存入向量库
                ↓
用户问 → 检索 Top-K 片段 → 拼进 Prompt → 模型生成
```

- 治幻觉的主流方案之一；
- 驾驶舱「基于本周数据生成摘要」= 简化 RAG（数据库即「库」）。

### Fine-tuning vs Prompting

| | Prompting | Fine-tuning |
|---|-----------|-------------|
| 改什么 | 给模型的话 | 模型权重 |
| 成本 | 低、快 | 高、慢 |
| 适用 | 90% 场景 | 固定格式/风格且 Prompt 不稳 |

**FDE 默认**：Prompt + RAG + Eval 三板斧，Fine-tune 写进「以后再说」。

## 🎬 口播稿（约 6 段 · 待审）

> 同学们，第三节四个词：Prompt、Context Engineering、RAG、Fine-tuning vs Prompting。第一天 你们解剖过 PM 提示词——今天升级到系统视角：不是写一段话，而是设计一次调用的视野。
> Prompt 工程是给模型的任务说明书：角色、背景、任务、约束、输出格式。PM Agent 提示词就是标准件——可迭代、可验收。坏 Prompt 的特征：没说清输出格式，没说清不许做什么。好 Prompt：工程师看完不用回来问第二遍，对吧。
> Context Engineering 是决定这次调用放什么进窗口。给少了——模型瞎编；给多了——它迷失在中间。驾驶舱摘要：该放 PRD 片段还是整份 DB Schema？放最新用户消息还是全历史？这是手艺，不是玄学，对吧。
> RAG 检索增强生成：先从资料库捞相关片段——向量库、关键词、企业 Wiki——再让模型基于片段回答。治幻觉的主流药方之一。流程：切块、嵌入、检索、拼进 Prompt、生成。你们驾驶舱基于本周数据生成摘要就是简化版 RAG 思想，对吧。
> Fine-tuning 改模型权重，贵、慢、持久；Prompting 改给模型的话，快、便宜。90% 场景先用后者。只有当你需要固定风格、固定格式、且 Prompt 怎么写都不稳，才考虑 Fine-tune。别一上来就我们要训一个模型——FDE 先验收 Prompt 方案，对吧。
> 收束：Prompt 是说明书，Context 是装填术，RAG 是外挂记忆，Fine-tune 是最后手段。下一节 Eval 和 Guardrails——怎么给 AI 出考卷、怎么拦越界，对吧。


## 常见懵点

- 详见 `ai-tutor.yaml` suggested_questions；
- 所有「选型」题留到认知卡作业，课内只列事实不讲唯一答案。
