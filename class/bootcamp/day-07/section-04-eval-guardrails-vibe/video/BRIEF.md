---
workflow: general-video
flow: automation
storyboard: no
message: "用 Eval 代替「我觉得还行」、用 Guardrails 拦越界、Vibe Coding 爽但验收责任在你。"
destination: course-lesson
aspect: "16:9"
language: zh
audience: bootcamp-learners
length: "~20min"
angle: "课表同款编辑风 · 全屏动态 PPT + 右下角数字人口播"
---

## Intent

第 6 课第 4 节 · 出考卷、加护栏、边聊边写代码。视觉语言对齐 `class/schedule/`（浅底 `#f2f5f0`、电蓝 `#1400ff`）。口播跟 narration scripts。

## Assets

- 讲解图：`../../assets/diagrams/llm-ops-triangle.svg`（或 `/course-assets/assets/diagrams/llm-ops-triangle.svg`）
- 音色克隆：dhx Qwen3-TTS（laowu）→ `audio/narration-full.wav`
- 口型：本地 Wav2Lip → `assets/avatar-lipsync.mp4`（muted）

## Slides（脚手架）

| id | 主题 |
|----|------|
| slide-01-open | 第四节三个词，都是你们已经在做、但今天给名字：Eval、Gu… |
| slide-02-eval | Eval 评测：给 AI 产物出考卷。固定题库、明确判分、可… |
| slide-03-guardrails | Guardrails 护栏：拦在输入输出上的规则。什么不许问… |
| slide-04-vibe | Vibe Coding 氛围编程：Cursor、Copilo… |
| slide-05-triangle | 三角关系：Eval 告诉你好不好；Guardrails 告诉… |
| slide-06-close | 带走一句：「我觉得还行」不是验收标准，Eval 才是。下一节… |

## Notes

- 样式参考：`class/schedule/index.html` + Day05 S01 `video/index.html`
- PiP 右下角，正文 `padding-right: 420px` 避让
- 每 slide ≥1 结构化块 + ≥1 具体名词（GPT/Claude/MCP 等）
