---
name: fde-section-courseware
description: >-
  FDE 训练营单节口播课件全链路：lesson 对齐 → YAML 口播 + HyperFrames PPT → 过稿 →
  laowu TTS + Wav2Lip + 时间轴 patch → 渲染 → MinIO → day.yaml 入库。
  Use when making/editing bootcamp section courseware, 做课件, 口播视频, 第 N 天 section,
  PPT+口播, 重跑 TTS/渲染, or continuing course production without the user in the loop.
---

# FDE 训练营 · 单节口播课件制作 Skill

**目标**：交付一节可在学员端播放的口播课件（PPT + 数字人口型 + 媒资入库），格式对齐 Day05 金标准。

**本 Skill 管全链路**（内容、视觉、媒体、入库）。口播语气细则见 [oral-colloquial.md](oral-colloquial.md)，仅为阶段 A 的子规范。

---

## 何时使用

- 用户说：做课件 / 口播视频 / 第 N 天第 M 节 / 重渲 / 继续排课
- 修改 `lesson.md` 后需同步口播与 PPT
- 口播过稿通过后跑 TTS→成片→MinIO

**自主原则**：少问多做；缺 GPU/密钥再问；**用户未确认口播前禁止 TTS/渲染**。用户明确说「合成 / 重渲 / 跑流水线」视为过稿授权。跳过已撤 `accept` 验收节；Day10 答辩节保留。

**实操必带提示词**：凡 `practice.md` 含动手任务，必须有二级标题 `## 一键粘贴提示词` + ` ```text ` 代码块（给 Cursor / Agent / 任意 AI 搭档整段复制）。概念口答节也要给「教练提示词」。尖括号 `〈〉` 标可替换项。

---

## 金标准（只抄，不发明）

| 维度 | 路径 |
|------|------|
| 视觉皮肤 | `class/bootcamp/day-05/section-01-pm-replay/video/index.html` |
| 信息密度 | `class/bootcamp/day-05/section-03-how-software-built/video/` |
| 口播+评审稿 | `class/bootcamp/day-05/section-03-how-software-built/PPT_AND_NARRATION.md` |
| 第七天口播范例 | `class/bootcamp/day-07/section-01-system-to-skill/` |
| day.yaml 字段 | `class/bootcamp/day-05/day.yaml` → `capsule_extra.cN` |
| 节序映射 | `scripts/bootcamp_sections.py`（勿手改 SECTION_DIRS） |

子规范：[visual-format.md](visual-format.md) · [diagram-density.md](diagram-density.md) · [pipeline-commands.md](pipeline-commands.md) · [oral-colloquial.md](oral-colloquial.md) · [framework-stage-teach.md](framework-stage-teach.md)

**框架细讲金标准**：`scripts/section_narrations/day05_s02.yaml`（企业数字化五阶段 · 一段一级）

---

## 单节目录结构

```
class/bootcamp/day-NN/section-XX-slug/
├── lesson.md              # 教学目标与讲授要点（内容源）
├── practice.md / homework.md
├── PPT_AND_NARRATION.md   # 过稿主文件（PPT 要点 + 口播全文）
└── video/
    ├── index.html         # HyperFrames 1920×1080 · S01 皮肤
    ├── hyperframes.json
    ├── scripts/narration/
    │   ├── manifest.json  # [{"id":"01-open","file":"01-open.txt"}, …]
    │   └── NN-slug.txt    # 语义 slug，禁止 02-core / 03-detail
    ├── audio/timing.json  # TTS 后生成
    └── assets/            # fonts · photos · avatar-lipsync.mp4 · diagrams/
```

**口播单一真相源**：`scripts/section_narrations/dayNN_sSS.yaml` → 同步到上表。

---

## 端到端流程（A → J）

```
lesson/practice 对齐
    ↓
