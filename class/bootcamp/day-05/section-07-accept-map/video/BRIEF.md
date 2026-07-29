---
workflow: general-video
flow: automation
storyboard: no
message: "第一周最后一道手续：快测 18 题过线 12 + 理论地图六大主题过闸。"
destination: course-lesson
aspect: "16:9"
language: zh
audience: bootcamp-learners
length: "~3.4min"
angle: "课表同款编辑风 · 全屏动态 PPT + 右下角数字人口播 · 验收简报"
---

## Intent

第 5 课第 6 节（验收简报，短于概念课）。视觉语言对齐 `class/schedule/` 与 S01（浅底 `#f2f5f0`、电蓝 `#1400ff`、宋体标题、等宽标签、厚分割线）。口播课堂口语，口径对齐 `day.yaml`：快测 18/12；理论地图六大主题（世界观 / 开发流程 / 服务器与云原生 / 命令行 / 前端选型 / 后端选型）。

## Assets

- 音色克隆：dhx Qwen3-TTS（laowu）→ `audio/narration-full.wav`（脚手架暂为静音占位，待 TTS）
- 口型：本地 Wav2Lip → `assets/avatar-lipsync.mp4`（muted；脚手架暂复用 S01 口型片）
- 讲解图：`assets/diagrams/day5-fullstack-theory.svg`
- 字体 / 肖像：复用 S01 `assets/fonts/*`、`lecturer-portrait.jpg`

## Notes

- 样式参考：`class/schedule/index.html` + S01 `video/index.html`
- PiP 右下角，正文 `padding-right: 420px` 避让
- 成片目标：`renders/day05-s06-accept.mp4`
