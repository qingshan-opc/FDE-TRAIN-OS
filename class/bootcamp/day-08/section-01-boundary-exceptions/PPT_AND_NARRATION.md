# 第八天 · 第 1 节 · 概念：边界与异常——从能跑到可依赖

路径：`class/bootcamp/day-08/section-01-boundary-exceptions/video/`  
PPT：`video/index.html`（**仅讲解图 + 概念要点，无口播正文**）  
分词稿：`video/scripts/narration/`

> 口播以分词稿为准 · TTS 后需重跑 `patch_section_video_timing.py`

---

## 01 · open

**PPT（屏幕）**
- 眉题：01 OPEN
- 讲解图：exception-taxonomy.svg
- 能跑 ≠ 可依赖
- 乖数据上二连过，只是第一步

**口播**
> 同学们好，我是你们的老师404。第八天第一节。昨天你的 Skill 在乖数据上二连过，恭喜，它能跑了。但能跑和可依赖之间，隔着一份边界声明和一张异常分类表。真实世界的输入不乖：数据是空的、字段缺了、接口超时了，对吧。

文稿：`video/scripts/narration/01-open.txt`

---

## 02 · bad-input-scenes

**PPT（屏幕）**
- 眉题：02 BAD INPUT SCENES
- 讲解图：exception-taxonomy.svg
- 三个真实坏输入场景
- 空数据 · 缺字段 · 需求模糊

**口播**
> 三个场景：老板要周报，但 KPI 接口返回空数组；异常工单缺了逾期天数字段；老板说把两周数据合并一下——到底是哪两周？这时候你的 Skill 会干嘛？如果答案是不知道，那它只是能跑，还不可依赖，嘛。

文稿：`video/scripts/narration/02-bad-input-scenes.txt`

---

## 03 · four-exception-types

**PPT（屏幕）**
- 眉题：03 FOUR EXCEPTION TYPES
- 讲解图：exception-taxonomy.svg
- 异常四分类
- 输入错 · 环境错 · 能力限 · 目标歧

**口播**
> 异常分四类，处置各不同。输入错——数据为空、字段缺失、格式不对：拒绝执行，明说缺什么，不编数据补洞。环境错——接口超时、文件打不开：重试一次，报环境问题并停止，不假装成功。能力限——超出说明书范围：声明超边界，询问后再动。目标歧——指令有两种以上合理解法：列出理解选项，请求确认，对吧。

文稿：`video/scripts/narration/03-four-exception-types.txt`

---

## 04 · fail-by-design

**PPT（屏幕）**
- 眉题：04 FAIL BY DESIGN
- 讲解图：exception-taxonomy.svg
- 停下来 · 说清楚 · 等人来
- 按声明的方式失败

**口播**
> 共同原则一句话：停下来、说清楚、等人来。对照你们第五天的数据不足就说不足，是同一道防线的工程化。从今天起，你的 Skill 失败的每一种方式，都是你提前设计好的——这叫按声明的方式失败。失败不可怕，失控地失败才可怕，对吧。

文稿：`video/scripts/narration/04-fail-by-design.txt`

---

## 05 · boundary-declaration

**PPT（屏幕）**
- 眉题：05 BOUNDARY DECLARATION
- 讲解图：exception-taxonomy.svg
- 边界声明写法
- 不接受 · 输入不足时 · 超范围 · 指令歧义

**口播**
> 边界声明加在说明书里：不接受什么输入；输入不足时停止执行、列出所缺字段；超范围请求声明边界、询问后再继续；指令歧义时列出不超过三种理解、请求确认。让 Skill 拒绝执行，不是显得弱——会拒绝的才可依赖，瞎编的周报比没有周报危害大十倍，嘛。

文稿：`video/scripts/narration/05-boundary-declaration.txt`

---

## 06 · close

**PPT（屏幕）**
- 眉题：06 TAKEAWAY
- 讲解图：exception-taxonomy.svg
- 下一节：异常注入测试

**口播**
> 同学们，本节先到这里。边界声明是 Skill 从能跑到可依赖的门票。下一节上刑场——故意喂坏输入，看你的 Skill 怎么死。死法符合声明，才算过关，咱们下午再挂 Agent。

文稿：`video/scripts/narration/06-close.txt`

---

## 评审清单

- [x] PPT 无口播正文，仅图 + 概念卡/表
- [x] 口播与 `narration/*.txt` 一致
- [ ] TTS 后 patch 时间轴并重渲
