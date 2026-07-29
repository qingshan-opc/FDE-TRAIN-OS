# 第九天 · 第 4 节 · 编排 + 确认点 + 执行日志

路径：`class/bootcamp/day-09/section-04-orchestrate/video/`  
PPT：`video/index.html`（**仅讲解图 + 概念要点，无口播正文**）  
分词稿：`video/scripts/narration/`

> 口播以分词稿为准 · TTS 后需重跑 `patch_section_video_timing.py`

---

## 01 · open

**PPT（屏幕）**
- 眉题：01 OPEN
- 讲解图：orchestration-confirm.svg
- 施工三步：串联、装闸、记日志

**口播**
> 同学们好，我是你们的老师404。施工开始。图纸在 orchestration.md，三件工具已经齐。现在三步：串联、装闸、记日志。顺序定死告诉 Agent，别让它现场改流程——咱们今天做的是 workflow，不是即兴表演，对吧。

文稿：`video/scripts/narration/01-open.txt`

---

## 02 · wire-skills

**PPT（屏幕）**
- 眉题：02 WIRE SKILLS
- 讲解图：orchestration-confirm.svg
- A 的输出喂给 B，B 的产出做成确认界面

**口播**
> 第一步串联：给 Agent 一条 workflow 指令，A 的输出喂给 B，B 的产出做成确认界面。第二步装闸：不可撤回的步骤前，Agent 必须停，把草稿、关键数字、风险标红摆在你面前，等你一个字——发，或者驳回，对吧。

文稿：`video/scripts/narration/02-wire-skills.txt`

---

## 03 · exec-log

**PPT（屏幕）**
- 眉题：03 EXEC LOG
- 讲解图：orchestration-confirm.svg
- 每步一行：时间 | 步骤 | 结果

**口播**
> 第三步记日志：每执行一步，往 runs/ 追加一行，时间、步骤、结果。指令里写清楚每步执行后追加到 runs/YYYYMMDD.md，Agent 来记，你负责抽查。能回放，才算有案底，对吧。

文稿：`video/scripts/narration/03-exec-log.txt`

---

## 04 · reject-loop

**PPT（屏幕）**
- 眉题：04 REJECT LOOP
- 讲解图：orchestration-confirm.svg
- 驳回有回路，不是断头路

**口播**
> 跑通之后别急着走，两条路径都要实测。批准走一遍，驳回也走一遍——比如驳回：第二段数字不对，流水线得打回 B 重做，日志记下这次驳回。闸拦住一次不算本事，驳回了能退回重做还留下记录，咱们这条线才算有回路，对吧。

文稿：`video/scripts/narration/04-reject-loop.txt`

---

## 05 · log-replay

**PPT（屏幕）**
- 眉题：05 LOG REPLAY
- 讲解图：orchestration-confirm.svg
- 只看日志复述今天发生了什么

**口播**
> 同学们，本节先到这里。最后两分钟，关掉屏幕别的窗口，只看 runs/ 日志，复述今天发生了什么。到闸停不停、批了动不动、驳回了回不回得来——三个验收点全绿，第五节闸口实测才有底气。带走一句。

文稿：`video/scripts/narration/05-log-replay.txt`

---

## 评审清单

- [x] PPT 无口播正文，仅图 + 概念卡/表
- [x] 口播与 `narration/*.txt` 一致
- [ ] TTS 后 patch 时间轴并重渲
