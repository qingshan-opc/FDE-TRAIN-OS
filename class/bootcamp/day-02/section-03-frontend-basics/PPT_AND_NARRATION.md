# 第二天 · 第 3 节 · 用人话看懂前端三件套

路径：`class/bootcamp/day-02\section-03-frontend-basics/video/`  
PPT：`video/index.html`（**仅讲解图 + 概念要点，无口播正文**）  
分词稿：`video/scripts/narration/`

> 口播以分词稿为准 · TTS 后需重跑 `patch_section_video_timing.py`

---

## 01 · open

**PPT（屏幕）**
- 不背语法，先看懂分工
- HTML · CSS · JavaScript
- 结构 · 样式 · 行为

**口播**
> 同学们好，我是你们的老师404。开始生成前端以前，我们只用几分钟认识三个文件。今天不背标签、不背语法，也不要求你突然变成程序员。你只要知道它们各自负责什么，页面出问题时就不会只剩下一句“怎么打不开”。

文稿：`video/scripts/narration/01-open.txt`

---

## 02 · html

**PPT（屏幕）**
- HTML 管结构
- 页面有哪些东西
- 标题 · 表格 · 表单 · 按钮 · 内容区

**口播**
> HTML 是页面的骨架。它决定页面有什么：标题放在哪里，有没有筛选区，有没有表单、列表、卡片和按钮。就像一套房子的墙、门和房间位置。HTML 不负责把房子装修得多漂亮，先负责把该有的空间搭出来。

文稿：`video/scripts/narration/02-html.txt`

---

## 03 · css

**PPT（屏幕）**
- CSS 管样式
- 颜色 · 字号 · 间距 · 布局
- 按钮默认 / 悬停 / 禁用

**口播**
> CSS 是页面的衣服和装修。主色是什么，标题多大，卡片之间留多少距离，手机上怎样排列，按钮正常、鼠标悬停和暂时不能点击时分别长什么样，都由 CSS 负责。页面有内容但看起来像一张没排版的纸，先检查样式文件是否正确连接。

文稿：`video/scripts/narration/03-css.txt`

---

## 04 · javascript

**PPT（屏幕）**
- JavaScript 管行为
- 点击 · 筛选 · 校验 · 切换状态
- 操作以后必须有可见反馈

**口播**
> JavaScript 负责页面动作。点击查询以后列表变化，填写表单以后检查必填项，切换状态以后显示空数据或错误提示，这些属于 JavaScript。页面看起来正常，但按钮怎么点都没有反应，通常要检查 app.js 和浏览器控制台。

文稿：`video/scripts/narration/04-javascript.txt`

---

## 05 · links

**PPT（屏幕）**
- 三个文件怎样连起来
- index.html 引用 styles.css
- index.html 引用 app.js
- 路径错：无样式或无反应

**口播**
> 三个文件不是各过各的。index.html 里会写明到哪里找到 styles.css，也会写明到哪里找到 app.js。路径写错时，页面可能还能打开，却没有样式；也可能样式正常，但所有按钮失效。所以今天每生成一个阶段，都要立即运行一次。

文稿：`video/scripts/narration/05-links.txt`

---

## 06 · demo-data

**PPT（屏幕）**
- 演示数据 ≠ 真实数据
- 集中放在 app.js 顶部
- 不用隐私，不写密钥

**口播**
> 今天仍然使用演示数据。它是虚构或脱敏的，只为验证页面怎样展示和操作。要求 AI 把演示数据集中放在 app.js 顶部，未来后端接入时才能快速找到替换位置。不要把真实公司数据、个人隐私和 API 密钥放进前端，因为浏览器里的内容有可能被用户看到。

文稿：`video/scripts/narration/06-demo-data.txt`

---

## 07 · four-states

**PPT（屏幕）**
- 真实页面要面对四种状态
- loading · 正在等待
- empty · 没有数据
- success · 正常结果
- error · 失败与重试

**口播**
> 页面不能只画一张顺利结果。加载状态告诉用户系统正在处理；空数据状态告诉用户没有记录以及下一步能做什么；成功状态展示正常结果；错误状态说明失败并提供重试办法。只做成功状态，就像只为晴天设计道路，真实使用一定会出问题。

文稿：`video/scripts/narration/07-four-states.txt`

---

## 08 · close

**PPT（屏幕）**
- 只学会一个调试动作
- F12 → 控制台
- 看见红错，记录现象
- 下一节：四段生成

**口播**
> 今天只学一个调试动作：按 F12 打开开发者工具，找到控制台。出现红色错误时，不要求你立刻读懂，而是记录在哪个页面、做了什么、实际看到什么、预期什么，再交给 @前端。记住：HTML 是结构，CSS 是样式，JavaScript 是行为。下一节开始四段生成。同学们，本节先到这里。

文稿：`video/scripts/narration/08-close.txt`

---

## 评审清单

- [x] PPT 无口播正文，仅图 + 概念卡/表
- [x] 口播与 `narration/*.txt` 一致
- [ ] TTS 后 patch 时间轴并重渲
