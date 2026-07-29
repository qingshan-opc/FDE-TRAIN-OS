# 媒体流水线命令（权威）

仓库：

- FDE：`digital-fde-platform`
- DHX：`digital-human-platform`

## 0 · 节序映射

**不要手改 `SECTION_DIRS`。** 单一真相源：

```bash
cd digital-fde-platform
.venv/bin/python -c "
from scripts.bootcamp_sections import section_dirs
print(section_dirs(5))   # day 5..10
"
```

映射规则：读 `class/bootcamp/day-NN/README.md` 章节表；详见 [`scripts/bootcamp_sections.py`](../../../scripts/bootcamp_sections.py)。

## 1 · 单节全流程（推荐）

```bash
cd digital-fde-platform
.venv/bin/python scripts/run_bootcamp_video_pipeline.py --day NN --section SS
# 整日：--all
```

顺序：bootstrap narration（已有 manifest 则跳过）→ scaffold（若无 index.html）→ TTS → Wav2Lip → patch timing → hyperframes render → upload MinIO。

**重写口播后必清旧 wav**（否则 synth 跳过）：

```bash
rm -f ../digital-human-platform/outputs_dhx/dayNN_sSS_course/tts/*.wav \
      ../digital-human-platform/outputs_dhx/dayNN_sSS_course/voice.wav \
      ../digital-human-platform/outputs_dhx/dayNN_sSS_course/avatar.mp4
```

批量 Day6–10：`scripts/batch_land_days_6_10.py`（按 `section_dirs`；勿把已撤 accept 加回）。

## 2 · 分步（调试）

### TTS（laowu / Qwen3）

```bash
cd digital-human-platform
PYTHONPATH=. .venv-dhx/bin/python scripts/synth_bootcamp_section.py --day NN --section SS
```

产出：`outputs_dhx/dayNN_sSS_course/voice.wav` + FDE `…/video/audio/timing.json`

### Wav2Lip

**必须用 DHX `.venv`（有 cv2/torch），不要用 `.venv-dhx`。**

```bash
cd digital-human-platform
PYTHONPATH=. .venv/bin/python scripts/lipsync_bootcamp_section.py --day NN --section SS
```

### 打时间轴（data-* + GSAP）

```bash
cd digital-fde-platform
.venv/bin/python scripts/patch_section_video_timing.py --day NN --section SS
```

（内部复用 `patch_day05_video_timing.py` 模块逻辑。）

### HyperFrames 渲染

```bash
cd class/bootcamp/day-NN/SECTION/video
npx hyperframes@0.7.72 render . -o renders/dayNN-cN-slug.mp4
```

slug 与 `day.yaml` 的 `object_key` 一致。

### 上传 MinIO

```bash
cd digital-fde-platform
.venv/bin/python scripts/upload_bootcamp_section.py --day NN --section SS --mp4 path/to/renders/….mp4
```

## 3 · 批量

```bash
./scripts/batch_land_all_videos.sh
# 续跑：START_DAY=7 START_SEC=01 ./scripts/batch_land_all_videos.sh
```

## 4 · 合约 + seed

```bash
.venv/bin/python scripts/build_v07_week1_contracts.py
.venv/bin/python -c "
from services.shared.seed import seed_course_version_from_yaml
for tag in ['v0.7', 'fde-v07', 'fde-v06']:
    seed_course_version_from_yaml(camp_id='camp-v03', version_tag=tag)
"
```

## 5 · 本地验收

- Vite：`http://127.0.0.1:5173/app/day/N`
- API：`8760`

## Runaway 检查

合成后若某段 `dur > chars/3`：删对应 `outputs_dhx/.../tts/{id}.wav` 后重跑 synth。

## 环境速查

| 用途 | Python |
|------|--------|
| TTS | `digital-human-platform/.venv-dhx` |
| Wav2Lip | `digital-human-platform/.venv` |
| FDE seed/upload/patch | `digital-fde-platform/.venv` |
