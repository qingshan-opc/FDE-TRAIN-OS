# 课程结构 v0.6 · 实战主课 + 公开课拆分（取代 v0.5 的课内全盘理论）

> 动因：训练营要**以实战为主**。完整理论（演进史、生态深读、词典、拓展阅读）
> 不是不要，而是移出主课、独立成**公开课**——课前自学 + 每晚延伸，不占实战时间。
> 同时文件按用途拆分到独立目录，课件讲解图全部落成可复用的独立 SVG。

## 一、拆分原则

| 留在训练营（主课） | 移入公开课（self-study） |
|---|---|
| 每节**最小必要概念**（5–15′ 快讲，够动手即可） | 完整版理论：技术演进史、LLM 本体、生态深读 |
| 全部实战课节与验收（三道闸不变） | 新概念词典 18 词完整版 + 自测 |
| 当天要用到的那张图、那句口诀 | 拓展阅读（云原生/SQL/多模态/微调/Agent 深入） |
| 方向卡、迭代日志、十条能力证据 | 延伸书单与视频清单 |

判断标准一句话：**「不懂它就动不了手」的留主课，「懂了更好、不懂也能做」的进公开课。**

## 二、公开课（class/open-course/）· 建议 Day 0 或每晚 30′

| 讲 | 内容 | 时长 | 配套图 |
|---|------|-----|--------|
| O1 | 时代与 FDE：技术演进六次浪潮（完整版）+ FDE 角色 | 30′ | evolution-timeline |
| O2 | LLM 本体：能力/边界/幻觉/Token/多模态/开源闭源/微调 vs Prompt | 40′ | llm-capability |
| O3 | LLM 生态：四层生态图 + 厂商 + 平台 + MCP/Agent 框架 | 30′ | llm-ecosystem |
| O4 | 新概念词典 18 词 + 自测 6 题 | 30′ | （卡片，复用 resources/glossary.md） |
| O5 | 拓展阅读：演进/生态/云原生/SQL/Agent 深入 | 自由 | （复用 resources/reading-list.md） |

公开课不设闸，但 Day 1 快测 6 题的考点全部来自 O1–O4——**公开课是主课的免修考试范围**。

## 三、训练营十天（实战为主，每天 100–140′）

**Day 1 从「全天世界观」改为「世界观快通 + 第一次动手」**（110′ · 6 节）：

| # | 课节 | 分钟 | 形式 | 要点 |
|---|------|-----|------|------|
| 1 | 世界观快通：演进线 + 生态图 | 15 | 概念 | 两张图讲完「为什么是现在、你在哪一层」；完整版 = 公开课 O1/O3 |
| 2 | LLM 最小认知：能力/边界/幻觉 | 10 | 概念 | 够后面接电用即可；完整版 = O2 |
| 3 | 四层架构 + 两周路线 | 15 | 概念 | 前端/接口/数据库/模型；十天演进图 |
| 4 | 实战：Agent Lab 环境导览 | 25 | 实战 | 五步闭环导师演一遍，学员跟一遍 |
| 5 | 实战：方向卡 + 线框草稿 | 35 | 实战 | 3 个可数据化问题 + V0.1 线框与 Prompt 草稿（原 D2 内容前移） |
| 6 | 验收：快测 6 题 + 方向卡过闸 | 10 | 验收 | 考点 = 公开课 O1–O4；方向卡过导师闸 |

**Day 2–10 主线不变**（V0.1→V2.0），只做两处瘦身：

- 各天概念节标注「拓展见公开课 Ox」，主课只讲最小必要版；
- Day 2 因线框前移，腾出 20′ 给「生成 V0.1 + 三态打磨」。

## 四、文件布局（class/ 目录重组）

```
class/
├── README.md                 # 总览：训练营 vs 公开课的关系与用法
├── bootcamp/                 # 训练营主课（实战为主）
│   ├── README.md             # 十天总览：合约、三道闸、70/30
│   └── day-01/ … day-10/     # 每日一包：README.md（当日合约）
│        └── section-01-*/ …  # 每节 tabs 五文件（与 v0.4 约定一致）：
│             ├── lesson.md       课件（概念最小版 + 图引用 + 🎬口播稿位）
│             ├── practice.md     练习 tab
│             ├── resources.md    资源 tab
│             ├── homework.md     作业包 tab
│             └── ai-tutor.yaml   AI 导师 tab（persona/规则/快捷问题/验收规则）
├── open-course/              # 公开课（课前自学 + 每晚延伸）
│   ├── README.md
│   ├── o1-era.md  o2-llm.md  o3-ecosystem.md  o4-glossary.md  o5-reading.md
├── assets/diagrams/          # 全部讲解图（独立 SVG，课件与网站共用）
├── resources/                # 词典/阅读清单/速查卡（已有，不动）
└── schedule/                 # 课表网站（index.html + styles.css + app.js）
```

## 五、讲解图清单（class/assets/diagrams/，全部独立 SVG）

**已有（从网站抽离）**：evolution-timeline · llm-ecosystem · four-layer（深色）· ten-day-grid · agent-loop

**待绘（按天归属）**：

| 图 | 用于 | 内容 |
|----|------|------|
| llm-capability | O2 / D1 | LLM 会什么 vs 不会什么；幻觉是机制不是 bug |
| agentlab-five-steps | D1 / D2 | Agent Lab 五步闭环：线框→Prompt→生成→验收→迭代 |
| five-blocks | D2 | 驾驶舱五区块骨架（+D5 第六块 AI 摘要） |
| three-states | D2 / D3 | 加载/空/错三态占位 |
| prompt-four-elements | D2 / D5 | Prompt 四要素：角色/任务/约束/格式 |
| api-contract | D3 | 前端 ↔ JSON 契约 ↔ 后端 |
| http-status-map | D3 | 状态码地图：200/400/404/500 是谁的锅 |
| fastapi-anatomy | D3 | 一次请求的生命周期：路径→参数→逻辑→响应模型 |
| table-row-pk | D4 | 表/行/主键示意（KPI 表为例） |
| sql-four-moves | D4 | SQL 四板斧：SELECT/INSERT/UPDATE/DELETE |
| sqlite-to-pg | D4 | 换库时机阶梯：SQLite → PostgreSQL |
| model-gateway | D5 | 应用 → 模型网关 → 多模型（闭源/开源/本地） |
| llm-ops-triangle | D5 | 接入架构：密钥/超时/降级 |
| context-assembly | D5 | 上下文装配：这次调用放什么进模型视野 |
| deploy-pipeline | D6 | 部署管线：代码→构建→镜像→运行→访问 |
| env-config-split | D6 | 环境与配置分离：密钥不进代码 |
| skill-anatomy | D7 | Skill 解剖：输入/步骤/输出/证据 |
| harness-anatomy | D8 | Harness 组成：模型+工具表+记忆+循环 |
| workflow-vs-agent | D8 | 决策树：能写死用 workflow，写不死上 agent |
| exception-taxonomy | D8 | Skill 异常分类与处置 |
| orchestration-confirm | D9 | 三 Skill 编排 + 人工确认点 + 执行日志 |
| v2-panorama | D10 | V2.0 全景：驾驶舱 + Agent + Skills + 十条证据 |

## 六、落地顺序

1. 本文件 → 2. 目录拆分 + 网站 CSS/JS/SVG 抽离 → 3. 公开课 O1–O5
→ 4. bootcamp 每日课件包（Day 1 先行） → 5. 课件图绘制 → 6. 网站按 v0.6 更新
