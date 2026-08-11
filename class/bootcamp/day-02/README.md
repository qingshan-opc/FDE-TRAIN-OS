# Day 2 · 把 UI 原型变成能运行的前端

> 今日目标：**承接 Day1 已验收的 PRD 和 UI 原型，在 QRAE 中亲自完成“UI 交接 → 前端实现 → UI 复验 → 后端接收数据需求”的第二次软件工程接力。**

## 这一天解决什么

Day1 的 `ui-prototype.html` 是用来确认需求和交互的样品，还不是正式前端。Day2 要让学员看懂二者差异，并指挥 `@前端` 把原型实现为结构清楚、可以直接运行、具备真实交互状态、以后能够接后端数据的页面。

学员不需要先学会写 HTML、CSS 和 JavaScript。需要学会的是：先把上游文件交全，让前端复述理解；选择最简单可运行方案；把大任务拆成多段提示词；亲手打开页面验收；发现问题后交回责任岗位修复；最后把前端所需的数据和接口写成文件交给 `@后端`。

## 六节课程

总时长 120′

| 节 | 目录 | 主题 | 时长 | 形式 | 学员端产出 |
|---|---|---|---|---|---|
| 1 | `section-01-prototype-vs-frontend/` | 原型不等于前端：传统职能 vs AI 时代前端 | 15′ | 认知+对比 | 角色边界判断 |
| 2 | `section-02-frontend-handoff/` | 把 Day1 四份文件交给 `@前端` | 20′ | 交接实操 | 前端实施清单 |
| 3 | `section-03-frontend-basics/` | 用人话看懂 HTML、CSS、JavaScript 与数据状态 | 15′ | 概念+练习 | 三层职责图 |
| 4 | `section-04-build-running-page/` | 分段指挥 AI 生成可运行的三文件前端 | 30′ | 分段实操 | `frontend/` 三文件 |
| 5 | `section-05-accept-and-repair/` | 亲手验收页面并完成一次修复闭环 | 20′ | 验收实操 | 前端验收记录 |
| 6 | `section-06-ui-review-backend-handoff/` | 回到 UI 复验，再交接后端 | 20′ | 交接实操 | `frontend-api-needs.md` + `day2-handoff-log.md` |

## 今日固定交接链

```text
Day1 已验收文件
  → @前端读取并复述
  → @前端生成正式页面
  → 学员亲手运行和检查
  → @UI 检查还原度
  → @前端修复
  → @后端读取 frontend-api-needs.md
```

## 今日过关标准

- `frontend/index.html`、`frontend/styles.css`、`frontend/app.js` 均存在；
- 双击 `frontend/index.html` 可以打开，页面不是截图；
- 至少一个筛选、表单或按钮会产生可见反馈；
- 页面具备加载、空数据、成功、错误四种状态的实现或演示入口；
- UI 已按 `design-spec.md` 与 `ui-flow.md` 复验；
- `frontend-api-needs.md` 写清页面需要的数据字段、提交内容、返回内容和错误展示；
- `day2-handoff-log.md` 记录 UI → 前端 → UI → 前端 → 后端的岗位切换。

## 边界

Day2 不连接真实数据库，不要求部署，也不让前端编造后端接口。演示数据集中放在 `frontend/app.js`，真实数据与接口由下一岗位继续完成。
