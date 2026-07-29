# 第九天 · 第 3 节 · 再封装两个 Skill

路径：`class/bootcamp/day-09/section-03-two-more-skills/video/`  
PPT：`video/index.html`（**仅讲解图 + 概念要点，无口播正文**）  
分词稿：`video/scripts/narration/`

> 口播以分词稿为准 · TTS 后需重跑 `patch_section_video_timing.py`

---

## 01 · open

**PPT（屏幕）**
- 眉题：01 OPEN
- 讲解图：skill-anatomy.svg
- 工具表扩编：1 件变 3 件

**口播**
> 同学们好，我是你们的老师404。扩编开始。工具表从一件变三件，每件大概十三分钟。流程你们熟：倒序写、四部件、边界声明、工具描述——快在你已经会了，不是快在跳过部件，方法沉淀的红利就在这儿，对吧。

文稿：`video/scripts/narration/01-open.txt`

---

## 02 · upstream-input

**PPT（屏幕）**
- 眉题：02 UPSTREAM INPUT
- 讲解图：skill-anatomy.svg
- 输入段写明上游 Skill 产出

**口播**
> 两个新要点。第一，输入段写明上游——比如输入：Skill A 的输出 JSON，含 kpi 和 exceptions 数组。契约咬合就靠这一句，别写一些数据这种模糊话。咱们流水线最怕接口对不齐。

文稿：`video/scripts/narration/02-upstream-input.txt`

---

## 03 · send-guard

**PPT（屏幕）**
- 眉题：03 SEND GUARD
- 讲解图：skill-anatomy.svg
- 发送类 Skill 必须等确认

**口播**
> 第二，如果第三件是发送或通知类 Skill，步骤第一步必须是等待人工确认结果。边界里写死：未收到批准时，不执行，保持等待。工具描述的何时用也要写明——仅在人工确认通过后，对吧。

文稿：`video/scripts/narration/03-send-guard.txt`

---

## 04 · align-check

**PPT（屏幕）**
- 眉题：04 ALIGN CHECK
- 讲解图：skill-anatomy.svg
- 数据流对齐三查

**口播**
> 最后四分钟做数据流对齐三查。A 的输出字段能不能喂饱 B？B 的草稿里有没有确认界面要的关键数字和风险标红？C 的输入从哪来——确认后的草稿加批准记录。查不到咬合点，第四节编排必卡，咱们别留坑，对吧。

文稿：`video/scripts/narration/04-align-check.txt`

---

## 05 · close

**PPT（屏幕）**
- 眉题：05 TAKEAWAY
- 讲解图：skill-anatomy.svg
- 图纸和施工必须一致

**口播**
> 同学们，本节先到这里。写不完两件也别硬撑：优先保证发送类那件，闸的训练价值最高。想封装的和串联图不一样？现在二选一，改图或改 Skill，图纸和施工必须一致。带走一句——三件齐了，咱们下一节真正串联。

文稿：`video/scripts/narration/05-close.txt`

---

## 评审清单

- [x] PPT 无口播正文，仅图 + 概念卡/表
- [x] 口播与 `narration/*.txt` 一致
- [ ] TTS 后 patch 时间轴并重渲
