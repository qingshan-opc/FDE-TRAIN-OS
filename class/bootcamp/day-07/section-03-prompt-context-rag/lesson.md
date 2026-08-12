# 第 3 节 · 怎么下指令、塞材料、查资料再答（15′ · 概念）

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

## 🎬 口播稿（6 段 · 课堂口语风格 · 待过审）

> 过稿主文件：`PPT_AND_NARRATION.md`；分词稿：`video/scripts/narration/`。**未过稿前不跑 TTS/渲染。**


## 常见懵点

- 详见 `ai-tutor.yaml` suggested_questions；
- 所有「选型」题留到认知卡作业，课内只列事实不讲唯一答案。
