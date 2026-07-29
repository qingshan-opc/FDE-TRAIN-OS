# 第一周（v0.7）课程质量评估报告

> 评估日期：2026-07-25（v0.7.1 Day 5 修订复评：2026-07-26）· 评估人：教研（AI 协同）
> 评估对象：Day 1–5（AI 时代的产品经理 / 架构师 / 前端 / 后端 / FDE 全栈理论）
> Rubric 见 `docs/spec/0.4/curriculum-v0.7.md` 第 7 节；机检脚本 `scripts/check_week1_quality.py`。

## v0.7.1 Day 5 修订说明（2026-07-26）

依据课程负责人评审意见重做 Day 5：设计模式整节删除（过深）；世界观改白话加长（20′+）；
新增软件开发流程与需求调研、服务器与云原生、前端/后端技术选型详解（含 Java/Python 框架地图）；
每节 20–25′（总 150′）；题量加大为每节 6 题 + 日级 15 题；每节配 SVG 讲解图（6 张新图）；
底部资源区改为图文交互式 H5 单页 ×3（技术选型地图 / 云原生之旅 / 开发全流程，可点击交互，
视觉沿用课程网站体系）。配套修复：`services/shared/middleware.py` 为
`/course-assets/resources/h5/` 路径加 CSP `script-src 'unsafe-inline'` 白名单（否则内联脚本被拦）；
stub 的 theory-map 分支同步新主题（云原生/前端/后端），Day5 lab 端到端评测 4/4 通过。
旧 Day 5（v0.7 草稿）归档于 `backups/2026-07-25-pre-v06/class-bootcamp-v07-draft-day05/`。
复评结论：Day 5 修订后总分 94（小白可懂度 25/25——全节生活化类比贯穿）。
注：本次修订由主会话内联完成（子代理因 API 额度限制不可用）。

## v0.7.2 学员端资源区改造（2026-07-26）

依据课程负责人意见改造课节底部资源区：
- 课节底部改为「资源 / 工具与资料」双 tab（`LearnAssetsTabs`，web/src/app/CapsuleReader.tsx）；
- **资源** tab：本节课节链接的讲解图/交互讲义/下载，可点击打开；
- **工具与资料** tab：本节固定配套件（提示词、模板、清单），仅展示不可点击；
- 工具与资料按课节固定（每节 2–3 件，见各 day.yaml `capsule_extra.cN.tools`，
  生成器透传为 capsule.tools），不再全天资源池混放；
- 原 `ToolsPanel`（全天池）从课节视图移除，Lab 工作台保留。
验证：e2e media/local-prep/coach/full-chain 相关 spec 全部通过；双 tab 截图复核。

## v0.7.3 Day 5 内容加深（2026-07-26）

依据课程负责人三条意见：
1. **新增第 4 节「实战：服务器命令行仿真」**（Day 5 变 7 节、总时长 175′）：
   新 H5 仿真终端 `class/resources/h5/server-cli-lab.html`（8 个任务真敲命令：
   pwd/ls/mkdir/cd/curl/tail -f/chmod/docker ps，含假文件系统与任务卡判分，
   tail -f 实时滚动 + Ctrl+C 退出；实测 8/8 全通过零 JS 报错）；
   配套命令手册 `class/resources/server-cli-manual.md`（日常八句 + 第二梯队 + 排障四步），
   挂课节资源区与「工具与资料」。
2. **前端改为四大平台全图**（回应「前端很浅，App/小程序都算前端」）：
   tech-stack-explorer 重写为三 Tab（前端四大平台 / 后端语言与框架 / 数据库场景选型），
   每张卡片含 优势/劣势/适用场景/官方链接（react.dev、flutter.dev 等真实外链），
   附前端路线对比表与数据库场景速配表；section-05 课文同步改为平台分类讲授
   （Web：React/Vue/Angular/Svelte/Next/Nuxt/不用框架；App：Swift/Kotlin/Flutter/RN；
   小程序：原生/Taro/uni-app；桌面：Electron/Tauri）；
   day5-frontend-map.svg 重绘为四平台海报。
3. **后端补数据库场景选型与语言×框架图**：PostgreSQL/MySQL/SQLite/MongoDB/Redis/
   Elasticsearch/ClickHouse 场景速配（原选型三选一 → 主库+加配模型）；
   day5-backend-map.svg 重绘（四语言卡片 + 数据库场景矩阵）；section-06 课文数据库段同步扩写。
4. 题库：c4 新增 6 题（命令行），c5/c6 题面覆盖移动端与数据库场景，日级快测 15→**18 题**
   （过线 12）；理论地图升六大主题（含命令行）；lab prompt 与 stub theory-map 同步。
5. 修复：仿真页任务判分被内置命令截胡（执行顺序 runTask → runBuiltin）；卡片展开 max-height 加高。

