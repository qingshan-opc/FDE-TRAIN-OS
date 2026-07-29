# FDE 训练营 v0.7 · 第一周课程蓝本：AI 时代的角色与全栈理论

> 2026-07-25 起生效，取代 `curriculum-v0.6.md` 对第一周（Day 1–5）的定义。
> Day 6–10 仍按 v0.6（部门 AI 驾驶舱 V1.0→V2.0）执行，待 Week 2  redesign 时对齐。
> 落地管线：本蓝本 → `class/bootcamp/day-0N/`（README + lesson/practice + day.yaml）
> → `scripts/build_v07_week1_contracts.py` → `contracts/examples/day-0N-curriculum.yaml` → seed → 学员端。

## 1. 为什么要改

v0.6 第一周是「部门 AI 驾驶舱」项目线：世界观快通 → 前端 → 接口 → 数据库 → 模型接电。
问题是：学员还没建立「角色全景」就被推去生成页面——他知道怎么点工具，不知道自己在扮演谁、
产出的文档在团队协作里交给谁。

v0.7 第一周改为**角色周**：五天走一遍产品研发团队的五个关键视角——
产品经理 → 架构师 → 前端 → 后端 → FDE 全栈理论收束。
每天配一个**角色 Agent 提示词**（封装进提示词工具包），学员当天就用它产出真实交付物：
PRD → 架构决策 → 高保真原型 → API+数据库设计 → 全栈理论地图。
四天的交付物沿工作区逐日继承（cumulative），恰好复刻「PM → 架构 → 前端 → 后端」的真实协作链。
第五天不学新工具，把前四天的体感升级成完整理论框架。

## 2. 五天总览

| Day | 主题 | 角色提示词（工具包） | 当日交付物（lab primary_files） |
|-----|------|---------------------|--------------------------------|
| 1 | AI 时代的产品经理 | `PM_Agent_Prompt.md` | `PRD.md` |
| 2 | AI 时代的架构师 | `Architect_Agent_Prompt.md`（新撰） | `architecture.md` |
| 3 | AI 时代的前端 | `Web_Client_Agent_Prompt.md` + `UIUX_Designer_Agent_Prompt.md` | `index.html` |
| 4 | AI 时代的后端（数据库+后端） | `Backend_Engineer_Agent_Prompt.md` | `API_Spec.md` + `DB_Schema.md` |
| 5 | FDE 全栈理论（世界观/开发流程/服务器与云原生/前后端选型） | —（纯理论日，不配提示词） | `theory-map.md` |

> **Day 5 修订（v0.7.1, 2026-07-26）**：章节改为 ①世界观白话版 ②软件开发流程与需求调研
> ③服务器与云原生 ④前端技术图与框架选型 ⑤后端技术图与框架选型 ⑥验收；
> 设计模式整节删除（过深）；每节 20–25′（总 150′），口播稿放宽到 500–700 字；
> 题量加大：每节 capsule quiz 6 题、日级快测 15 题（过线 10）；
> 每节配 SVG 讲解图（`class/assets/diagrams/day5-*.svg`），
> 底部资源区配 3 个交互式 H5 讲义（`class/resources/h5/`，视觉沿用 schedule 体系、可点击交互；
> 该路径已加入 CSP `script-src 'unsafe-inline'` 白名单，见 `services/shared/middleware.py`）。

贯穿项目：学员自带一个「小产品点子」（默认示例：部门周报助手），五天围绕同一个点子产出五份交付物。

## 3. 每天固定结构

- 5 节 capsule（Day 5 为 6 节）：概念节 + 实战节 + 验收节；每节 10–30′，全天 90–120′。
- 每节 capsule 都有：口播稿（content）、必做文本练习（practice）、节级快测（quiz，2–3 题）。
- 实战节（第 4 节）配 local_prep（本机 AI 工具加练，一键复制 prompt）。
- 节点固定五种：learn / quiz / lab / project / review（系统约束，同天不重复）。
- 日级快测 6 题，过线 4/6。
- **不生成视频**：胶囊不带 media；口播稿即未来录制用文案，现阶段作为精读文本呈现。

## 4. 口播稿写作规范（未来录视频的文案）

1. **称呼**：开口必称「同学们」；全文第二人称「你」。
2. **小白友好**：每个术语第一次出现，紧跟一句「人话」解释；每节至少一个生活化类比
   （餐厅点菜讲 API、图书馆讲数据库、装修讲架构……）。
3. **顿挫**：用破折号「——」和分段制造停顿；每段不超过 80 字；关键句独立成段。
4. **重点加高**：需要声音加高的词用「」包出（如——「验收」——）；每节 3–6 处，不超过 6 处。
5. **节奏**：开头 15 秒内抛出本节要回答的问题；结尾给一句「带走的话」（可背诵的结论句）。
6. 长度：每节 350–550 字（约 2–3 分钟口播）。

## 5. 提示词工具包（学员可下载）

落盘 `class/resources/prompt-toolkit/`，学员端以 `kind: download` 资源呈现
（URL `/course-assets/resources/prompt-toolkit/...`）：

- `README.md` —— 工具包用法：四要素、何时用哪个、怎么迭代
- `PM_Agent_Prompt.md` —— Day 1（源自《产品研发 Agent 团队全套 11 个提示词》）
- `Architect_Agent_Prompt.md` —— Day 2（本课程新撰，风格对齐同套件）
- `Web_Client_Agent_Prompt.md` —— Day 3（同套件）
- `UIUX_Designer_Agent_Prompt.md` —— Day 3 辅助（同套件）
- `Backend_Engineer_Agent_Prompt.md` —— Day 4（同套件）

## 6. day.yaml 数据模式（生成器输入）

每个 `class/bootcamp/day-0N/day.yaml`：

```yaml
day: 1
project: AI 时代的产品经理
project_brief: 120 字内当日简报
resources:            # 日级资源（工具包下载 + 速查卡）
  - {id, title, kind: download|doc|link, summary, url?}
capsule_extra:        # 节级附加
  c1:
    resource_ids: […]
    quiz: [[题干, [选项…], 正确答案下标, 解析], …]
  c4:
    local_prep: {skill_id: fde-local-prep, codex_prompt, checklist: […], suggested_questions: […], template_resource_id?}
quiz: [[题干, [选项…], 答案下标, 解析], …]   # 日级 6 题
lab:
  primary_files: [PRD.md]
  prompt: |           # agent prompt_template
  rubric: [{check: file_exists, args: {path: PRD.md}}, {check: text_contains, args: {path: PRD.md, needle: 验收标准}}]
nodes_lab: 节点标题
```

## 7. 质量评估 Rubric（每课 100 分，≥80 合格）

| 维度 | 权重 | 合格线 |
|------|------|--------|
| 小白可懂度（类比/人话解释/无堆砌术语） | 25 | 每个新概念有人话解释 |
| 口播稿规范（同学们/顿挫/重点「」/带走的话） | 20 | 五条全满足 |
| 闭环完整（概念→练习→快测→lab→验收闸） | 20 | 五节点齐全且互相引用 |
| 提示词可用性（学员能复制即用、产出可验收） | 20 | lab rubric 可机器校验 |
| 考点覆盖（quiz 覆盖当日全部关键概念） | 15 | 每个 capsule 至少 1 题可溯源 |

评估产出：`class/quality/week1-v07-review.md`。
