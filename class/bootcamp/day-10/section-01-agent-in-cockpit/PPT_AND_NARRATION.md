# 第十天 · 第 1 节 · Agent 接入驾驶舱

路径：`class/bootcamp/day-10/section-01-agent-in-cockpit/video/`  
PPT：`video/index.html`（**仅讲解图 + 概念要点，无口播正文**）  
分词稿：`video/scripts/narration/`

> 口播以分词稿为准 · TTS 后需重跑 `patch_section_video_timing.py`

---

## 01 · open

**PPT（屏幕）**
- 眉题：01 OPEN
- 讲解图：v2-panorama.svg
- 驾驶舱 AI 助手位最后一块拼图

**口播**
> 同学们好，我是你们的老师404。驾驶舱右边那个 AI 助手位空了九天了，今天让它活起来——这是 V2.0 最后一块拼图。助手位不是装饰用的聊天框，是驾驶位：状态看得见、刹车踩得到，才叫接入，对吧。

文稿：`video/scripts/narration/01-open.txt`

---

## 02 · three-requirements

**PPT（屏幕）**
- 眉题：02 THREE REQUIREMENTS
- 讲解图：v2-panorama.svg
- 接入三要件：唤起、状态、闸在页内

**口播**
> 接入三要件。第一唤起：助手位能发消息给 Agent，Agent 能回话。第二状态：流水线跑到哪一步，助手位实时可见，最小实现读 runs/ 最新日志行就行。第三闸在页内：确认界面出现在驾驶舱里，批准和驳回按钮直接点，对吧。

文稿：`video/scripts/narration/02-three-requirements.txt`

---

## 03 · min-impl

**PPT（屏幕）**
- 眉题：03 MIN IMPL
- 讲解图：v2-panorama.svg
- 最小实现：对话区 + 日志 + 两个按钮

**口播**
> 最小实现别贪大：对话区接 Agent，状态读 runs/ 日志最新行，闸就是草稿渲染加两个按钮。一件通了再做下一件——别三个半成品堆在一起，咱们宁可做一个能点批准的真闸，对吧。

文稿：`video/scripts/narration/03-min-impl.txt`

---

## 04 · priority

**PPT（屏幕）**
- 眉题：04 PRIORITY
- 讲解图：v2-panorama.svg
- 优先级：闸 > 状态 > 唤起

**口播**
> 时间不够怎么办？优先级记死：闸大于状态大于唤起。对话区接不通真实 Agent 环境？降级方案也行——助手位展示当前步骤加确认按钮，指令复制到 Agent Lab 执行，结果回填。思想不变，咱们打通的是人、Agent、驾驶舱的信息回路，对吧。

文稿：`video/scripts/narration/04-priority.txt`

---

## 05 · panorama-check

**PPT（屏幕）**
- 眉题：05 PANORAMA CHECK
- 讲解图：v2-panorama.svg
- 六个区块 + Agent + 三件 Skill 全亮

**口播**
> 同学们，本节先到这里。做完对照 V2.0 全景图打勾：六个区块、Agent、三件 Skill——全亮，你的 V2.0 就成了。样式复用驾驶舱既有卡片，助手位别长得像外来的。带走一句：助手位是驾驶位，不是摆设。

文稿：`video/scripts/narration/05-panorama-check.txt`

---

## 评审清单

- [x] PPT 无口播正文，仅图 + 概念卡/表
- [x] 口播与 `narration/*.txt` 一致
- [ ] TTS 后 patch 时间轴并重渲
