# FDE 训练营 · 课程包总览

> 大模型已经泛化，人类还没有。这个课程包做两件事：
> **公开课**负责「看懂这个时代」，**训练营**负责「动手建成系统」。

## 两条线，怎么用

| 线 | 目录 | 定位 | 用法 |
|---|------|------|------|
| **公开课** | `open-course/` | 世界观与理论完整版（O1–O5） | Day 0 自学，或训练营期间每晚 30′；不设闸 |
| **训练营** | `bootcamp/` | 十天实战主线：第一周指挥 AI 软件团队，第二周 Skill 与 Agent | 每天 100–140′，实战为主，三道闸验收 |

判断标准：**「不懂它就动不了手」的留在训练营，「懂了更好、不懂也能做」的放进公开课。**
公开课 O1–O4 是 Day 1 快测 6 题的考点范围——公开课是主课的免修考试。

## 目录

```
class/
├── README.md            ← 你在这里
├── bootcamp/            # 训练营：day-01 … day-10（section-* + day.yaml）
├── open-course/         # 公开课：O1–O5
├── teaching/            # 讲师稿 / 决策记录（教研内部，不对学员）
├── assets/diagrams/     # 讲解图 SVG
├── resources/           # 词典 / Prompt 工具包 / 阅读清单
├── quality/             # 教研 QA 记录
└── schedule/            # 课表网站
```

## 给讲师

- 视频位全部预留：每节课件标「🎬 视频位」，现阶段配**口播稿 + 讲解图**，看文档能答对题就算学会。
- 验收标准全部公开，AI 导师按表执行；没有「我觉得还行」，只有 Rubric 全绿。
- 第一周当前内容源：[`scripts/land_week1_command_team_course.py`](../scripts/land_week1_command_team_course.py)，负责落到 Day 1–5；讨论稿与领域基线保存在 [`teaching/week1-command-team/`](teaching/week1-command-team/)。第二周结构参考 [`docs/spec/0.4/curriculum-v0.6.md`](../docs/spec/0.4/curriculum-v0.6.md)；合约由 [`scripts/build_v07_week1_contracts.py`](../scripts/build_v07_week1_contracts.py) 生成。
- 口播视频流水线：[`scripts/README.md`](../scripts/README.md) · Skill [`.cursor/skills/fde-section-courseware/`](../.cursor/skills/fde-section-courseware/SKILL.md)
- **口播过稿索引**：[`quality/narration-review-index.md`](quality/narration-review-index.md)（第五天–第十天 34 节 PPT + 分词稿路径）
- 讲师内部稿：[`teaching/`](teaching/)（不对学员披露）
