---
workflow: general-video
flow: automation
storyboard: no
message: "18 词抽测过线 + 个人 LLM 认知卡，证明词典不是背过是装进脑子。"
destination: course-lesson
aspect: "16:9"
language: zh
audience: bootcamp-learners
length: "~15min"
angle: "课表同款编辑风 · 全屏动态 PPT + 右下角数字人口播"
---

## Intent

第 6 课第 6 节 · 验收：18 词抽测 + 认知卡过闸。LLM 理论日最后一道手续——快测防"没学"，认知卡防"没连起来"。视觉语言对齐 `class/schedule/`（浅底 `#f2f5f0`、电蓝 `#1400ff`）。口播跟 narration scripts。

## Assets

- 讲解图：`../../assets/diagrams/four-layer.svg`、`llm-ecosystem.svg`、`v2-panorama.svg`、`ten-day-grid.svg`
- 真实照片：`assets/photos/01-open.jpg` ~ `04-gate.jpg`（4 张 Unsplash）
- 音色克隆：dhx Qwen3-TTS（laowu）→ `audio/narration-full.wav`
- 口型：本地 Wav2Lip → `assets/avatar-lipsync.mp4`（muted）

## Slides（5 段 · v2 富组件版）

| id | 主题 | 视觉组件 |
|----|------|---------|
| slide-01-open | 同学们，LLM 理论日最后一节——验收。两关：18 词抽测，… | side-photo + ladder 两关 + tag-row |
| slide-02-quiz | 第一关，随机抽 18 词里的 12 题，对 12 题过线。范… | photo-panel + chat-mock 题库示例 + duo 理解/背诵 |
| slide-03-card | 第二关，LLM 认知卡 llm-cognition-card… | photo-panel + hub-grid 六大主题 + tag-row |
| slide-04-gate | 过闸标准：抽测十二分之上；认知卡六大主题齐全；能口头向同桌解… | photo-panel + mile-rail 三标准 + duo + flow |
| slide-05-close | 六天前 LLM 是黑话；今天你有 18 个词的地图。带走一句… | invert + quote-big + hub-grid 六节收束 |

## Notes

- 样式参考：`class/schedule/index.html` + Day05 S01 `video/index.html` + Day06 S01 `video/index.html`
- PiP 右下角，正文 `padding-right: 420px` 避让
- 每 slide ≥1 结构化块 + ≥1 具体名词（18 词清单 / function calling / Skill / USB-C 等）
- slide-05 用 `.invert` 反色页收束，hub-grid 用 `.six` 列数展示六节毕业带走句
- **时间轴为占位（总 106.11″），TTS 重跑后用 `patch_section_video_timing.py` 回填真实时长**
