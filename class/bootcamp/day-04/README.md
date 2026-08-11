# Day 4 · 测试、发布与最终验收

> 今日目标：承接 Day3 已交给 `@测试` 的版本，完成测试计划、执行证据、缺陷修复与复测，再由 `@运维` 完成本地发布和回退演练，最后回到 `@产品经理` 按最初业务目标终验。

## 今天完成哪条岗位链

```text
@测试读取 Day3 交付物
  → 生成 test-plan.md 并等待“确认测试”
  → 执行启动、页面、接口、数据、错误与隐私测试
  → 生成 defect-log.md 和 test-report.md
  → @前端 或 @后端 按责任修复
  → @测试 复测并完成回归
  → @运维 生成 deployment-plan.md 并等待“确认部署”
  → 完成本地发布、健康检查、重启与回退演练
  → @产品经理 根据 PRD 最终验收
```

Day4 不是让一个智能体把测试、修复和部署全部包办。学员要保留岗位边界，收集实际证据，并亲自通过两个确认闸门。

## 六节课

| 节 | 目录 | 主题 | 时长 | 形式 | 学员端产出 |
|---|---|---|---|---|---|
| 1 | `section-01-testing-role/` | 测试不是挑错，而是提供可信证据 | 15′ | 认知+对比 | 测试职责与传统岗位对比 |
| 2 | `section-02-test-plan/` | 把需求翻译成测试计划 | 20′ | 计划实操 | `test-plan.md` |
| 3 | `section-03-execute-tests/` | 按计划执行并留下证据 | 25′ | 执行实操 | `test-evidence/`、测试记录 |
| 4 | `section-04-defect-retest/` | 缺陷归责、修复、复测与回归 | 25′ | 闭环实操 | `defect-log.md`、`test-report.md` |
| 5 | `section-05-operations-plan/` | 运维接棒并制定发布计划 | 20′ | 计划实操 | `deployment-plan.md` |
| 6 | `section-06-release-final-acceptance/` | 本地发布、回退演练和产品终验 | 25′ | 发布+终验 | `DEPLOYMENT.md`、`day4-release-log.md` |

## 学员端模块

每节固定包含 `lesson.md`、`practice.md`、`resources.md`、`homework.md`、`ai-tutor.yaml` 和数字人口播课件。页面按课件讲解、知识卡片、知识确认、本地实操、提交验证展开。讲解下方提供名词解释、资源、工具与资料。

所有实操都使用 P1、P2 等短提示词。学员看到“等待”后先检查实际结果，再发送下一段。

## Day4 结束标准

- `test-plan.md` 覆盖 PRD、页面、接口、数据、错误、持久化、权限与隐私；
- 每条测试都有操作、预期、实际和证据；
- 每个缺陷只有一个主要责任岗位，修复后由 `@测试` 复测；
- `test-report.md` 的阻塞问题全部关闭，核心流程完成回归；
- `deployment-plan.md` 经学员本人确认后才发布；
- `DEPLOYMENT.md` 写清启动、停止、健康检查、日志、备份、更新和回退；
- `@产品经理` 已根据 `PRD.md`、`test-report.md` 和 `DEPLOYMENT.md` 完成最终验收。
