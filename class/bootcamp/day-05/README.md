# Day 5 · 完整开发流程复现

> 今日目标：不再逐个学习岗位，而是围绕现有项目的一项微迭代，重新指挥六个岗位完成一次完整接力。

## 这一天解决什么

前四天已经完成第一个可运行项目。Day5 要验证学员是否真的理解工程流程，而不是只会照抄某一天的提示词。

学员从现有项目中选择一个小而真实的改进，例如按部门筛选、按月份筛选或增加一个状态说明。改进必须能够在当天完成，并且需要走完产品、界面、前端、后端、测试和运维六个岗位。

所有新增文件放在项目根目录的 `day5-replay/` 中。原有 Day1 到 Day4 交付物只读使用，不覆盖、不重命名。

## 章节地图

| 节 | 目录 | 主题 | 时长 | 形式 | 学员端产出 |
|---|---|---|---|---|---|
| 1 | `section-01-pm-replay/` | 产品经理重跑需求与范围 | 20′ | 复跑实操 | `iteration-prd.md`、`pm-handoff.md` |
| 2 | `section-02-ui-replay/` | UI 重跑交互原型 | 20′ | 复跑实操 | `iteration-ui-spec.md`、`ui-handoff.md` |
| 3 | `section-03-frontend-replay/` | 前端按合同完成页面改动 | 25′ | 复跑实操 | 前端代码、`frontend-acceptance.md`、`frontend-handoff.md` |
| 4 | `section-04-backend-replay/` | 后端完成接口、数据与联调 | 25′ | 复跑实操 | `iteration-api-spec.md`、`iteration-db-change.md`、后端代码与交接 |
| 5 | `section-05-testing-replay/` | 测试执行、缺陷闭环与发布结论 | 25′ | 复跑实操 | `iteration-test-plan.md`、`iteration-test-report.md` |
| 6 | `section-06-release-retrospective/` | 运维发布、产品终验与流程复盘 | 25′ | 发布+复盘 | `iteration-release-log.md`、`iteration-final-acceptance.md`、`process-retrospective.md` |

## Day5 三条纪律

1. 每次只和一个岗位对话，换岗位时用 `@岗位` 明确切换。
2. 每段提示词只完成一个阶段，智能体输出后必须停止等待学员确认。
3. 不用口头说“已经完成”代替文件、运行结果和证据路径。

## 人工确认闸门

- 产品经理输出范围后，学员回复“确认需求”。
- UI 输出交互方案后，学员回复“确认原型”。
- 前端输出改动清单后，学员回复“确认前端改动”。
- 后端输出接口与数据方案后，学员回复“确认后端改动”。
- 测试计划通过后，学员回复“确认测试”。
- 发布计划通过后，学员回复“确认部署”。

## 今日最终过线

- 六个岗位都有明确输入、输出和交接文件。
- 微迭代能够真实运行，测试证据和发布证据可以打开。
- 产品经理根据最初的 `iteration-prd.md` 给出通过或不通过。
- `process-retrospective.md` 能说明每个岗位从哪里接、交给谁、什么情况下退回。

## 每节固定文件

每节均包含 `lesson.md`、`practice.md`、`resources.md`、`homework.md`、`ai-tutor.yaml` 和口播课件。
