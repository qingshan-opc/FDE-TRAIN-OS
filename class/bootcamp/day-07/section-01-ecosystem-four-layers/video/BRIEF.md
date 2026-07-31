---
workflow: general-video
flow: automation
storyboard: no
message: "从基建到应用：四层生态地图，标出你在哪一层干活。本课用 DeepSeek API 接入。"
destination: course-lesson
aspect: "16:9"
language: zh
audience: bootcamp-learners
length: "~20min"
angle: "课表同款编辑风 · 全屏动态 PPT + 右下角数字人口播"
---

## Intent

第 6 课第 1 节 · 生态四层地图：你在哪一层。视觉语言对齐 `class/schedule/`（浅底 `#f2f5f0`、电蓝 `#1400ff`）。口播跟 narration scripts（v2 口语化版，7 段）。

## Assets

- 讲解图：`assets/diagrams/llm-ecosystem.svg`
- 音色克隆：dhx Qwen3-TTS（laowu）→ `audio/narration-full.wav`（**v2 改稿后需重跑 TTS**）
- 口型：本地 Wav2Lip → `assets/avatar-lipsync.mp4`（muted，**TTS 重跑后需重生成**）

## Slides（7 段 · v2）

| id | 主题 |
|----|------|
| slide-01-open | 同学们，第六天了。前五天你们用过 ChatGPT、写过 Prompt、调过摘要接口——AI 用了… |
| slide-02-llm | 最底下这层 LLM，大语言模型。它到底在干嘛呢？就一件事：猜下一个词… |
| slide-03-four-layer | 整个生态分四层，从下往上：基建、模型、编排、应用。打个比方，就当一栋楼… |
| slide-04-you-are-here | 那问题来了，你在哪层？咱们主要在顶上两层干活——编排和应用… |
| slide-05-open-closed | 模型层有个事儿：开源还是闭源。真正的区别是调 API 还是自部署。咱们用 DeepSeek API… |
| slide-06-multimodal | 还有个词儿多模态。本课驾驶舱刻意只用文本——摘要、问答、调工具… |
| slide-07-close | 收一下：四层地图，你在顶上两层。词典是随身工具，下节拆 Token/窗口/幻觉… |

## Notes

- 样式参考：`class/schedule/index.html` + Day05 S01 `video/index.html`
- PiP 右下角，正文 `padding-right: 420px` 避让
- 每 slide ≥1 结构化块 + ≥1 具体名词（GPT/Claude/DeepSeek/MCP 等）
- slide-07 用 `.invert` 反色页收束
- **时间轴为占位（总 171.5″），TTS 重跑后用 `patch_section_video_timing.py` 回填真实时长**
