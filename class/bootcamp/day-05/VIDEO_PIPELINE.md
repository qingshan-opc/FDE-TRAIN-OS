# Day5 全节视频流水线

**权威流程已固化为 Skill**（后续做课直接按 Skill 执行，不必再问格式）：

→ [`.cursor/skills/fde-section-courseware/SKILL.md`](../../../.cursor/skills/fde-section-courseware/SKILL.md)

个人 Cursor 已 symlink：`~/.cursor/skills/fde-section-courseware`

## 速览

| 项 | 约定 |
|----|------|
| 金标准视觉 | `section-01-worldview-plain/video/index.html` |
| 口播语气 | S01 narration；laowu TTS |
| 口型 | Wav2Lip + S01 `lecturer-portrait.jpg` |
| 打点 | `scripts/patch_section_video_timing.py`（data-* **和** GSAP） |
| 一键 | `scripts/run_bootcamp_video_pipeline.py --day 5 --section NN` |
| 渲染 | `npx hyperframes@0.7.72 render` |
| 入库 | MinIO `documents/shared/course-media/` + `day.yaml` media/cards/glossary + seed |

细节命令与空页红线见 Skill 内 `pipeline-commands.md` / `visual-format.md`。
