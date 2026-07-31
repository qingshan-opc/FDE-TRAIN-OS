---
workflow: general-video
flow: automation
storyboard: no
message: "软件不是灵感一闪——六站流程：调研 → 原型 → 开发验收 → 上线 → 运维；瀑布一次走完 vs 敏捷小步快跑。"
destination: course-lesson
aspect: "16:9"
language: zh
audience: bootcamp-learners
length: "~4.5min"
angle: "课表同款编辑风 · 全屏动态 PPT + 右下角数字人口播"
---

## Intent

第 5 课第 2 节。视觉语言对齐 `class/schedule/`（浅底 `#f2f5f0`、电蓝 `#1400ff`、宋体标题、等宽标签、厚分割线与 ladder）。口播跟本节 lesson「口播稿」，语气对齐 S01 课堂口语。

## Assets

- 音色克隆：dhx Qwen3-TTS（laowu）→ `audio/narration-full.wav`
- 口型：本地 Wav2Lip → `assets/avatar-lipsync.mp4`（muted）
- 肖像：`assets/lecturer-portrait.jpg`（自 S01 复制）
- 讲解图：`assets/diagrams/day5-dev-process.svg`

## Notes

- 样式参考：`class/schedule/index.html` + S01 `section-01-worldview-plain/video/`
- PiP 右下角，正文 `padding-right: 420px` 避让；字幕条在 PiP 下方
- `data-duration` 先占位合计 ~270s，TTS 后按 timing 回填