A  写 dayNN_sSS.yaml + sync → narration/*.txt + PPT_AND_NARRATION.md
    ↓
B  video/index.html（S01 皮肤 + 讲解图丰度 + GSAP 占位）
    ↓
【过稿 Gate】用户确认 PPT_AND_NARRATION.md ── 未过稿禁止往下
    ↓
C  TTS（laowu）→ timing.json
D  Wav2Lip（.venv 非 .venv-dhx）
E  patch_section_video_timing.py（data-* + GSAP 一起打）
F  hyperframes render → mp4
G  抽帧 QA（每段中点非空页）
H  upload MinIO + poster
I  day.yaml：media + knowledge_cards + glossary_terms
J  build_v07_week1_contracts + seed
```

### A · 内容与口播

1. 读 `lesson.md` 讲授要点，定 5–7 段 slide（语义 slug）
2. 编辑 `scripts/section_narrations/dayNN_sSS.yaml`（`title` + `segments[].id/ppt/text`）
3. 同步：

```bash
cd digital-fde-platform
.venv/bin/python -c "
from scripts.sync_bootcamp_section_from_yaml import sync_section
sync_section(NN, 'SS', regen_html=False)  # day≥8 可 regen_html=True
"
# 整日：scripts/sync_bootcamp_section_from_yaml.py --from-day NN --to-day NN
```

4. 自检：
   - `manifest.json` 与 slide id 一致（`slide-01-open` ↔ `01-open.txt`）
   - 无 bootstrap 残留（`02-core.txt` 等）
   - 404 老师：**开场**「同学们好，我是你们的老师404。」**收束**「同学们，本节先到这里。」（见 oral-colloquial.md）
   - 禁用 `Day N` / `Week N` → 用「第 N 天」「第一周」

5. 审计（可选）：`scripts/audit_narration_oral.py`

### B · HyperFrames PPT

1. 复制 Day05 S01 的 CSS 变量与组件类名，**不换皮肤**
2. 画布 1920×1080；`padding: 72px 420px 72px 96px`（右下 PiP 留白）
3. 每 slide 必有主视觉（梯子/双卡/网格/SVG），见 [diagram-density.md](diagram-density.md)
4. **PPT 只放讲解图 + 概念要点，不放口播正文**
5. `enter()` / `exit()` + 占位 `data-start`/`data-duration`；**TTS 后必须 patch，禁止手改时间轴**

### C–F · 媒体流水线

**重跑 TTS 前清旧 wav**（否则 synth 会跳过）：

```bash
rm -f digital-human-platform/outputs_dhx/dayNN_sSS_course/tts/*.wav \
      digital-human-platform/outputs_dhx/dayNN_sSS_course/voice.wav \
      digital-human-platform/outputs_dhx/dayNN_sSS_course/avatar.mp4
```

一键（推荐）：

```bash
cd digital-fde-platform
.venv/bin/python scripts/run_bootcamp_video_pipeline.py --day NN --section SS
```

分步与 venv 区分见 [pipeline-commands.md](pipeline-commands.md)。

**Runaway 红线**：某段 `dur > chars/3` → 删该段 wav 重合成。

### G · 抽帧 QA

每段 `start + duration/2` 截帧：

- ❌ 仅灰底 + 品牌条 + 头像 → 失败
- ✅ 标题/卡片/梯子/SVG 清晰可见

根因多为未 patch 或 `data-duration` 损坏 → 重跑 patch 再渲。

### H · MinIO

- Key：`documents/shared/course-media/day{DD}-c{N}-{slug}.mp4`
- Poster：`…-poster.jpg`
- `scripts/upload_bootcamp_section.py --day NN --section SS --mp4 …`

### I · day.yaml

在 `capsule_extra.cN` 写入（形状对齐 Day05）：

- `media[]`：object_key、poster_key、duration_sec
- `knowledge_cards[]`：约 5–6 张
- `glossary_terms[]`：约 4–6 条

### J · 入库

```bash
.venv/bin/python scripts/build_v07_week1_contracts.py
# seed: v0.7 / fde-v07 / fde-v06 · camp-v03
```

验收：`get_day_data('camp-v03', day)` 该 capsule 有 media + cards + glossary。

---

## 关键脚本索引

| 用途 | 脚本 |
|------|------|
| 口播 YAML → txt + PPT_AND_NARRATION | `scripts/sync_bootcamp_section_from_yaml.py` |
| 一键流水线 | `scripts/run_bootcamp_video_pipeline.py` |
| TTS | `digital-human-platform/scripts/synth_bootcamp_section.py` |
| 口型 | `digital-human-platform/scripts/lipsync_bootcamp_section.py` |
| 时间轴 | `scripts/patch_section_video_timing.py` |
| 上传 | `scripts/upload_bootcamp_section.py` |
| 节序 | `scripts/bootcamp_sections.py` |
| 批量 | `scripts/batch_land_all_videos.sh` |

---

## 完成清单（每节复制跟踪）

```
- [ ] A  lesson 对齐 · yaml · manifest · PPT_AND_NARRATION.md
- [ ] B  index.html 丰度达标 · slide 数 = 口播段数
- [ ] 【过稿】用户确认口播
- [ ] C  TTS + timing.json（无 runaway）
- [ ] D  Wav2Lip
- [ ] E  patch timing（data-* + GSAP）
- [ ] F  render mp4
- [ ] G  抽帧 QA 通过
- [ ] H  MinIO + poster
- [ ] I  day.yaml media/cards/glossary
- [ ] J  contracts + seed
```

---

## 常见踩坑

| 现象 | 处理 |
|------|------|
| TTS 与 txt 不一致 | 清 `outputs_dhx/.../tts/*.wav` 后重跑；确认 yaml 已 sync |
| bootstrap 生成 02-core | 以 yaml sync 为准，删 orphan txt |
| 成片空页/透明 | 重跑 `patch_section_video_timing.py` |
| pipeline 用了旧口播 | sync 后再跑；manifest 存在时 bootstrap 不会覆盖 |
| PPT_AND_NARRATION 路径写错 day-06 | sync 脚本已按 section_dir 自动修正 |

---

## 本地验收

- 前端：`http://127.0.0.1:5173/app/day/N`
- API：`8760`
- 学习账号：`learner@fde.local` / `learner1234` · `camp-v03`

---

## 禁止

- 换 PPT 皮肤、跳过 patch、TTS runaway 未修复就口型/渲染
- 空页成片上传、密钥进 git
- 地图/概念课口播里替学员做选型（「建议选 X」）
- 口播未过稿就跑 GPU 流水线
