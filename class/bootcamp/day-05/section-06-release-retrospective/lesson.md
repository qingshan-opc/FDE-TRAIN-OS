# 第 6 节 · 发布终验与流程复盘

> 一句话节引言：运维完成技术最后一棒，产品经理回到起点完成业务终验，学员再把整个流程变成可迁移地图。

## 🎬 视频位

- 工程：`video/`
- 成片：`video/renders/day05-c6-release-retrospective.mp4`
- 口播真相源：`scripts/section_narrations/day05_s06.yaml`

## 教学目标

- 让 `@运维` 只接收测试建议发布的确定版本；
- 先生成发布计划，再由学员完成“确认部署”；
- 逐步发布并保留健康、主流程、日志、数据和回退证据；
- 最后回到 `@产品经理` 根据迭代 PRD 完成业务终验；
- 生成六岗位输入、输出、下一棒和退回条件的流程复盘。

## 最后两棒

```text
@运维
输入：测试报告、原部署说明、确定代码版本
输出：发布计划、发布日志和恢复证据
下一棒：@产品经理

@产品经理
输入：迭代 PRD、测试报告、发布日志
输出：iteration-final-acceptance.md
终点：process-retrospective.md
```

## 传统职能与 AI 时代

AI 能帮助运维生成命令，也能帮助产品经理整理验收对照。人的责任没有消失。运维要决定数据与恢复风险，产品经理要判断真实用户价值，学员要确认每一条证据来自实际运行。

## 为什么最后回产品经理

测试证明系统符合合同，运维证明版本能够运行和恢复。只有产品经理能够回到最初用户问题，判断这项改进是否真的达成业务目标。

## 流程复盘不是感想

复盘必须引用本次真实文件。六个岗位各写一行输入、输出、下一棒和退回条件，再总结下一次如何减少返工。

## 本节产出

- `day5-replay/iteration-deployment-plan.md`
- `day5-replay/iteration-release-log.md`
- `day5-replay/iteration-final-acceptance.md`
- `day5-replay/process-retrospective.md`
