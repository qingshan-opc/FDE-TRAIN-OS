# 脚本索引

## 启动与冒烟

| 脚本 | 用途 |
|------|------|
| [`start.sh`](start.sh) | 本地 API + worker + Vite |
| [`smoke_e2e.sh`](smoke_e2e.sh) | 0.1 主路径 |
| [`smoke_0.2.sh`](smoke_0.2.sh) | 0.2 Day1–2 |
| [`smoke_week1.sh`](smoke_week1.sh) | Day1–8 stub |
| [`smoke_camp12.sh`](smoke_camp12.sh) | Day1–12 课表 |

## 课程合约

| 脚本 | 输入 | 输出 |
|------|------|------|
| [`build_v07_week1_contracts.py`](build_v07_week1_contracts.py) | `class/bootcamp/day-NN/` | `contracts/examples/day-NN-curriculum.yaml`（Day 1–10） |
| [`build_v06_contracts.py`](build_v06_contracts.py) | 同上 | v0.6 蓝本（legacy 对照） |

入库：`python -c "from services.shared.seed import seed_course_version_from_yaml; seed_course_version_from_yaml(camp_id='camp-v03', version_tag='fde-v07')"`

## Bootcamp 口播视频（Gen2 · 当前）

**节序单一真相源**：[`bootcamp_sections.py`](bootcamp_sections.py)（读各日 `README.md` 章节表）。

| 脚本 | 步骤 |
|------|------|
| [`bootstrap_narration_from_lesson.py`](bootstrap_narration_from_lesson.py) | 从 `lesson.md` 口播稿生成 manifest（`--force` 覆盖） |
| [`colloquialize_and_review.py`](colloquialize_and_review.py) | 口语化分词 + `PPT_AND_NARRATION.md`（读 `section_narrations/*.yaml`） |
| [`audit_narration_oral.py`](audit_narration_oral.py) | 口播审计 → `class/quality/narration-review-index.md` |
| [`scaffold_section_video.py`](scaffold_section_video.py) | HyperFrames `index.html` 脚手架 |
| [`run_bootcamp_video_pipeline.py`](run_bootcamp_video_pipeline.py) | 单节全流程（TTS→口型→打点→渲染→上传） |
| [`batch_land_all_videos.sh`](batch_land_all_videos.sh) | Day5–10 批量；`START_DAY=7 START_SEC=01` 可续跑 |
| [`upload_bootcamp_section.py`](upload_bootcamp_section.py) | MinIO + 更新 `day.yaml` duration |

TTS / 口型在兄弟仓库 `digital-human-platform`：

- `scripts/synth_bootcamp_section.py`（`.venv-dhx`）
- `scripts/lipsync_bootcamp_section.py`（`.venv`）

打点 CLI：[`patch_section_video_timing.py`](patch_section_video_timing.py)（内部复用 `patch_day05_video_timing.py` 模块）。

权威流程见 [`.cursor/skills/fde-section-courseware/SKILL.md`](../.cursor/skills/fde-section-courseware/SKILL.md)。

## 媒体（Gen1 · Day1 占位，legacy）

| 脚本 | 说明 |
|------|------|
| [`build_course_media.py`](build_course_media.py) | 早期 HyperFrames 占位 |
| [`build_v06_media.py`](build_v06_media.py) | v0.6 媒体占位 |
| [`upload_course_media.py`](upload_course_media.py) | 旧路径 MinIO 上传 |
| [`sync_course_media_to_minio.py`](sync_course_media_to_minio.py) | 按 day.yaml/合约核对并上传课件到 MinIO（`--verify-only` / `--force`） |

新节请走 Gen2 Bootcamp 流水线。