## v0.7.4 命令行仿真改用原生 sim 实验台（2026-07-26）

课程负责人决策（已对齐）：① 命令行仿真并入 Day 5 第 3 节「服务器与云原生」（取消独立第 4 节，
Day 5 恢复 6 节 155′）；② 实现改用平台原生 sim 实验台，弃用 H5 仿真页。

落地：
- `sim/adapters/server/` 扩展命令行八句语义：pwd/ls -l/mkdir -p/cd/curl（未启动拒绝连接、
  启动后 200）/tail -f（滚动日志）/chmod +x/docker ps + `python3 server.py` 启动置端口态；
  假文件系统（deploy.sh / app/server.py / app/logs/server.log）。
- Day 5 lab 改为 `runner: sim, sim_kind: server`：rubric = 命令序列七句 + port_listening(8000)
  + 启动命令，sim adapter 机判；lab.task_brief（任务卡文案）+ lab.quick_commands（九枚
  快捷命令按钮，替换 SimLab 原硬编码 nginx 集，已改为 lab/seed 驱动）。
- theory-map 移至企业任务节点提交（ProjectSubmit 支持附件上传）。
- 第 3 节课文合并命令行教学（30′），题库 c3 扩至 8 题，日级快测保持 18（第 3 节占 5 题）；
  理论地图六大主题不变。
- 生成器支持 sim lab 分支（无 primary_files/inherited_files）；质检器放开 sim runner。
- e2e：`learner-sim-lab.spec.ts` 重写并启用——API 侧解锁 Day 5（胶囊 opened + 练习 submitted
  + quiz 18 题）后进 UI 走完整终端流程，评测通过（3.0s）；media/local-prep/coach/rubric-loop 回归全绿。
- H5 版仿真（server-cli-lab.html）留档不再链接；命令手册保留为资源/工具。

## v0.7.5 课节步骤条动态化（2026-07-26）

课程负责人指出顶部步骤条写死「视频讲解/知识确认/提交验收」不对——没有实验入口、且应随课节内容变化。落地：
- 步骤条真正动态：有视频才叫「视频讲解」（v0.7 无视频一律显示「课件讲解」）；
  有练习/快测才出「知识确认」；有 local_prep 才出「本地实操」；**课节带 lab 配置才出「实验」**。
- 新增课节内嵌实验组件 `CapsuleSimTerminal`（web/src/components/learn/）：轻量版终端
  （创建会话/快捷命令/自由输入/评测展示），复用 server sim 适配器；节点过闸仍在今日 Lab 完成。
- 数据通道：day.yaml `capsule_extra.cN.lab` → 生成器透传 capsule.lab；Day 5 第 3 节首个启用
  （同一套命令行八句任务与 rubric）。
- 验证：Day 1 显示「课件讲解/知识确认」、Day 5 第 3 节显示「课件讲解/知识确认/实验/提交验收」，
  实验 tab 内全流程（建会话→九句命令→评测通过）截图复核；media/local-prep/coach/sim 回归全绿。

## v0.7.6 终端交互真实化（2026-07-26）

课程负责人反馈仿真终端「交互不太好」，逐项修正（sim/adapters/server + 两处终端 UI）：
- 提示符带目录且随 cd 变化（`trainee@fde-server:~/app$`），action 响应 state 增加 cwd；
- 成功即静默：`mkdir -p`（含重复执行）、`cd`、`chmod +x` 不再输出 "(no output)/(created)" 噪音；
- 权限位真实：`ls -l` 中 deploy.sh 在 chmod +x 前是 `-rw-r--r--`、之后是 `-rwxr-xr-x`；
- `tail -f` 进入跟踪态，敲下一条命令自动先输出 `^C（已退出实时跟踪）`——不再是「卡死也照跑」；
- 快捷命令按钮从「代你执行」改为「填入输入框」，学员自己回车——保住「每个字母自己敲」的规矩；
- e2e sim spec 同步为「按钮填入 + 回车」流程，回归全绿。
- 运维教训：8760 常驻进程是 `uvicorn services.api.app:app` 形态，之前多次按
  `uvicorn api.app:app` 模式 pkill 未命中导致旧适配器代码一直在跑——重启后已确认新语义生效。

## 总分

| 课程 | 小白可懂度 /25 | 口播稿规范 /20 | 闭环完整 /20 | 提示词可用性 /20 | 考点覆盖 /15 | 合计 | 结论 |
|------|:-:|:-:|:-:|:-:|:-:|:-:|------|
| Day 1 产品经理 | 24 | 18 | 20 | 20 | 14 | **96** | 合格 |
| Day 2 架构师 | 23 | 18 | 20 | 19 | 13 | **93** | 合格 |
| Day 3 前端 | 22 | 17 | 20 | 20 | 14 | **93** | 合格 |
| Day 4 后端 | 23 | 18 | 20 | 20 | 13 | **94** | 合格 |
| Day 5 全栈理论 | 23 | 19 | 20 | 16* | 14 | **92** | 合格 |

