# 第九天 · 第 5 节 · 验收：确认闸实测与过闸

路径：`class/bootcamp/day-09/section-05-accept/video/`  
PPT：`video/index.html`（**仅讲解图 + 概念要点，无口播正文**）  
分词稿：`video/scripts/narration/`

> 口播以分词稿为准 · TTS 后需重跑 `patch_section_video_timing.py`

---

## 01 · open

**PPT（屏幕）**
- 眉题：01 OPEN
- 讲解图：agent-loop.svg
- GATE 9：流水线拦不拦得住

**口播**
> 同学们好，我是你们的老师404。GATE 9 今天考的就一件事：你的流水线拦不拦得住。我站闸口边看三样——到闸停不停、批了动不动、驳回了回不回得来。工具表三件、编排文档、执行日志，证据齐了咱们再口试，对吧。

文稿：`video/scripts/narration/01-open.txt`

---

## 02 · gate-demo

**PPT（屏幕）**
- 眉题：02 GATE DEMO
- 讲解图：skill-anatomy.svg
- 现场跑流水线，导师闸口抽查

**口播**
> 现场跑一遍流水线，确认界面信息够不够你做决策——不是「发送吗」四个字，是草稿加关键数字加风险标红。挂了也好，用排障速查现场修一次，修的过程本身就是加分；假装没挂，那才是真挂，咱们都懂，对吧。

文稿：`video/scripts/narration/02-gate-demo.txt`

---

## 03 · oral-three

**PPT（屏幕）**
- 眉题：03 ORAL THREE
- 讲解图：v2-panorama.svg
- 口试三题：三问、三反模式、信任分级

**口播**
> 口试三题都在课上讲过。你的闸——看什么、谁来看、多久看一次？确认闸形同虚设的三种死法是什么，你怎么避开？从每次都看到抽看，中间条件是什么——连续通过攒额度，抽看配定期审计。答不出信任分级路径，等于第二节白听，对吧。

文稿：`video/scripts/narration/03-oral-three.txt`

---

## 04 · close

**PPT（屏幕）**
- 眉题：04 TAKEAWAY
- 讲解图：agent-loop.svg
- 过了这关，手里是一条带刹车的 AI 流水线

**口播**
> 同学们，本节先到这里。全绿才过：三件 Skill 齐、编排清楚、闸口实测、日志可回放，commit 信息也写规范。过了这关，你手里就是一条完整的、带刹车的 AI 流水线。明天收官，把它接上驾驶舱，然后你来讲给我听。

文稿：`video/scripts/narration/04-close.txt`

---

## 评审清单

- [x] PPT 无口播正文，仅图 + 概念卡/表
- [x] 口播与 `narration/*.txt` 一致
- [ ] TTS 后 patch 时间轴并重渲
