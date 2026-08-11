# 第 6 节 · 本地实操

先切换到 `@运维`。完成发布后再明确切回 `@产品经理`。

## 第 1 段 · 生成发布计划

```text
请读取 iteration-test-report.md、原 DEPLOYMENT.md 和当前代码。
生成 day5-replay/iteration-deployment-plan.md。
写清版本、备份、步骤、健康检查、日志、停止、回退触发条件和回退步骤。
保存后停止，等我回复“确认部署”。
```

## 第 2 段 · 执行并留证

```text
已确认。一次只给一个发布操作和成功信号。
等我反馈实际结果后再继续。
完成后生成 day5-replay/iteration-release-log.md，记录版本、操作、结果和证据。
```

## 第 3 段 · 回产品经理终验

```text
@产品经理，请读取 iteration-prd.md、iteration-test-report.md 和 iteration-release-log.md。
不要修改代码。
逐条核对用户故事、范围和验收标准。
生成 day5-replay/iteration-final-acceptance.md，最后只给出通过或不通过。
```

## 第 4 段 · 完整流程复盘

```text
请根据本次真实文件生成 day5-replay/process-retrospective.md。
用六行说明每个岗位的输入、输出、下一棒和退回条件。
再写三条做得好的地方、三条下次改进和一份可复用六步清单。
```

## 学员最终检查

- 测试通过的版本是否等于发布版本？
- 发布证据是否来自真实运行？
- 产品终验是否逐条引用证据？
- 流程复盘是否能让你换工具后仍然照着做？
