# 第八天 · 第 5 节 · 验收：Agent v0.1 闭环 + GATE 8

路径：`class/bootcamp/day-08/section-05-accept/video/`  
PPT：`video/index.html`（**仅讲解图 + 概念要点，无口播正文**）  
分词稿：`video/scripts/narration/`

> 口播以分词稿为准 · TTS 后需重跑 `patch_section_video_timing.py`

---

## 01 · open

**PPT（屏幕）**
- 眉题：01 OPEN
- 讲解图：agent-loop.svg
- 身份跃迁：写说明书 → 带 AI 团队
- 团队目前只有一件工具

**口播**
> 同学们好，我是你们的老师404。第八天验收。先问一句：证据都进 Git 了吗？今天你从写说明书的人升级为带 AI 团队的人——哪怕团队目前只有一件工具。上午把 Skill 从能跑炼成可依赖；下午把它挂上 Agent 工具表，并且知道它什么时候会被选错，对吧。

文稿：`video/scripts/narration/01-open.txt`

---

## 02 · live-demo

**PPT（屏幕）**
- 眉题：02 LIVE DEMO
- 讲解图：skill-anatomy.svg
- 现场演示：导师下任务，Agent 调用
- 含一个易选错的任务

**口播**
> 现场演示：导师随机下任务，含一个易选错的，观察 Agent 选择与产出。演示时 Agent 现场选错了怎么办？不慌，这正是图谱的素材——现场归因、现场说修法。导师评的是你的诊断力，不是 Agent 的运气，嘛。

文稿：`video/scripts/narration/02-live-demo.txt`

---

## 03 · oral-four-pack

**PPT（屏幕）**
- 眉题：03 ORAL FOUR PACK
- 讲解图：v2-panorama.svg
- 口试四件套（必背）
- Harness四要素 · 决策环 · workflow vs agent · 选错图谱

**口播**
> 口试四件套，脱口而出。第一 Harness 四要素：模型、工具表、记忆、循环，各说一个你的对应产物。第二决策环：理解、规划、调工具、观察、继续。第三 workflow vs agent：步骤定死 vs 路径现想，能 workflow 别 agent。第四选错图谱：我的 Agent 在什么措辞下会误选，因为什么，我用什么修了描述，对吧。

文稿：`video/scripts/narration/03-oral-four-pack.txt`

---

## 04 · gate-checklist

**PPT（屏幕）**
- 眉题：04 GATE CHECKLIST
- 讲解图：agent-loop.svg
- GATE 8 清单
- Skill v1 边界 + 注入测试 + Agent 闭环

**口播**
> GATE 8 清单：现场演示 Agent 正确调用、产出过 Skill 验收段；Skill v1 边界声明加注入测试证据，至少三条全 ✓ 加回归过；口试四件套，第四条基于真实图谱；docs/agent-tool-map.md 进 Git；commit 写 feat: Skill v1 工程化 + Agent v0.1，对吧。

文稿：`video/scripts/narration/04-gate-checklist.txt`

---

## 05 · close

**PPT（屏幕）**
- 眉题：05 TAKEAWAY
- 讲解图：skill-anatomy.svg
- 第九天预告：多 Skill 编排 + 人工确认点

**口播**
> 同学们，本节先到这里。明天工具表要从一件变三件，还要串成一条流水线——多 Skill 编排。以及全课最重要的设计之一：人工确认点——让 AI 放手干，但钥匙在你手里。今晚备好两个 Skill 候选，咱们第九天见。

文稿：`video/scripts/narration/05-close.txt`

---

## 评审清单

- [x] PPT 无口播正文，仅图 + 概念卡/表
- [x] 口播与 `narration/*.txt` 一致
- [ ] TTS 后 patch 时间轴并重渲