\* Day 5 为纯理论日，按设计不配角色提示词，「提示词可用性」维度改为评 lab 引导提示词质量。

## 机检结果（check_week1_quality.py）

- **0 FAIL · 9 WARN**（2026-07-25 对生成合约的运行结果）。
- 通过项：五节点闭环、每节 content/practice/quiz 齐全、日级 quiz 6 题、
  「同学们」开场全覆盖、资源 URL 全部指向真实文件、lab rubric 全部可机检、
  inherited_files 链 PRD.md → architecture.md → index.html → API_Spec.md+DB_Schema.md 逐日正确。
- 9 条 WARN 均为「『』重点 9–12 处/节（期望 3–6）」——详见已知问题 1。

## 评估中发现并已修复

1. Day 1 资源 `prd-cheatsheet` 为无文件占位 → 已补写 `class/resources/cheatsheet-prd.md` 并接 URL。
2. Day 2 资源 `cs-arch` 同上 → 已补写 `class/resources/cheatsheet-arch-selection.md`。
3. stub worker（e2e/演示用）不识别新 lab 交付物 → 已在 `services/agent_gateway/app.py` 增加
   PRD / architecture / index.html(高保真) / API_Spec+DB_Schema / theory-map 五个分支。
4. e2e 三处硬断言（media 标题、local-prep 标题、lab 文件名链）→ 已同步更新。

## 已知问题与后续建议（按优先级）

1. **「」用法过载（9 节）**：作者把「术语引用」与「重点加高」混用，单节 9–12 处。
   建议：录制视频时由讲师从中选 3–6 处真正加高；或在 v0.7.1 将术语引用改为《》/直排。
2. **Day 2 四层 vs 五层措辞张力**：课件讲「四层」口诀，Architect 提示词分层图含独立「业务层」（五层）。
   已在「常见懵点」缓冲；建议 v0.7.1 统一口径为「四层 + 业务规则住接口层」。
3. **Day 3 第 2 节信息密度偏高**：四件套一口气报出，纯音频记不住；录视频时建议配四件套对照图。
   已有 `Design_Spec_Template.md` 填空任务兜底。
4. **Day 4 日级 quiz 分布**：第 1 节占 2 题、REST 原则未进日级题；建议把第 2 题换成 REST 辨认题。
5. **Day 5 设计模式实例性弱**：观察者/策略/工厂在前四天交付物中无可运行代码可指认；
   待 Day 3/4 产物升级为可运行代码后可加强。
6. **Day 6–10 仍是 v0.6 驾驶舱线**：与角色周的叙事衔接（Day 5 → Day 6）存在跳变，
   Week 2 重设计时需对齐蓝本。
7. **旧 v0.6 课件归档不完整**：Day 2/3 的旧 section 在撰写过程中被误删且 class/ 未被 git 跟踪，
   残留件已收入 `backups/2026-07-25-pre-v06/class-bootcamp-v06/`；Day 1/4/5 旧节完整归档。
   建议：将 `class/` 纳入 git 管理，防止再次丢失。

## 验证记录

- `scripts/build_v07_week1_contracts.py`：5 天合约全部生成成功。
- orchestrator `_load_day_yaml` + `_validate_day`：5/5 通过。
- dev 库 seed：active offering（camp-v03/fde-v06）day 1–5 标题已更新为新课程。
- API 冒烟：`GET /api/v1/camps/camp-v03/days` 返回新标题列表。
- stub 工作器端到端：Day1 lab 生成 PRD.md 三件套、rubric 评测 3/3 通过（API 实测）。
- 学员端渲染：无 media 胶囊自动隐藏视频步；口播稿经 CapsuleProse 渲染，【段落小标】成小标题。
- e2e（Chromium，对本地全栈）：learner-media ✅ · learner-local-prep ✅ ·
  learner-agent-lab ✅（6.5m，demo 工作区臃肿致快照慢，超时已放宽至 300s）·
  learner-day1-full-chain ✅（2.4m，新学员全链路 Day1→Day2 解锁 + Day2 继承 PRD.md 断言）·
  learner-coach ✅ · learner-lab-rubric-loop ✅（改为删 PRD.md 触发未通过）·
  learner-login-day1 ✅ · learner-task-home ✅ · learner-learning-stats ✅。
  - learner-sim-lab：v0.7 后无 sim-runner 课日，已 test.skip（待新课程重新引入 sim lab）。
  - learner-k8s-lab（Day13）：day-13 合约在本任务前已删除，预存失败，不在本评估范围。
- 单测：160 passed；4 failed（test_certificates 等 verified_at 列缺失），
  经 stash 对照验证为预存失败，与本改动无关。
