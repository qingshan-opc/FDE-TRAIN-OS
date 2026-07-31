---
workflow: general-video
flow: automation
storyboard: no
message: "Agent 决策，Harness 骨架，Tool 手，MCP 插座，Workflow 写死，Copilot 副驾——六词一次讲清。"
destination: course-lesson
aspect: "16:9"
language: zh
audience: bootcamp-learners
length: "~25min"
angle: "课表同款编辑风 · 全屏动态 PPT + 右下角数字人口播"
---

## Intent

第 6 课第 5 节 · Agent / Harness / Tool / MCP / Workflow vs Agent / Copilot vs Agent。最长一节，六词一次讲清——第二周封装 Skill 前先把骨架名词对齐。视觉语言对齐 `class/schedule/`（浅底 `#f2f5f0`、电蓝 `#1400ff`）。口播跟 narration scripts。

## Assets

- 讲解图：`../../assets/diagrams/agent-loop.svg`、`harness-anatomy.svg`、`workflow-vs-agent.svg`、`skill-anatomy.svg`
- 真实照片：`assets/photos/01-open.jpg` ~ `06-copilot.jpg`（6 张 Unsplash）
- 音色克隆：dhx Qwen3-TTS（laowu）→ `audio/narration-full.wav`
- 口型：本地 Wav2Lip → `assets/avatar-lipsync.mp4`（muted）

## Slides（7 段 · v2 富组件版）

| id | 主题 | 视觉组件 |
|----|------|---------|
| slide-01-open | 同学们，第五节最长，六个词一次讲清：Agent、Harness、To… | side-photo + ladder 六词 + tag-row |
| slide-02-agent | Agent 智能体：能自己决定下一步的 AI。理解任务、规划… | photo-panel + chat-mock 决策环 + duo 你定/它选 |
| slide-03-harness-tool | Harness 是模型外面的循环：工具表、记忆、规划、重试、… | photo-panel + hub-grid 4 零件 + chat-mock Tool Call JSON |
| slide-04-mcp | MCP Model Context Protocol：给 A… | photo-panel + duo MCP/Skill + flow 插上流程 |
| slide-05-workflow | Workflow vs Agent：Workflow 是人画… | photo-panel + duo 写死/现场 + flow 决策 |
| slide-06-copilot | Copilot vs Agent：Copilot 是你开车它… | photo-panel + duo 副驾/司机 + mile-rail 信任级别 |
| slide-07-close | 六词口诀：Agent 决策，Harness 骨架，Tool … | invert + quote-big + hub-grid 六词口诀 |

## Notes

- 样式参考：`class/schedule/index.html` + Day05 S01 `video/index.html` + Day06 S01 `video/index.html`
- PiP 右下角，正文 `padding-right: 420px` 避让
- 每 slide ≥1 结构化块 + ≥1 具体名词（Cursor / Claude Code / GPT-4 / MCP / function calling 等）
- slide-07 用 `.invert` 反色页收束，hub-grid 用 `.six` 列数（240px + 3×1fr）展示六词口诀
- **时间轴为占位（总 204.84″），TTS 重跑后用 `patch_section_video_timing.py` 回填真实时长**
