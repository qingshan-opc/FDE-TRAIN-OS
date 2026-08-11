# 第二天 · 第 4 节 · 分段生成可运行页面

路径：`class/bootcamp/day-02\section-04-build-running-page/video/`  
PPT：`video/index.html`（**仅讲解图 + 概念要点，无口播正文**）  
分词稿：`video/scripts/narration/`

> 口播以分词稿为准 · TTS 后需重跑 `patch_section_video_timing.py`

---

## 01 · open

**PPT（屏幕）**
- 今天最重要的实操
- 原型 → 可运行前端
- 一段一验，不一次做完

**口播**
> 同学们好，我是你们的老师404。现在开始今天最重要的实操：把已经确认的 UI 原型变成能运行的前端。继续使用 @前端，但不要发送一条“全部帮我做完”。我们把开发拆成四段，每一段完成后都由你亲手打开页面检查。

文稿：`video/scripts/narration/01-open.txt`

---

## 02 · why-split

**PPT（屏幕）**
- 为什么要分四段
- 一次全做，出错很难定位
- 每段只增加一种能力
- 最近变化，就是优先检查点

**口播**
> 一次生成全部文件时，如果页面打不开，你不知道是结构、路径、样式还是交互出了问题。分段以后，每次只增加一种能力。上一段还能运行，下一段刚出问题，优先检查刚刚增加的内容。这就是工程里的控制变量，小白也可以用。

文稿：`video/scripts/narration/02-why-split.txt`

---

## 03 · stage-one

**PPT（屏幕）**
- 第一段 · 建立三文件骨架
- frontend/index.html
- frontend/styles.css
- frontend/app.js
- 完成后立刻双击打开

**口播**
> 第一段告诉前端：实施清单已经确认，请创建 frontend 目录和三个文件。此时只建立页面结构和文件引用，不加入复杂交互。完成后找到 frontend 里面的 index.html，双击用浏览器打开。能看到完整结构，才进入下一段；如果空白，就停下来解决。

文稿：`video/scripts/narration/03-stage-one.txt`

---

## 04 · stage-one-check

**PPT（屏幕）**
- 第一段检查
- 文件真实落盘
- 页面不是空白
- CSS 与 JS 引用存在

**口播**
> 检查时不要只相信对话框里的“已创建”。看工作区文件树，确认三个文件真实存在；打开页面，确认不是空白；再让前端说明 HTML 怎样引用 CSS 和 JavaScript。第一段过不了，就不要急着复制第二段提示词。

文稿：`video/scripts/narration/04-stage-one-check.txt`

---

## 05 · stage-two

**PPT（屏幕）**
- 第二段 · 还原 UI 样式
- 读取 design-spec 与原型
- 颜色 · 字号 · 间距 · 布局 · 按钮状态

**口播**
> 第二段只做样式。要求前端读取 design-spec 和 ui-prototype，把主色、字号、间距、布局和按钮状态写进 styles.css，不改变 PRD 的页面范围。完成后让它列出五个肉眼可核对的设计点，你再刷新页面逐项对照。

文稿：`video/scripts/narration/05-stage-two.txt`

---

## 06 · stage-three

**PPT（屏幕）**
- 第三段 · 加入主要交互
- 读取 ui-flow.md
- 筛选 · 表单 · 主要按钮
- 操作必须产生可见反馈

**口播**
> 第三段才加入行为。要求前端读取 ui-flow，在 app.js 实现项目最重要的筛选、表单或按钮。演示数据集中放在文件顶部。最关键的一句话是：每次操作必须产生可见反馈。按钮不能只是长得像按钮，用户点击后要看到列表变化、提示出现或状态切换。

文稿：`video/scripts/narration/06-stage-three.txt`

---

## 07 · demo-not-api

**PPT（屏幕）**
- 当前仍用演示数据
- 不连接真实后端
- 不编造接口地址
- 先验证页面行为

**口播**
> 这一阶段仍然使用演示数据，不连接真实后端。看到列表变化，不代表数据库已经接通。我们是在验证页面行为和用户体验。要求前端清楚标记演示数据，不要为了让代码显得完整，编造一个不存在的接口地址。

文稿：`video/scripts/narration/07-demo-not-api.txt`

---

## 08 · stage-four

**PPT（屏幕）**
- 第四段 · 补齐四种状态
- loading · empty
- success · error
- 提供小白能找到的演示入口

**口播**
> 第四段补齐加载、空数据、成功和错误。要求前端提供一个小白能找到的演示入口，例如页面上的状态切换区，或者清楚说明怎样触发。只在代码里写了 loading 这个单词，不代表用户真的看得到加载状态。

文稿：`video/scripts/narration/08-stage-four.txt`

---

## 09 · run-after-each

**PPT（屏幕）**
- 每段完成都做同一件事
- 刷新页面 · 亲手操作
- 查看控制台
- 不通过就停在当前段

**口播**
> 每段完成后都做三件事：刷新页面，亲手执行当前操作，查看控制台有没有红色错误。不通过就停在当前段，只排查最近新增内容。不要靠不断追加新提示词掩盖旧问题，项目越往后拖，定位成本越高。

文稿：`video/scripts/narration/09-run-after-each.txt`

---

## 10 · close

**PPT（屏幕）**
- 今天使用无构建方案
- 先跑通，再加工具
- 读输入 → 分段实现 → 每段运行
- 下一节：人工验收与修复

**口播**
> 今天选择三文件无构建方案，是为了让每位同学都能直接运行。以后换 React、Vue 或其他工具，核心流程不会变：读取上游输入、确认计划、分段实现、每段运行、按标准验收。完成四段后先不要宣布成功，下一节我们要像真实项目一样做人工验收和修复。同学们，本节先到这里。

文稿：`video/scripts/narration/10-close.txt`

---

## 评审清单

- [x] PPT 无口播正文，仅图 + 概念卡/表
- [x] 口播与 `narration/*.txt` 一致
- [ ] TTS 后 patch 时间轴并重渲
