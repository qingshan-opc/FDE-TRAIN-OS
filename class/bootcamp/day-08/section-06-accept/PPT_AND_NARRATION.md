# 第七天 · 第 6 节 · 验收：Skill 三问 + GATE 7

路径：`class/bootcamp/day-08/section-06-accept/video/`  
PPT：`video/index.html`（**仅讲解图 + 概念要点，无口播正文**）  
分词稿：`video/scripts/narration/`

> 口播以分词稿为准 · TTS 后需重跑 `patch_section_video_timing.py`

---

## 01 · open

**PPT（屏幕）**
- 眉题：01 OPEN · 第二周第一关
- 业务系统可聊 · 第一个 Skill
- 从写 Prompt → 设计工作方式

**口播**
> 同学们好，我是你们的老师404。第七天验收，第二周第一关。先问一句：连续两次全过的证据，齐了吗？想三秒。先对齐叙事：第一周你交的是能跑的业务系统；昨天应用内接上真实对话，能聊了；今天你的第一个 Skill 上岗了——它不吃饭不摸鱼，拿着你写的说明书，每次交出同样标准的货。有看板更好看，没有也不影响这关——GATE 盯的是说明书、运行和证据。你从写 Prompt 的人变成了设计工作方式的人，对吧。

文稿：`video/scripts/narration/01-open.txt`

---

## 02 · three-questions

**PPT（屏幕）**
- 眉题：02 THREE QUESTIONS · Skill 三问
- 它做什么？吃 ____，交 ____
- 步骤谁定的？你
- 好坏谁判的？你 · 有证据句

**口播**
> Skill 三问，脱口而出。第一问它做什么？输入到输出，一句话：吃某某，交某某。第二问步骤谁定的？你——AI 按说明书执行，不自由发挥。第三问好坏谁判的？你——按验收段逐条判，有证据句。三问答不上来，说明书还没写透，嘛。

文稿：`video/scripts/narration/02-three-questions.txt`

---

## 03 · evidence-chain

**PPT（屏幕）**
- 眉题：03 EVIDENCE CHAIN · 证据链
- skills/〈id〉/SKILL.md
- runs/ 三件套 · 连续两次全过
- 抽查：判据 → 证据句

**口播**
> 证据链验收：skills/ 里的说明书、runs/ 里的三件套、连续两次验收全过，全部进 Git。导师会随机指一条验收判据，你要指出最近一次运行里对应的证据句。判据和证据对得上，才叫真验收，对吧。

文稿：`video/scripts/narration/03-evidence-chain.txt`

---

## 04 · gate-checklist

**PPT（屏幕）**
- 眉题：04 GATE 7 · 清单
- 三问脱口而出
- 证据链完整 · 能指证据
- commit · feat: 第一个 Skill

**口播**
> GATE 7 清单：Skill 三问脱口而出；证据链完整；抽查判据能指证据；commit 信息写 feat: 第一个 Skill——你的 Skill 名称。一天就做了一个 Skill，少吗？第一个做透比什么都重要——三筛、四部件、验收、证据，这套动作明天开始加速复用，对吧。

文稿：`video/scripts/narration/04-gate-checklist.txt`

---

## 05 · close

**PPT（屏幕）**
- 眉题：05 CLOSE · 带走
- Skill 可交接 · 分享仪式
- 预告 · Agent / Harness

**口播**
> 同学们，本节先到这里。Skill 能分享给同事——说明书就是交接物，让对方跑一次并独立验收，就是分享仪式。第八天咱们掀开引擎盖：AI 怎么拿着说明书干活？Harness、工具、记忆、决策环——Agent 登场。今晚预习公开课 O2 的 Agent 篇，呢。

文稿：`video/scripts/narration/05-close.txt`

---

## 评审清单

- [x] PPT 无口播正文，仅图 + 概念卡/表
- [x] 口播与 `narration/*.txt` 一致
- [ ] TTS 后 patch 时间轴并重渲
