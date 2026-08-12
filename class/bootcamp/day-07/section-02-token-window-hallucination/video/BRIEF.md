---
workflow: general-video
flow: automation
storyboard: no
message: "Token 怎么计费、窗口满了怎么办、幻觉为什么是机制不是 bug。"
destination: course-lesson
aspect: "16:9"
language: zh
audience: bootcamp-learners
length: "~20min"
angle: "课表同款编辑风 · 全屏动态 PPT + 右下角数字人口播"
---

## Intent

第 6 课第 2 节 · 字数账单、记忆上限、一本正经胡说。视觉语言对齐 `class/schedule/`（浅底 `#f2f5f0`、电蓝 `#1400ff`）。口播跟 narration scripts。

## Assets

- 讲解图：`../../assets/diagrams/llm-capability.svg`（或 `/course-assets/assets/diagrams/llm-capability.svg`）
- 音色克隆：dhx Qwen3-TTS（laowu）→ `audio/narration-full.wav`
- 口型：本地 Wav2Lip → `assets/avatar-lipsync.mp4`（muted）

## Slides（脚手架）

| id | 主题 |
|----|------|
| slide-01-open | 第二节，聊三个绑在一起的词：Token、上下文窗口、幻觉。你… |
| slide-02-token | Token 是模型读写的最小单位，不是「一个字」。英文 ro… |
| slide-03-window | 上下文窗口是一次性能看到的 Token 上限。Claude … |
| slide-04-hallucination | 幻觉 Hallucination：模型永远给「最像真的」答案… |
| slide-05-boundary | 能力边界三句话：擅长模式匹配和语言生成；不擅长实时数据、精确… |
| slide-06-close | 记住：Token 是钱也是注意力；窗口是硬顶；幻觉是常态所以… |

## Notes

- 样式参考：`class/schedule/index.html` + Day05 S01 `video/index.html`
- PiP 右下角，正文 `padding-right: 420px` 避让
- 每 slide ≥1 结构化块 + ≥1 具体名词（GPT/Claude/MCP 等）
