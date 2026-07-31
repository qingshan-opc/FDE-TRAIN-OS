# 训练营 · 实战主线（业务系统 → Skill / Agent）

> 实战为主：每节概念只讲「最小必要版」（5–15′），完整理论在[公开课](../open-course/README.md)。
> 每天 100–140′，最后一节永远是验收；三道闸不过不进阶。
> **周六加餐**插在第五天与 LLM 理论日之间（课次编号 Day 6；侧栏显示「周六」）。

## 课次合约

| 天 | 主题 | 版本 | 当日产出 | 课件包 |
|---|------|------|---------|--------|
| D1 | 组建你的 AI 工程师团队 | V0.1 | 项目任务书 + PRD + 四页原型 | [day-01](day-01/README.md) |
| D2 | 指挥前端完成真实页面 | V0.5 | 四页 Mock 前端 + 五接口契约 | [day-02](day-02/README.md) |
| D3 | 指挥后端接通真实数据 | V0.8 | SQLite + 业务接口 + 全链路联调 | [day-03](day-03/README.md) |
| D4 | 指挥测试、修复与冻结 | V0.9 | 用例、缺陷闭环、验收证据 | [day-04](day-04/README.md) |
| D5 | 讲清产品怎么做出来并交付 | V1.0 | 本地交付 + 复盘路演 + 综合验收 | [day-05](day-05/README.md) |
| 周六 | FDE 全栈理论 / 互联网地图 | — | 六节理论地图 + 手绘架构图 | [day-06](day-06/README.md) |
| D6 | LLM 理论 18 词 | — | 18 词抽测过线 | [day-07](day-07/README.md) |
| D7 | 第一个 Skill | SKILL | Skill 跑出证据 | [day-08](day-08/README.md) |
| D8 | Skill 工程化 + 遇见 Agent | AGENT | Agent 正确调用你的 Skill | [day-09](day-09/README.md) |
| D9 | 多 Skill 编排与人工确认 | 编排 | 部门流程半自动 | [day-10](day-10/README.md) |
| D10 | V2.0 收官 | V2.0 | 答辩通过 + 90 天自学路线 | [day-11](day-11/README.md) |

## 每日一包的结构

每个 `day-xx/` 目录：

| 层级 | 内容 |
|------|------|
| `README.md` | 当日合约：章节地图 / 验收 / GATE |
| `day.yaml` | 胶囊 quiz、media、lab、resources（合约源） |
| `section-NN-*/` | 每节五件套：`lesson.md` · `practice.md`（**必含「一键粘贴提示词」**）· `resources.md` · `homework.md` · `ai-tutor.yaml` |
| `section-*/video/` | 口播 HyperFrames 工程（可选；成片在 MinIO） |

历史材料（如旧 Day6 部署课）见 [`_archive/`](_archive/README.md)，不参与节序映射。

## 归档与参考

- 旧 Day6 部署六节 → [`_archive/day-06-deploy/`](_archive/day-06-deploy/)
- Day5 视频流水线速览 → [`day-05/VIDEO_PIPELINE.md`](day-05/VIDEO_PIPELINE.md)

## 三道闸

- **GATE 1 日验收**（每天最后 10–20′，AI 导师执行）：Rubric 全绿，不过当天补。
- **GATE 2 周验收**（Day 6，导师 + 互评）：V1.0 换设备能开、证据齐、讲得清选型。
- **GATE 3 毕业答辩**（Day 10，评委）：V2.0 演示 + 十条能力证据 + 「Agent 什么时候会选错」。

## 70% 主线 + 30% 方向

主线所有人同一套工程骨架：驾驶舱 + 提交 + 列表 + 详情 + SQLite。领域由学员按专业、岗位或兴趣选择；首期提供财务费用、HR 员工诉求、经营问题闭环三个基线，也允许自定义同等复杂度方向。方向在第一天定稿，之后五天只换业务字段和指标，不改变开发顺序。
