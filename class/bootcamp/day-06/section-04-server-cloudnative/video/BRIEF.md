---
workflow: general-video
flow: automation
storyboard: no
message: "服务器的二十五年搬家史——物理机、虚拟机、容器、K8s、Serverless，再到命令行八句上手。"
destination: course-lesson
aspect: "16:9"
language: zh
audience: bootcamp-learners
length: "~6.9min (口播估算占位；TTS 后回填)"
angle: "课表同款编辑风 · 全屏动态 PPT + 右下角数字人口播"
---

## Intent

第 5 课第 3 节。视觉语言对齐 `class/schedule/` 与第 1 节（浅底 `#f2f5f0`、电蓝 `#1400ff`、宋体标题、等宽标签、厚分割线与 ladder）。口播改写成 S01 课堂口语（同学们 / 呢 / 对吧）。

## Assets

- 音色克隆：dhx Qwen3-TTS（laowu）→ `audio/narration-full.wav`（待产）
- 口型：本地 Wav2Lip → `assets/avatar-lipsync.mp4`（待产；muted PiP）
- 人像：`assets/lecturer-portrait.jpg`（自 S01 复用）
- 讲解图：`assets/diagrams/day5-cloud-native.svg`

## Notes

- 样式参考：`section-01-worldview-plain/video/index.html`
- PiP 右下角 248×380，字幕在视频下方；正文 `padding-right: 420px` 避让
- 幻灯顺序：物理机 → 虚拟机 → 容器 → K8s → Serverless → 云原生一句话 → 命令行八句 foreshadow → close
- **勿在本脚手架阶段跑 TTS / Wav2Lip / render**；timing 为估算占位，产音频后按 `audio/timing.json` 回填
