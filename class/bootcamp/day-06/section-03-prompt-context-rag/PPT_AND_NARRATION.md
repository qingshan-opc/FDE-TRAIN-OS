# 第六天 · 第 3 节 · Prompt / Context / RAG / Fine-tune vs Prompt

路径：`class/bootcamp/day-06/section-03-prompt-context-rag/video/`  
PPT：`video/index.html`（**仅讲解图 + 概念要点，无口播正文**）  
分词稿：`video/scripts/narration/`

> 口播以分词稿为准 · TTS 后需重跑 `patch_section_video_timing.py`

---

## 01 · open

**PPT（屏幕）**
- 眉题：01 OPEN · 四词总览
- Prompt · Context · RAG · Fine-tune
- 设计一次调用的「视野」

**口播**
> 同学们，上一节搞懂了窗口是硬顶，满了得会装填，对吧。这一节呢，四个词串成一条线：Prompt、Context Engineering、RAG，还有 Fine-tuning 跟 Prompting 怎么选。第一天你们解剖过 PM Agent 的提示词——今天升级成系统视角：不是随手写一段话，而是设计「这一次调用，模型到底能看见啥、该怎么干」，嘛。

文稿：`video/scripts/narration/01-open.txt`

---

## 02 · prompt

**PPT（屏幕）**
- 眉题：02 PROMPT · 任务说明书
- 讲解图：prompt-four-elements.svg
- 角色 · 背景 · 任务 · 约束 · 格式

**口播**
> 先说 Prompt 工程，就是给模型的任务说明书。五个要素记牢：角色、背景、任务、约束、输出格式。第一天练过的 PM Agent 提示词，就是标准件——能改、能验、能迭代。坏 Prompt 长啥样？「帮我写个摘要」——格式没写、边界没写，模型只能瞎猜。好 Prompt 呢，工程师看完不用再回来问第二遍：你是部门助理，基于下面 JSON，二百字以内周报摘要，不许编造没出现的人名。像写接口契约一样写 Prompt，对吧。

文稿：`video/scripts/narration/02-prompt.txt`

---

## 03 · context

**PPT（屏幕）**
- 眉题：03 CONTEXT · 装填术
- 讲解图：context-assembly.svg
- 给少了瞎编 · 给多了迷失

**口播**
> 第二个词，Context Engineering，上下文工程——决定这次调用往窗口里装啥。公式很简单：系统 Prompt，加上检索到的文档块，加上用户最新消息，必要的话再加工具说明。给少了，模型靠训练记忆瞎编，就是上一节的幻觉；给多了，它「迷失在中间」，关键约束反而被淹没。驾驶舱摘要举例：该放本周 JSON 数据和 PRD 风格说明，还是整份数据库表结构？放最新一条用户消息，还是把三天聊天记录全塞进去？这是手艺，不是玄学，嘛。

文稿：`video/scripts/narration/03-context.txt`

---

## 04 · rag

**PPT（屏幕）**
- 眉题：04 RAG · 检索增强
- 流程：切块 → 嵌入 → 检索 → 拼 Prompt → 生成
- 驾驶舱摘要 = 简化版 RAG

**口播**
> 第三个，RAG，检索增强生成——治幻觉的主流药方之一。流程记五步：文档切块，嵌成向量，存进向量库；用户提问时，检索最相关的几段，拼进 Prompt，再让模型生成。打个比方，RAG 就像开卷考试——先翻资料再答题，不是闭着眼硬编。企业里可以是向量库、关键词搜索，或者 Wiki。你们第五天那个「基于本周数据生成摘要」，思想就是简化版 RAG：数据库就是「资料库」，查出来再喂给模型，对吧。

文稿：`video/scripts/narration/04-rag.txt`

---

## 05 · finetune

**PPT（屏幕）**
- 眉题：05 FINE-TUNE vs PROMPT
- 双列：改权重（贵慢）vs 改话术（快便宜）
- 90% 场景先用 Prompt

**口播**
> 最后说选型：Fine-tuning 跟 Prompting。Fine-tuning 改的是模型权重，贵、慢、持久；Prompting 改的是你给模型的话，快、便宜、随时能调。咱们 FDE 的默认姿势：九成场景先用 Prompt 加 RAG 加 Eval 三板斧，Fine-tune 写进「以后再说」。只有当你需要固定风格、固定格式，Prompt 怎么写都不稳，才考虑微调。别一上来就说「我们要训一个模型」——先把 Prompt 方案验收过了再说，呢。

文稿：`video/scripts/narration/05-finetune.txt`

---

## 06 · close

**PPT（屏幕）**
- 眉题：06 TAKEAWAY
- Prompt=说明书 · Context=装填 · RAG=外挂记忆
- 预告：Eval · Guardrails

**口播**
> 好，第三节收一下。带走四句：Prompt 是说明书，Context 是装填术，RAG 是外挂记忆，Fine-tune 是最后手段。下一节咱们讲 Eval、Guardrails 和 Vibe Coding——怎么给 AI 出考卷、怎么拦越界，还有 Cursor 写代码爽归爽、验收责任在谁。同学们有问题，先翻讲解图，再回来听，对吧。

文稿：`video/scripts/narration/06-close.txt`

---

## 评审清单

- [x] PPT 无口播正文，仅图 + 概念卡/表
- [x] 口播与 `narration/*.txt` 一致
- [ ] TTS 后 patch 时间轴并重渲
