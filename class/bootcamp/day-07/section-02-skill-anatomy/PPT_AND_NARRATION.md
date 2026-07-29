# 第七天 · 第 2 节 · 概念：Skill 解剖四部件

路径：`class/bootcamp/day-07/section-02-skill-anatomy/video/`  
PPT：`video/index.html`（**仅讲解图 + 概念要点，无口播正文**）  
分词稿：`video/scripts/narration/`

> 口播以分词稿为准 · TTS 后需重跑 `patch_section_video_timing.py`

---

## 01 · open

**PPT（屏幕）**
- 眉题：01 OPEN
- 第七天 · 第 2 节 · 概念：Skill 解剖四部件

**口播**
> 同学们好，我是你们的老师404。这节咱们解剖一只 Skill。一份能被 AI 执行的说明书长什么样？四个部件：输入、步骤、输出、验收。缺一个都转不动——输入没写清楚，AI 不知道吃什么料；验收没写清楚，你不知道货好不好，对吧。

文稿：`video/scripts/narration/01-open.txt`

---

## 02 · input-steps

**PPT（屏幕）**
- 眉题：02 INPUT STEPS
- 第七天 · 第 2 节 · 概念：Skill 解剖四部件

**口播**
> 输入管做这件事吃什么料，要具体到来源和范围。比如周报 Skill：驾驶舱 /api/kpi 和 /api/exceptions，近七天，读者是总监——不能写相关数据，哪相关呢？步骤管怎么做，AI 能一步步执行：拉数据、找变化、找逾期、生成。不能写分析一下，怎么分析嘛，对吧。

文稿：`video/scripts/narration/02-input-steps.txt`

---

## 03 · output-accept

**PPT（屏幕）**
- 眉题：03 OUTPUT ACCEPT
- 第七天 · 第 2 节 · 概念：Skill 解剖四部件

**口播**
> 输出管交出什么货：Markdown 四段、三百字以内、数字只用来源里真实存在的。验收管好坏怎么判：四段齐全、每个数字能溯源、建议主语是人且可执行——每条都能判 ✓ 还是 ✗。不能写写得好，谁判、怎么判呢，对吧。

文稿：`video/scripts/narration/03-output-accept.txt`

---

## 04 · weekly-example

**PPT（屏幕）**
- 眉题：04 WEEKLY EXAMPLE
- 第七天 · 第 2 节 · 概念：Skill 解剖四部件

**口播**
> 看这份周报 Skill 完整示例。输入写着两个接口、近七天、读者总监；步骤四条，拉 KPI、找环比变化最大的两个指标、找逾期最久的三张工单、按格式生成；输出 Markdown 四段三百字；验收三条，结构、数字、意图各一。咱们对照这份模板，等会儿就要写自己的，嘛。

文稿：`video/scripts/narration/04-weekly-example.txt`

---

## 05 · common-defects

**PPT（屏幕）**
- 眉题：05 COMMON DEFECTS
- 第七天 · 第 2 节 · 概念：Skill 解剖四部件

**口播**
> 常见缺陷记四个词：相关数据分析一下写个周报写得好——看到这些词，说明书就还没写完。步骤要多细？细到换一个人或 AI 照着做，不会做出第二种理解。写不到这个程度，先拆步骤，对吧。

文稿：`video/scripts/narration/05-common-defects.txt`

---

## 06 · close

**PPT（屏幕）**
- 眉题：06 CLOSE
- 第七天 · 第 2 节 · 概念：Skill 解剖四部件

**口播**
> 同学们，本节先到这里。眼熟吗？输出加验收，就是你们第五天学的结构化输出加三条军规。第一周的每个概念，在第二周的说明书里都有自己的格子。下一节咱们用三筛法选第一个 Skill——高频、稳定、低险。

文稿：`video/scripts/narration/06-close.txt`

---

## 评审清单

- [x] PPT 无口播正文，仅图 + 概念卡/表
- [x] 口播与 `narration/*.txt` 一致
- [ ] TTS 后 patch 时间轴并重渲
