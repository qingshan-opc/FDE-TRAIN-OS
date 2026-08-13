# Week2 数字人重录交接清单（第六–第十天 · 23 节）

> 给录制同事：口播以 git 分词稿为准；课表以现网学员端 `v0.7` day_packages 为准。  
> 本文件不代替成片；上传 MinIO 后按下方 `object_key` 命名回填。

## 天数对照（录错天=废片）

| 文件夹 | 线上 dayLabel | 成片前缀 | 节数 |
|--------|---------------|----------|------|
| `day-07/` | **第六天** | `day06-c*` | 5 |
| `day-08/` | **第七天** | `day07-c*` | 5 |
| `day-09/` | **第八天** | `day08-c*` | 4 |
| `day-10/` | **第九天** | `day09-c*` | 4 |
| `day-11/` | **第十天** | `day10-c*` | 5 |

## 不要录、不要上架（已撤验收）

- `day-07/section-06-accept-18words`
- `day-08/section-06-accept`
- `day-09/section-05-accept`
- `day-10/section-05-accept`

## 建议录制顺序与命名

每节分镜 = 该节 `video/scripts/narration/*.txt` 文件名顺序。  
改稿后必须重跑各节 `PPT_AND_NARRATION.md` 注明的 timing 脚本（`patch_section_video_timing.py`）。

### 1. 第六天（day-07）→ `day06-c1` … `day06-c5`

| 成片 | 节目录 | 备注 |
|------|--------|------|
| `day06-c1-ecosystem.mp4` | `section-01-ecosystem-four-layers` | 片上用生态四层（基建→模型→编排→应用），勿用 Week1 前端四层图 |
| `day06-c2-*.mp4` | `section-02-token-window-hallucination` | Token=读写最小单位 |
| `day06-c3-*.mp4` | `section-03-prompt-context-rag` | |
| `day06-c4-eval.mp4` | `section-04-eval-guardrails-vibe` | 片图用 `llm-ops-triangle`；开场中文「出考卷、加护栏、边聊边写」 |
| `day06-c5-agent.mp4` | `section-05-agent-harness-mcp` | **禁**「Skill≈朴素版 MCP」；Skill=说明书+工具，MCP=插座 |

### 2. 第七天（day-08）→ `day07-c1` … `day07-c5`

| 成片 | 节目录 | 备注 |
|------|--------|------|
| `day07-c1-*.mp4` | `section-01-system-to-skill` | |
| `day07-c2-*.mp4` | `section-02-skill-anatomy` | 输入来源：真接口/导出；驾驶舱可选 |
| `day07-c3-*.mp4` | `section-03-pick-first` | 同上，勿默认 `/api/kpi` |
| `day07-c4-*.mp4` | `section-04-define-skill` | **禁**「YAML frontmatter」无人话；说「文件顶上 --- 包起来的 name/description」；路径 `skills/<id>/SKILL.md` |
| `day07-c5-*.mp4` | `section-05-run-evidence` | 收口：课末口试/抽查证据链，**勿**说第六节验收 |

### 3. 第八天（day-09）→ `day08-c1` … `day08-c4`

| 成片 | 节目录 | 备注 |
|------|--------|------|
| `day08-c1-*.mp4` | `section-01-boundary-exceptions` | |
| `day08-c2-*.mp4` | `section-02-harden-skill` | |
| `day08-c3-*.mp4` | `section-03-agent-harness` | Harness 四要素含**模型** |
| `day08-c4-*.mp4` | `section-04-agent-calls-skill` | 先中文「想→做→看→再想」，再指 `tool_calls` 等代码名 |

### 4. 第九天（day-10）→ 按**现章节顺序**命名（勿沿用旧对调文件名习惯）

| 成片（新口径） | 节目录 | 标题 |
|----------------|--------|------|
| `day09-c1-orchestration.mp4` | `section-01-process-as-orchestration` | 编排 · **禁 Agent Lab**；今天只画图 |
| `day09-c2-human-confirm.mp4` | `section-02-human-confirm` | 确认闸 |
| `day09-c3-multi-skill.mp4` | `section-03-two-more-skills` | 再封装技能 |
| `day09-c4-*.mp4` | `section-04-orchestrate` | 长跑 + HITL |

仓库 `day-10/day.yaml` 已按上表校正 c2/c3 `object_key`。旧 MinIO 里若仍是对调片，**以新文件名覆盖上传**，不要只改 yaml 指旧错片。

### 5. 第十天（day-11）→ `day10-c1` … `day10-c5`

| 成片 | 节目录 | 备注 |
|------|--------|------|
| `day10-c1-*.mp4` | `section-01-agent-in-cockpit` | |
| `day10-c2-*.mp4` | `section-02-ten-evidences` | 十条证据：人话 + 仓库文件；驾驶舱「有更好」 |
| `day10-c3-*.mp4` | `section-03-defense-prep` | |
| `day10-c4-*.mp4` | `section-04-defense` | |
| `day10-c5-*.mp4` | `section-05-two-week-review` | 入门不是终点；许愿→追问→动手；禁「毕业即精通」 |

## 片上禁用词（开录前再扫一眼 PPT 大字）

- Skill ≈ MCP / Skill 是朴素版 MCP  
- Agent Lab（现课已废）  
- YAML frontmatter（无人话）  
- 默认驾驶舱 `/api/kpi` 当作人人都有  
- 「下一节 / 第六节验收」（已撤节）

## 录完回填

1. 上传 `documents/shared/course-media/<object_key>` + poster  
2. 核对各日 `day.yaml` → `capsule_extra.cN.media[0].object_key`  
3. persist / 同步课包到生产后抽看第九天 c2/c3 是否标题与成片一致  
4. 概念节 UI 应显示「学习教练提示词」；编码节显示「任务提示词」（`prompt_kind`）

## 口播源路径速查

```
class/bootcamp/day-0X/section-*/video/scripts/narration/*.txt
```
