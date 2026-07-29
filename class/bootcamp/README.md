# 训练营 · 十天实战主线（V0.1 → V2.0）

> 实战为主：每节概念只讲「最小必要版」（5–15′），完整理论在[公开课](../open-course/README.md)。
> 每天 100–140′，最后一节永远是验收；三道闸不过不进阶。

## 十天合约

| 天 | 主题 | 版本 | 当日产出 | 课件包 |
|---|------|------|---------|--------|
| D1 | AI 时代的产品经理 | 角色周 | PRD.md | [day-01](day-01/README.md) |
| D2 | AI 时代的架构师 | 角色周 | architecture.md | [day-02](day-02/README.md) |
| D3 | AI 时代的前端 | 角色周 | index.html | [day-03](day-03/README.md) |
| D4 | AI 时代的后端 | 角色周 | API_Spec.md + DB_Schema.md | [day-04](day-04/README.md) |
| D5 | FDE 全栈理论 | — | theory-map.md | [day-05](day-05/README.md) |
| D6 | LLM 理论 18 词 | — | 18 词抽测过线 | [day-06](day-06/README.md) |
| D7 | 第一个 Skill | SKILL | Skill 跑出证据 | [day-07](day-07/README.md) |
| D8 | Skill 工程化 + 遇见 Agent | AGENT | Agent 正确调用你的 Skill | [day-08](day-08/README.md) |
| D9 | 多 Skill 编排与人工确认 | 编排 | 部门流程半自动 | [day-09](day-09/README.md) |
| D10 | V2.0 收官 | V2.0 | 答辩通过 + 90 天自学路线 | [day-10](day-10/README.md) |

## 每日一包的结构

每个 `day-xx/` 目录：

| 层级 | 内容 |
|------|------|
| `README.md` | 当日合约：章节地图 / 验收 / GATE |
| `day.yaml` | 胶囊 quiz、media、lab、resources（合约源） |
| `section-NN-*/` | 每节五件套：`lesson.md` · `practice.md` · `resources.md` · `homework.md` · `ai-tutor.yaml` |
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

主线所有人同款：部门驾驶舱。30% 换成自己部门的真实数据与问题——方向卡 Day 1 定稿，之后每天的实战与作业都迁移到自己的场景。
