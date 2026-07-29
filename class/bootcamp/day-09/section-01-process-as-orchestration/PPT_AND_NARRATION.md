# 第九天 · 第 1 节 · 业务流程即编排

路径：`class/bootcamp/day-09/section-01-process-as-orchestration/video/`  
PPT：`video/index.html`（**仅讲解图 + 概念要点，无口播正文**）  
分词稿：`video/scripts/narration/`

> 口播以分词稿为准 · TTS 后需重跑 `patch_section_video_timing.py`

---

## 01 · open

**PPT（屏幕）**
- 眉题：01 OPEN
- 讲解图：workflow-vs-agent.svg
- 一件工具是助手，一条流水线才是团队

**口播**
> 同学们好，我是你们的老师404。先快答一句：Human-in-the-loop 就是关键步骤要人点头，AI 不能自己拍板。今天咱们把业务流程翻译成流水线，这叫编排。一件工具顶多算助手，一条串起来的流水线才算团队，对吧。

文稿：`video/scripts/narration/01-open.txt`

---

## 02 · split-three

**PPT（屏幕）**
- 眉题：02 SPLIT THREE
- 讲解图：orchestration-confirm.svg
- 对每一步问三个问题

**口播**
> 拆分手法呢，对每一步问三个问题。第一，这步是执行还是判断？执行给 Skill，判断和放行人留着。第二，输入从哪来？A 的产出就是 B 的输入，数据流得画清楚。第三，这步错了能撤回吗？不能撤回的，前面必须装人工确认闸。

文稿：`video/scripts/narration/02-split-three.txt`

---

## 03 · dataflow

**PPT（屏幕）**
- 眉题：03 DATAFLOW
- 讲解图：workflow-vs-agent.svg
- A 的产出 = B 的输入

**口播**
> 咱们再强调一遍数据流。上一步吐什么格式，下一步就吃什么格式，中间对不齐，流水线一定卡。又是契约思想，第六次了嘛——编排不是堆 Skill，是让产出和输入咬合，对吧。

文稿：`video/scripts/narration/03-dataflow.txt`

---

## 04 · weekly-pipeline

**PPT（屏幕）**
- 眉题：04 WEEKLY PIPELINE
- 讲解图：orchestration-confirm.svg
- 运营周报流水线示例

**口播**
> 看这条周报流水线：Skill A 拉 KPI 和异常，Skill B 生成草稿，这两步可以全自动连跑。发送之前呢，一个确认闸——你看一眼草稿，批准才发。为什么？消息发出去了就收不回，这个例子咱们后面还会用到。

文稿：`video/scripts/narration/04-weekly-pipeline.txt`

---

## 05 · workflow-close

**PPT（屏幕）**
- 眉题：05 WORKFLOW CLOSE
- 讲解图：workflow-vs-agent.svg
- 你当流程设计师，AI 当流水线工人

**口播**
> 同学们，本节先到这里。同学们，注意这是 workflow，步骤你定死，不依赖 Agent 现场瞎想。还记得第八天的铁律吗，能 workflow 别 agent。编排的意思就是：你当流程设计师，AI 当流水线工人。本节带走一句——把流程画成 Skill 串联图，第四节能直接施工。

文稿：`video/scripts/narration/05-workflow-close.txt`

---

## 评审清单

- [x] PPT 无口播正文，仅图 + 概念卡/表
- [x] 口播与 `narration/*.txt` 一致
- [ ] TTS 后 patch 时间轴并重渲
