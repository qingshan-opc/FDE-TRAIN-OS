# 第八天 · 第 4 节 · 实战：让 Agent 调用你的 Skill

路径：`class/bootcamp/day-08/section-04-agent-calls-skill/video/`  
PPT：`video/index.html`（**仅讲解图 + 概念要点，无口播正文**）  
分词稿：`video/scripts/narration/`

> 口播以分词稿为准 · TTS 后需重跑 `patch_section_video_timing.py`

---

## 01 · open

**PPT（屏幕）**
- 眉题：01 OPEN
- 讲解图：harness-anatomy.svg
- 工具描述 = 货架标签
- Agent 选工具时只读这个

**口播**
> 同学们好，我是你们的老师404。这节把你的 Skill 挂上 Agent 的工具表。Agent 选工具的时候读什么？不是说明书全文——是货架标签，叫工具描述。名称、何时用、输入要求，三要素写清楚，对吧。

文稿：`video/scripts/narration/01-open.txt`

---

## 02 · tool-description

**PPT（屏幕）**
- 眉题：02 TOOL DESCRIPTION
- 讲解图：skill-anatomy.svg
- 三要素：何时用 · 不用于 · 输入要求
- 示例：weekly-report

**口播**
> 工具描述三要素：何时用——需要生成本周运营周报时，输入为 KPI 与异常工单数据；不用于——写通用文章、创意写作、对外发送任何内容；输入要求——JSON 格式，缺数据时本工具会拒绝。最反直觉的是不用于——它是护栏，防止周报工具被选去写情诗，嘛。

文稿：`video/scripts/narration/02-tool-description.txt`

---

## 03 · three-tasks

**PPT（屏幕）**
- 眉题：03 THREE TASKS
- 讲解图：agent-loop.svg
- 闭环实测三任务
- 该调的 / 不该调的 / 故意模糊的

**口播**
> 挂上去，测三个任务。任务 A 该调：用本周数据生成周报——期望选中 weekly-report。任务 B 不该调：帮我写一句朋友圈文案——期望不调工具，直接答。任务 C 易选错：总结一下这周情况——模糊指令，观察它选什么，对吧。

文稿：`video/scripts/narration/03-three-tasks.txt`

---

## 04 · wrong-pick-map

**PPT（屏幕）**
- 眉题：04 WRONG PICK MAP
- 讲解图：harness-anatomy.svg
- 选错图谱
- 任务 · Agent选了什么 · 原因 · 描述怎么改

**口播**
> 选错了别怪 Agent 笨，怪标签写得宽。改描述，再测。今天结束前交一张选错图谱：我的 Agent 在什么措辞下会误选或漏选，因为什么，我用什么修了描述。这比十次正确都值钱——它告诉你工具描述的边界在哪，对吧。

文稿：`video/scripts/narration/04-wrong-pick-map.txt`

---

## 05 · platform-tips

**PPT（屏幕）**
- 眉题：05 PLATFORM TIPS
- 讲解图：skill-anatomy.svg
- 描述 2–4 句
- 降级：Prompt 里手动提供工具清单

**口播**
> 描述写多长？两到四句；长了稀释关键信息，短了护栏不够。平台没有工具表功能？降级玩法：Prompt 里手动提供工具清单加描述，让模型先输出选择再执行。Agent 调用时输入谁准备？今天你在任务里给数据，第九天编排会把拉数据串起来，嘛。

文稿：`video/scripts/narration/05-platform-tips.txt`

---

## 06 · close

**PPT（屏幕）**
- 眉题：06 TAKEAWAY
- 讲解图：agent-loop.svg
- docs/agent-tool-map.md 进 Git

**口播**
> 同学们，本节先到这里。从今天起你派活用自然语言，挑工具的活 Agent 自己干。选错图谱和 agent-tool-map.md 一起进 Git。下一节第八天验收——Agent v0.1 闭环演示。

文稿：`video/scripts/narration/06-close.txt`

---

## 评审清单

- [x] PPT 无口播正文，仅图 + 概念卡/表
- [x] 口播与 `narration/*.txt` 一致
- [ ] TTS 后 patch 时间轴并重渲
