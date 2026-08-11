# 第二天 · 第 6 节 · UI 复验与后端交接

路径：`class/bootcamp/day-02\section-06-ui-review-backend-handoff/video/`  
PPT：`video/index.html`（**仅讲解图 + 概念要点，无口播正文**）  
分词稿：`video/scripts/narration/`

> 口播以分词稿为准 · TTS 后需重跑 `patch_section_video_timing.py`

---

## 01 · open

**PPT（屏幕）**
- Day2 最后一条交接链
- 前端 → UI → 前端 → 后端
- 由你亲自切换岗位

**口播**
> 同学们好，我是你们的老师404。前端页面已经能运行，接下来完成 Day2 最后一条交接链。你会亲自从前端切换到 UI 做复验，有问题再回前端修复，最后把页面的数据需求交给后端。仍然不允许智能体自动替你跳过岗位。

文稿：`video/scripts/narration/01-open.txt`

---

## 02 · ui-review

**PPT（屏幕）**
- 第一段 · 切换 @UI
- 读取设计规范、UI 流程与前端文件
- 只验收，不直接修改

**口播**
> 第一段切换到 @UI，让它读取 design-spec、ui-flow 和 frontend 目录里的三个文件。明确要求只验收，不直接修改代码。为什么要回 UI？因为设计岗位制定了视觉与交互标准，前端不能自己判断自己的还原度一定合格。

文稿：`video/scripts/narration/02-ui-review.txt`

---

## 03 · actionable-ui

**PPT（屏幕）**
- UI 反馈必须可执行
- 通过/不通过
- 文件依据 · 可量化差距
- 责任岗位

**口播**
> UI 每项反馈要包含通过或不通过、文件依据、可量化差距和责任岗位。“不够高级”“还原度不高”都不能直接交给前端。要说具体颜色、字号、间距、布局或哪个点击流程与文件不一致，这样修改才有边界。

文稿：`video/scripts/narration/03-actionable-ui.txt`

---

## 04 · back-frontend

**PPT（屏幕）**
- 第二段 · 回到 @前端
- 只处理 UI 问题清单
- 说明修改文件与复测方法
- 完成后再次回 @UI

**口播**
> 有不通过项时，切回 @前端，只让它处理 UI 的问题清单，不顺手重构整个项目。修改后再切回 @UI，沿用同一文件依据复验。UI 通过以前，这一棒还没有结束。验收、修改、复验，必须回到原岗位闭环。

文稿：`video/scripts/narration/04-back-frontend.txt`

---

## 05 · api-needs

**PPT（屏幕）**
- 第三段 · 生成前端数据需求
- frontend-api-needs.md
- 页面需要什么，提交什么，期待什么

**口播**
> UI 复验通过后，再切换到 @前端，要求它生成 frontend-api-needs 文件。这个文件不是写代码，而是把页面需要的数据说清楚：展示哪些字段，用户提交什么内容，期待后端返回什么，加载、空数据和错误怎样展示。

文稿：`video/scripts/narration/05-api-needs.txt`

---

## 06 · fields-example

**PPT（屏幕）**
- 字段要写含义
- 名称 · 金额 · 状态 · 更新时间
- 不要只列英文变量
- 后端要理解业务用途

**口播**
> 字段不能只列几个英文变量名。比如 amount 是预算金额还是实际金额，status 有哪些可能值，updatedAt 是业务发生时间还是最后修改时间，都要写出含义。这样后端才能根据真实业务设计数据，而不是猜前端页面想表达什么。

文稿：`video/scripts/narration/06-fields-example.txt`

---

## 07 · no-fake-api

**PPT（屏幕）**
- 前端不能替后端决定
- 不编接口地址
- 不编数据库结构
- 不写密钥和真实隐私

**口播**
> Day2 只描述数据需求，不允许前端编造接口地址、数据库表或服务器配置。更不能把 API 密钥、密码和真实个人信息写进文件。前端提出需要什么，后端下一步确认怎样提供，这是两个岗位之间的正常分工。

文稿：`video/scripts/narration/07-no-fake-api.txt`

---

## 08 · backend-receive

**PPT（屏幕）**
- 第四段 · 切换 @后端
- 读取 PRD 与前端数据需求
- 只复述与提问
- 今天不提前开发

**口播**
> 接着切换到 @后端，让它读取 PRD 和 frontend-api-needs，只复述收到的业务规则、页面数据需求和待确认问题。今天先不要生成接口和数据库文件。让后端停在“接收完成、等待确认”的位置，Day3 才从一个清楚的开工点正式继续。

文稿：`video/scripts/narration/08-backend-receive.txt`

---

## 09 · log

**PPT（屏幕）**
- 写入 day2-handoff-log.md
- UI → 前端 → UI → 前端 → 后端
- 输入 · 输出 · 验收 · 修改轮次

**口播**
> 最后创建 day2-handoff-log 文件，记录 UI 到前端、前端回 UI、UI 再交前端、最后交后端的每次切换。每一棒写清输入文件、输出文件、验收结果和修改轮次。另一个同学只看日志，也应该能还原项目怎样走到这里。

文稿：`video/scripts/narration/09-log.txt`

---

## 10 · close

**PPT（屏幕）**
- Day2 完成的跨越
- 原型 → 可运行前端
- 运行验收 → UI 复验
- 数据需求 → @后端 接收
- 下一天：后端正式开工

**口播**
> 回顾今天，你先分清了原型和正式前端，把四份文件交给 @前端，分四段生成可运行页面，亲手完成一次问题修复，再回 @UI 复验，最后把数据需求交给 @后端。你不是在背一套工具操作，而是在建立任何软件项目都通用的岗位交接能力。下一天，我们从后端的接收复述开始，让页面真正拥有业务规则和数据能力。同学们，本节先到这里。

文稿：`video/scripts/narration/10-close.txt`

---

## 评审清单

- [x] PPT 无口播正文，仅图 + 概念卡/表
- [x] 口播与 `narration/*.txt` 一致
- [ ] TTS 后 patch 时间轴并重渲
