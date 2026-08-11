# 训练营 · 实战主线（业务系统 → Agent 内核）

> 实战为主：每节概念只讲「最小必要版」（5–15′），完整理论在[公开课](../open-course/README.md)。
> 每天 100–140′，最后一节永远是验收；闸门不过不进阶。
> **周六加餐**插在第五天与 LLM/Agent 周之间（课次编号 Day 6；侧栏显示「周六」）。
> Week2 教学包：[`../teaching/week2-cockpit-agent/`](../teaching/week2-cockpit-agent/README.md)

## 产品叙事（统一口径）

```
Week1 业务系统（CRUD 可运行）
  → 周六：全栈理论地图（选做：顺手加成看板/助手位）
  → D6：应用内真实 LLM 对话
  → D7：Skill 可加载调用
  → D8：Agent Loop（tool_calls）
  → D9：长任务 Loop + HITL
  → D10：UI 全接线 + 答辩 V2.0
```

同一应用，不是换产品。驾驶舱桥接 **非必做**。用提示词驱动编码 AI，在学员自己的仓库里实现 Agent 最小内核。

## 课次合约

| 天 | 主题 | 版本 | 当日产出 | 课件包 |
|---|------|------|---------|--------|
| D1 | 组建你的 AI 工程师团队 | V0.1 | 项目任务书 + PRD + 原型 | [day-01](day-01/README.md) |
| D2 | 指挥前端完成真实页面 | V0.5 | 可运行前端 + 契约 | [day-02](day-02/README.md) |
| D3 | 指挥后端接通真实数据 | V0.8 | SQLite + 业务接口 + 联调 | [day-03](day-03/README.md) |
| D4 | 指挥测试、修复与冻结 | V0.9 | 用例、缺陷闭环、证据 | [day-04](day-04/README.md) |
| D5 | 完整流程复现 | V1.0 | 微迭代证据 | [day-05](day-05/README.md) |
| 周六 | FDE 全栈理论 / 互联网地图 | — | 理论地图 + 架构图 | [day-06](day-06/README.md) |
| D6 | LLM → 应用内对话 | CHAT | 助手位/面板多轮对话 | [day-07](day-07/README.md) |
| D7 | 第一个可执行 Skill | SKILL | `SKILL.md` + runs/ | [day-08](day-08/README.md) |
| D8 | Skill 工程化 + Agent Loop | LOOP | `loop.py` + 工具日志 | [day-09](day-09/README.md) |
| D9 | 长任务 + 人工确认 | HITL | `task_runner` + 双路径证据 | [day-10](day-10/README.md) |
| D10 | V2.0 收官 | V2.0 | UI 接线 + 答辩 | [day-11](day-11/README.md) |

## 每日一包的结构

每个 `day-xx/` 目录：

| 层级 | 内容 |
|------|------|
| `README.md` | 当日合约：章节地图 / 验收 / GATE |
| `day.yaml` | 胶囊 quiz、media、lab、resources（合约源） |
| `section-NN-*/` | 每节五件套：`lesson.md` · `practice.md`（**必含「一键粘贴提示词」**）· `resources.md` · `homework.md` · `ai-tutor.yaml` |
| `section-*/video/` | 口播 HyperFrames 工程（可选；成片在 MinIO） |

历史材料见 [`_archive/`](_archive/README.md)。

## 三道闸

- **GATE 1 日验收**（每天最后，AI 导师 / 助教）：Rubric 全绿。
- **GATE 2 对话过线**（D6）：助手位/对话面板可多轮真实 LLM 对话。
- **GATE 3 毕业答辩**（D10）：V2.0 演示 + 业务系统 / Skill / Loop 关系讲清。

## 70% 主线 + 30% 方向

主线骨架：业务系统 → Agent 内核（对话·Skill·Loop·HITL）+ SQLite。  
领域由学员自选；方向第一天定稿后只换字段，不改开发顺序。
