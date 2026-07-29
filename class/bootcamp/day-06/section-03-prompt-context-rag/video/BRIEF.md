---
workflow: general-video
flow: automation
storyboard: no
message: "怎么写任务说明书、怎么装填上下文、RAG 怎么治幻觉、什么时候才值得 Fine-tune。"
destination: course-lesson
aspect: "16:9"
language: zh
audience: bootcamp-learners
length: "~20min"
angle: "课表同款编辑风 · 全屏动态 PPT + 右下角数字人口播"
---

## Intent

第 6 课第 3 节 · Prompt / Context / RAG / Fine-tune vs Prompt。视觉语言对齐 `class/schedule/`（浅底 `#f2f5f0`、电蓝 `#1400ff`）。口播跟 narration scripts。

## Assets

- 讲解图：`../../assets/diagrams/context-assembly.svg`（或 `/course-assets/assets/diagrams/context-assembly.svg`）
- 音色克隆：dhx Qwen3-TTS（laowu）→ `audio/narration-full.wav`
- 口型：本地 Wav2Lip → `assets/avatar-lipsync.mp4`（muted）

## Slides（脚手架）

| id | 主题 |
|----|------|
| slide-01-open | 第三节四个词：Prompt、Context Engineer… |
| slide-02-prompt | Prompt 工程是给模型的任务说明书：角色、背景、任务、约… |
| slide-03-context | Context Engineering 是决定这次调用放什么… |
| slide-04-rag | RAG 检索增强生成：先从资料库捞相关片段——向量库、关键词… |
| slide-05-finetune | Fine-tuning 改模型权重，贵、慢、持久；Promp… |
| slide-06-close | 收束：Prompt 是说明书，Context 是装填术，RA… |

## Notes

- 样式参考：`class/schedule/index.html` + Day05 S01 `video/index.html`
- PiP 右下角，正文 `padding-right: 420px` 避让
- 每 slide ≥1 结构化块 + ≥1 具体名词（GPT/Claude/MCP 等）
