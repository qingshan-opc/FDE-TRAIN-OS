# 口播口语化规范（过稿版）

> 评审主文件：`section-…/PPT_AND_NARRATION.md`  
> TTS 分词稿：`video/scripts/narration/{NN}-{slug}.txt`

## 人设

**404 老师** — 站着讲、短句、有互动，不像念说明书。口语范式见 [`master-teacher-oral.md`](./master-teacher-oral.md)。

**仪式开场**：`同学们好，我是你们的老师404。` → 先问一句 → 进正题。不用「请坐」。  
**仪式收束**：最后一段含 `同学们，本节先到这里。` — 详见 [`oral-ritual.md`](./oral-ritual.md)。

## 篇幅（特级教师式 · 来自 ASR）

- **不限制 4 分钟**；单节约 **6–8 分钟**（见 `master-teacher-oral.md` + `data/master-teacher-study/ANALYSIS.md`）
- 每段 **350–550 字**，含虚拟学生互动（「有同学可能会说…」「听见了吗」）

## 必用口语词

每段至少一处：`同学们` / `咱们` / `对吧` / `嘛` / `呢`

## 分段

- 5–11 段，**语义 slug**（`02-research`、`04-vibe`）
- 禁止 bootstrap 通用名：`02-core`、`03-detail`（第七天–第十天重点排查）
- `manifest.json` 的 `id` 与 `slide-NN-slug` 后缀一致

## 禁用用语（口播与 lesson 正文）

| 禁止 | 改用 |
|------|------|
| `Day 1` / `Day1` | `第一天` / `第 1 天` |
| `Day 5` | `第五天` |
| `Day 1–4` | `前四天` |
| `Week 1` / `Week 2` | `第一周` / `第二周` |
| `学生自检三问——答得出才算听懂` | `我问三句，你们心里答得上，这节才算听明白` |
| `整仓` | `整个代码仓库` |
| PPT 贴口播全文 / `oral_cards` 回退 | 显式 `ppt:` 卡（讲解图 + 概念要点） |

**不改**：目录 slug `day-05`、脚本 `--day 5`、MinIO key `day05-c1-…`

**框架级课节**（五阶段 / 四层梯子）：见 [framework-stage-teach.md](framework-stage-teach.md)；金标准 `day05_s02.yaml`。

## 段长

- 80–220 字/段 → TTS 约 15–45s
- 有生活类比 + 段末收束（「带走一句…」）

## 金标准

- 语气：[`day-05/section-01-worldview-plain/video/scripts/narration/01-open.txt`](../../../class/bootcamp/day-05/section-01-worldview-plain/video/scripts/narration/01-open.txt)
- 对照稿：[`day-05/section-03-how-software-built/PPT_AND_NARRATION.md`](../../../class/bootcamp/day-05/section-03-how-software-built/PPT_AND_NARRATION.md)

## PPT_AND_NARRATION.md 模板

```markdown
# 第五天 · 第 2 节 · <标题>

路径：`class/bootcamp/day-05/section-…/video/`  
PPT：`video/index.html`  
分词稿：`video/scripts/narration/`

---

## 01 · <段名>（待 TTS 后填时长）

**PPT**
- （从 index.html 该 slide 提取标题/要点）

**口播**
> （与 NN-slug.txt 一致，块引用）

文稿：`video/scripts/narration/01-open.txt`

---

## 评审清单

- [ ] 段数 = slide 数
- [ ] 无 Day N / Week N
- [ ] 每段有口语词 + 例子
- [ ] manifest 语义 slug
```

## 过稿流程

1. 只改文稿 + `PPT_AND_NARRATION.md`，**不跑 TTS/渲染**
2. `scripts/audit_narration_oral.py` 出报告
3. 用户确认后 → `run_bootcamp_video_pipeline.py`
