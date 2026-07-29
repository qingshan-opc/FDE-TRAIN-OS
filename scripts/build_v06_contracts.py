#!/usr/bin/env python3
"""v0.6 课程契约生成器：class/bootcamp/ → contracts/examples/day-NN-curriculum.yaml

从训练营课件包（每天 README + 每节 lesson/practice）自动抽取：
- 章节地图（标题/分钟/形式）→ learn.capsules
- 每节 🎬 口播稿 → capsule.content
- 每节 practice.md 完成标志 → capsule.practice
- README 今日验收（GATE N）→ review_checklist

手工数据（本文件 DAYS 表）：quiz 选择题、lab 任务与 rubric、project_brief、nodes。
用法：python3 scripts/build_v06_contracts.py
"""

from __future__ import annotations

import re
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]
BC = ROOT / "class" / "bootcamp"
OUT = ROOT / "contracts" / "examples"

DIRECTIONS = {
    "default": "ops",
    "packs": [
        {"id": "ops", "name": "运营", "metrics": ["今日订单量", "转化率", "异常工单数", "按时交付率"],
         "table_fields": ["工单号", "负责人", "状态", "逾期天数"]},
        {"id": "fin", "name": "财务", "metrics": ["本月回款率", "费用执行率", "超支部门数"],
         "table_fields": ["单据号", "部门", "金额", "状态"]},
        {"id": "hr", "name": "HR", "metrics": ["在招职位数", "本周面试数", "到岗率", "简历转化率"],
         "table_fields": ["候选人", "职位", "轮次", "状态"]},
        {"id": "sales", "name": "销售", "metrics": ["新增线索", "在跟商机金额", "赢单率", "逾期跟进数"],
         "table_fields": ["客户", "商机金额", "阶段", "负责人"]},
    ],
}

# ---------------------------------------------------------------- 手工数据
# quiz: (题干, [选项], 正确序号 0-based, 解析)
# lab: title / primary_files / prompt / rubric
DAYS: dict[int, dict] = {
    1: {
        "brief": "世界观快通 + 第一次动手：演进线与生态图两张图看懂时代（概念只占 40′），"
                 "Agent Lab 五步闭环导师演一遍、学员跟一遍，下课前交出方向卡（3 个可数据化问题）"
                 "与 V0.1 五区块线框 + Prompt 草稿。完整世界观在公开课 O1–O4，快测 6 题就是免修考试。",
        "quiz": [
            ("六次技术浪潮的共同规律是？",
             ["每次都让程序员更贵", "每次都重排「谁值钱」", "每次都淘汰数据库"], 1,
             "价值重排：写的能力贬值、判断与验收升值——这门课站在 AI 原生浪潮上。"),
            ("把 GPT / Ollama / MCP / 你的驾驶舱按生态四层归类，正确的是？",
             ["模型层 / 平台层 / 协议工具层 / 应用层", "全是应用层", "全是模型层"], 0,
             "四层各就各位：出了教室看任何行业文章都拆得开。"),
            ("「幻觉是机制不是 bug」意味着？",
             ["模型坏了，等厂商修", "它永远给「最像真的」而非「经核实」的答案，系统要自己兜底", "多问几次就会消失"], 1,
             "所以摘要要 Rubric 验收、关键步骤要人工确认闸。"),
            ("AI 模型层为什么不产生业务数据？",
             ["模型算不动", "模型附着在前三层上，业务数据只能来自接口与数据库", "模型只负责前端"], 1,
             "四层地图：前端看、接口传、数据库存、模型想。"),
            ("五步闭环的正确顺序是？",
             ["生成 → Prompt → 验收 → 需求 → 迭代", "需求(Prompt) → 生成 → 验收(预览/评测) → 迭代 → 完成", "完成 → 生成 → Prompt"], 1,
             "Agent Lab 的主路径；验收不过意味着改 Prompt 再来，不是手改产物。"),
            ("什么样的业务问题适合写进方向卡？",
             ["越宏大越好", "可数据化、有数据来源、有决策用途", "老板随口提到的都算"], 1,
             "方向卡三要素缺一不可——Day 2 的指标卡就从这里长出来。"),
        ],
        "lab": {
            "title": "方向卡 + V0.1 五区块线框",
            "primary_files": ["direction-card.md", "wireframe.md"],
            "prompt": "你是学员的需求整理助手。背景：FDE 训练营 Day 1，学员要完成方向卡与驾驶舱线框。\n"
                      "任务：通过提问帮学员在工作区生成两个文件——\n"
                      "1. direction-card.md：选定方向（运营/财务/HR/销售）+ 一句话价值主张 + 3 个业务问题，"
                      "每个问题必须可数据化、注明数据来源与决策用途；\n"
                      "2. wireframe.md：驾驶舱五区块线框（标题区/指标卡区/趋势图区/明细表区/AI 摘要占位区），"
                      "每区块标注「回答哪个问题编号 + 什么字段 + 三态怎么显示」，并附一段四要素 Prompt 草稿"
                      "（角色/任务/约束/格式，约束逐条对应五区块）。\n"
                      "要求：先问 3 个澄清问题再动笔；不替学员编造业务问题，只引导与排版。",
            "rubric": [
                {"check": "file_exists", "args": {"path": "direction-card.md"}},
                {"check": "file_exists", "args": {"path": "wireframe.md"}},
                {"check": "text_contains", "args": {"path": "direction-card.md", "needle": "业务问题"}},
                {"check": "text_contains", "args": {"path": "wireframe.md", "needle": "指标卡"}},
                {"check": "text_contains", "args": {"path": "wireframe.md", "needle": "三态"}},
            ],
        },
        "nodes_lab": "方向卡与线框（Day 2 的瞄准镜）",
    },
    2: {
        "brief": "第一天动手：不追框架、不追炫技——用原生单页把五区块骨架立起来。"
                 "信息架构（每个指标回答一个业务问题）+ 约束驱动选型两件方法论武器，"
                 "然后第一次独立走完「线框 → Prompt → 生成 → 验收」五步闭环，"
                 "V0.1 页面能开、三态占位、第一个 commit。",
        "quiz": [
            ("信息架构的第一原则是？",
             ["指标越多越好", "每个指标必须能回答方向卡里的一个业务问题", "图表越炫越好"], 1,
             "回答不了业务问题的指标是装饰品。"),
            ("V0.1 为什么用原生单页而不是 React？",
             ["React 过时了", "约束驱动：当天交付、无构建链、可单文件打开——约束变结论可变", "原生更快"], 1,
             "没有最好的技术，只有最匹配约束的技术。"),
            ("预览发现明细表少了一列，最佳处理是？",
             ["直接手改 index.html 加一列", "在 Prompt 约束里补上该列，重新生成", "不管它，明天再说"], 1,
             "V0.1 阶段 Prompt 就是源码；手改的活后续迭代留不住。"),
            ("前端「三态」指什么？",
             ["首页/列表页/详情页", "加载中 / 暂无数据 / 加载失败", "桌面/平板/手机"], 1,
             "三态先占位，Day 3 接电后全部变真。"),
            ("线框在生成流程中的作用是？",
             ["美术稿，好看就行", "瞄准镜：线框质量 = Prompt 质量 = V0.1 质量", "给导师检查的作业"], 1,
             "每区块标注回答哪问、什么字段、三态怎么显示。"),
        ],
        "lab": {
            "title": "Agent 生成驾驶舱前端 V0.1",
            "primary_files": ["index.html", "README.md"],
            "prompt": "你是前端工程师。背景：FDE 训练营 Week1 Day 2，部门 AI 驾驶舱项目（学员方向见 direction-card.md）。\n"
                      "任务：在工作区生成可直接浏览器打开的单页 index.html——部门驾驶舱前端 V0.1。\n"
                      "要求：标题区（部门名 + 「驾驶舱」字样 + 日期）；指标卡区 ≥3 张卡片（取自学员方向卡）；"
                      "趋势图区（近 7 天模拟数据，纯 CSS/文字占位即可）；明细表区 <table> ≥4 列 ≥3 行模拟数据，"
                      "其中 1 行异常并有视觉高亮；AI 摘要区独立占位区块；至少一处「加载中/暂无数据/加载失败」三态文字占位；"
                      "单文件自包含（内联 CSS/JS），声明 UTF-8，不引入构建工具与外部框架；全部模拟数据；"
                      "另生成 README.md 三行（是什么 / 到哪版 V0.1 / 怎么打开）。完成后列出文件路径。",
            "rubric": [
                {"check": "file_exists", "args": {"path": "index.html"}},
                {"check": "text_contains", "args": {"path": "index.html", "needle": "驾驶舱"}},
                {"check": "text_contains", "args": {"path": "index.html", "needle": "<table"}},
                {"check": "text_contains", "args": {"path": "index.html", "needle": "摘要"}},
                {"check": "text_contains", "args": {"path": "index.html", "needle": "加载"}},
            ],
        },
        "nodes_lab": "Agent 生成驾驶舱前端 V0.1",
    },
    3: {
        "brief": "前端和后端唯一的对话方式是契约。今天定契约、生接口、把页面上的模拟数据换成真的："
                 "JSON 与状态码是看得懂的报错语言，FastAPI 解剖（路径/方法/参数/响应模型），"
                 "三态第一次面对真实世界——错误态必须可演示。",
        "quiz": [
            ("前端和后端唯一的对话方式是？",
             ["心灵感应", "契约——接口文档先于实现", "直接读对方代码"], 1,
             "契约先于实现；改契约的代价是前后端一起动。"),
            ("404 和 500 分别意味着？",
             ["都是服务器的锅", "404 请求的资源不存在（客户端侧），500 服务端内部错误", "都是网络问题"], 1,
             "状态码是看得懂的报错语言：先分清是谁的锅。"),
            ("页面接电后出现错误态，正确做法是？",
             ["白屏等用户刷新", "显示可理解的错误信息并保留重试入口", "隐藏该区块"], 1,
             "三态变真：错误态也是产品的一部分。"),
            ("FastAPI 中响应模型（response model）的作用是？",
             ["装饰代码", "约束输出结构——契约的机器可执行部分", "加速接口"], 1,
             "路径、方法、参数、响应模型四件共同构成契约。"),
            ("为什么说「改契约的代价大」？",
             ["改文档麻烦", "契约是前后端双方的承诺，一动两端都要跟着动", "要重启服务器"], 1,
             "所以契约要先行、要评审、要版本化。"),
        ],
        "lab": {
            "title": "生成 FastAPI 接口并让页面接电",
            "primary_files": ["main.py", "index.html"],
            "prompt": "你是后端工程师。背景：FDE 训练营 Day 3，驾驶舱已有 V0.1 前端（index.html，模拟数据写在页面里）。\n"
                      "任务：1. 按学员的契约草稿生成 FastAPI 服务 main.py，提供 /api/metrics（指标卡数据）"
                      "与 /api/details（明细表数据）两个 GET 接口，返回 JSON，带响应模型；"
                      "2. 改造 index.html：页面加载时用 fetch 从这两个接口取数渲染，模拟数据移到后端；"
                      "3. 补齐三态：加载中显示提示、接口失败显示可理解的错误信息与重试按钮、空数据显示「暂无数据」。\n"
                      "要求：接口可 `uvicorn main:app --reload` 启动；不改字段名除非契约同步更新；完成后自测两个接口并列出 curl 结果。",
            "rubric": [
                {"check": "file_exists", "args": {"path": "main.py"}},
                {"check": "text_contains", "args": {"path": "main.py", "needle": "/api/metrics"}},
                {"check": "text_contains", "args": {"path": "main.py", "needle": "FastAPI"}},
                {"check": "text_contains", "args": {"path": "index.html", "needle": "fetch"}},
            ],
        },
        "nodes_lab": "契约先行：FastAPI 接口 + 页面接电",
    },
    4: {
        "brief": "重启就丢的数据不算数据。今天搞懂表、行、主键，SQL 看懂四板斧即可；"
                 "让 AI 写 DDL、你来审（字段/类型/约束），然后接口读写改走数据库——重启不丢，才算有家。"
                 "换库时机（SQLite → PostgreSQL）讲判断标准，不讲运维细节。",
        "quiz": [
            ("「重启就丢的数据不算数据」说明数据库的核心价值是？",
             ["查询快", "持久化——数据有个家", "界面好看"], 1,
             "内存与文件是临时住所，数据库才是家。"),
            ("主键的作用是？",
             ["让表更好看", "唯一标识一行，增删改查的锚点", "加密数据"], 1,
             "没有主键的表，连「改哪一行」都说不清。"),
            ("SQL 四板斧是？",
             ["SELECT / INSERT / UPDATE / DELETE", "GET / POST / PUT / DELETE", "CREATE / DROP / ALTER / GRANT"], 0,
             "本课要求会读——会读比会写重要。"),
            ("什么时候该从 SQLite 换 PostgreSQL？",
             ["第一天就上 PG", "多人并发、数据量增长、正式部署需要时", "永远不用换"], 1,
             "换库是时机判断，不是信仰。"),
            ("让 AI 写 DDL 建表时，你的职责是？",
             ["复制粘贴直接执行", "审字段、类型、约束——AI 写，你验收", "写个大概让 AI 猜"], 1,
             "生成贬值、判断升值的典型场景。"),
        ],
        "lab": {
            "title": "DDL 建表 + 接口持久化",
            "primary_files": ["schema.sql", "main.py"],
            "prompt": "你是数据库工程师。背景：FDE 训练营 Day 4，驾驶舱接口（main.py）目前用内存/文件存模拟数据。\n"
                      "任务：1. 生成 schema.sql——按学员方向的指标与明细字段设计 ≥2 张表（含主键、合适类型、必要约束），"
                      "并插入 ≥3 行模拟数据（明细含 1 行异常）；2. 改造 main.py：/api/metrics 与 /api/details 改从 SQLite 读写；"
                      "3. 在 README.md 追加「重启验证」步骤。\n"
                      "要求：数据库文件 cockpit.db 放工作区根目录；执行 schema.sql 可重复（IF NOT EXISTS）；"
                      "改完后用 curl 验证接口返回来自数据库的数据。",
            "rubric": [
                {"check": "file_exists", "args": {"path": "schema.sql"}},
                {"check": "text_contains", "args": {"path": "schema.sql", "needle": "CREATE TABLE"}},
                {"check": "text_contains", "args": {"path": "schema.sql", "needle": "PRIMARY KEY"}},
                {"check": "text_contains", "args": {"path": "main.py", "needle": "sqlite"}},
            ],
        },
        "nodes_lab": "数据入库：重启不丢才算有家",
    },
    5: {
        "brief": "回到 Day 1 的生态图——网关后面能换什么模型，今天有体感。摘要接口上线："
                 "密钥/超时/降级三件套（AI 挂了页面不能挂），Prompt 工程进阶（上下文工程第一课：放什么、放多少），"
                 "并学会 AI 输出的验收法：Rubric，而不是「我觉得还行」。",
        "quiz": [
            ("在本课架构里，换模型等于？",
             ["重写整个后端", "换网关后面的牌子——业务代码不动", "换一家云厂商"], 1,
             "接入层与业务层分离：这就是 Day 1 生态图的实战兑现。"),
            ("「AI 挂了，页面不能挂」对应的设计是？",
             ["多刷新几次", "超时 + 降级：模型超时/失败时给出写死的兜底摘要", "把摘要区删掉"], 1,
             "密钥/超时/降级是 LLM 接入三件套。"),
            ("API 密钥应该怎么管理？",
             ["写进 index.html 注释里", "环境变量，不进代码、不进 Git", "发给同事共享"], 1,
             "密钥泄露是最高频的新手事故。"),
            ("AI 输出的正确验收方式是？",
             ["我觉得还行", "Rubric：准确性 / 完整性 / 可读性逐项打分", "字数够长就行"], 1,
             "Eval 思维：固定标准代替感觉。"),
            ("上下文工程第一课是？",
             ["把所有数据都塞给模型", "决定放什么、放多少进模型视野——给少了瞎编，给多了迷失", "买更大的模型"], 1,
             "Context Engineering 是 Week 2 的主线之一。"),
        ],
        "lab": {
            "title": "摘要接口 + 驾驶舱 AI 摘要区接电",
            "primary_files": ["main.py", "index.html"],
            "prompt": "你是 AI 应用工程师。背景：FDE 训练营 Day 5，驾驶舱已有真实接口与数据库，"
                      "页面上留有「AI 摘要区」占位。\n"
                      "任务：1. main.py 新增 /api/summary：从数据库取当日指标，组装 Prompt 调用模型网关"
                      "（base_url 与 api_key 一律读环境变量），返回三段式摘要（发生了什么/为什么/建议）；"
                      "2. 加超时（≤15s）与降级：调用失败或超时返回写死的兜底摘要并标注「降级模式」；"
                      "3. index.html 摘要区接电：加载/错误/空三态齐全。\n"
                      "要求：密钥不出现在任何代码与提交里；断网演练一次降级路径并在 README.md 记录结果。",
            "rubric": [
                {"check": "text_contains", "args": {"path": "main.py", "needle": "/api/summary"}},
                {"check": "text_contains", "args": {"path": "main.py", "needle": "timeout"}},
                {"check": "text_contains", "args": {"path": "main.py", "needle": "os.environ"}},
                {"check": "text_contains", "args": {"path": "index.html", "needle": "摘要"}},
            ],
        },
        "nodes_lab": "给驾驶舱装上大脑：摘要接口上线",
    },
    6: {
        "brief": "在自己电脑上跑不算上线。今天搞懂部署、环境、容器的最小概念（为什么「在我机器上是好的」不算数），"
                 "走完十条集成测试清单，把 V1.0 发出去——换台设备也能开。Week 1 收官："
                 "回查词典与讲解图，带着问题进 Week 2。",
        "quiz": [
            ("「在我机器上是好的」为什么不算上线？",
             ["你的机器太旧", "环境差异——依赖、配置、数据在别的机器上可能完全不同", "别人不懂欣赏"], 1,
             "容器与环境分离解决的就是可复制性。"),
            ("部署的最小定义是？",
             ["买云服务器", "从 localhost 到任何人可访问", "注册域名"], 1,
             "V1.0 的验收标准：换台设备也能开。"),
            ("密钥不进代码、开发/生产配置分离，属于哪条原则？",
             ["好看原则", "环境与配置分离", "性能优化"], 1,
             "Twelve-Factor 的基本功。"),
            ("集成测试清单的作用是？",
             ["走形式", "发布前的最后闸：十条链路全绿才准发", "给导师交差"], 1,
             "不过当天补，不拖进明天。"),
            ("Week 1 复盘的核心动作是？",
             ["庆祝完就翻篇", "回查词典与讲解图，把还懵的概念列出来带进 Week 2", "重写一遍项目"], 1,
             "复盘不是总结会，是带着问题进下一周。"),
        ],
        "lab": {
            "title": "部署 V1.0 + 集成测试清单",
            "primary_files": ["checklist.md", "deploy.md"],
            "prompt": "你是交付工程师。背景：FDE 训练营 Day 6，驾驶舱 V1.0 功能齐（前端/接口/数据库/AI 摘要）。\n"
                      "任务：1. 生成 checklist.md——十条集成测试清单（页面能开/接口 200/数据来自库/摘要正常/"
                      "降级可演示/三态可见/换设备可访问等），逐条留出实测记录位；"
                      "2. 生成 deploy.md——本项目的部署说明：依赖安装、环境变量清单（不含真实密钥）、"
                      "启动命令、换设备访问方法（局域网/隧道二选一）；"
                      "3. 如有条件生成 Dockerfile 或等效一键启动脚本。\n"
                      "要求：清单每条必须可勾选、可证据化；部署说明给到「照做能跑」的颗粒度。",
            "rubric": [
                {"check": "file_exists", "args": {"path": "checklist.md"}},
                {"check": "file_exists", "args": {"path": "deploy.md"}},
                {"check": "text_contains", "args": {"path": "deploy.md", "needle": "环境变量"}},
                {"check": "text_contains", "args": {"path": "checklist.md", "needle": "换设备"}},
            ],
        },
        "nodes_lab": "V1.0 发布：换设备也能开",
    },
    7: {
        "brief": "系统只能看，能力才能用。今天把你周报里最重复的那项工作封装成第一个 Skill："
                 "输入、步骤、输出、证据一个都不能少；工具描述写得好，Agent 才选得对。"
                 "选哪项工作先封装？高频、规则清晰、可验收——三选标准。",
        "quiz": [
            ("系统和能力的区别是？",
             ["没区别，叫法不同", "系统回答「发生了什么」，Skill 回答「接下来做什么」", "能力更贵"], 1,
             "驾驶舱是系统，Skill 是能力——Week 2 的主线。"),
            ("Skill 说明书的必备部件是？",
             ["名字好听就行", "输入 / 步骤 / 输出 / 证据", "越厚越好"], 1,
             "四部件一个不能少，证据是可检查的产物。"),
            ("哪项工作最适合先封装成 Skill？",
             ["最难的那项", "高频、规则清晰、可验收的那项", "老板最喜欢的那项"], 1,
             "三选标准同时满足，第一个 Skill 才容易跑出证据。"),
            ("工具描述（何时用/何时不用）为什么重要？",
             ["凑字数", "描述决定 Agent 选不选得对这件工具", "给人类看着玩"], 1,
             "Day 8 的「选错图谱」就靠在描述里写清边界。"),
            ("Skill 跑完必须留下什么？",
             ["好印象", "可检查的证据（产物 + 运行记录）", "聊天记录"], 1,
             "没有证据的运行等于没跑。"),
        ],
        "lab": {
            "title": "封装第一个 Skill 并跑出证据",
            "primary_files": ["skills/skill-01.md", "runs/"],
            "prompt": "你是 Skill 架构师。背景：FDE 训练营 Day 7，学员选定了一项高频、规则清晰、可验收的部门工作。\n"
                      "任务：在工作区生成 skills/skill-01.md——第一个 Skill 说明书，"
                      "含四部件（输入：字段与来源 / 步骤：可执行的操作序列 / 输出：产物格式与存放路径 / 证据：如何检查）"
                      "+ 工具描述（一句话干什么、何时用、何时不用）；然后用该 Skill 真实执行一次，"
                      "产物与运行记录写入 runs/ 目录。\n"
                      "要求：步骤必须具体到可照做；输出路径写死；证据必须第三方可查（文件/日志，不是口头）。",
            "rubric": [
                {"check": "file_exists", "args": {"path": "skills/skill-01.md"}},
                {"check": "text_contains", "args": {"path": "skills/skill-01.md", "needle": "输入"}},
                {"check": "text_contains", "args": {"path": "skills/skill-01.md", "needle": "输出"}},
                {"check": "text_contains", "args": {"path": "skills/skill-01.md", "needle": "何时用"}},
            ],
        },
        "nodes_lab": "第一个 Skill：跑出可检查的证据",
    },
    8: {
        "brief": "能跑不等于可依赖。上午给 Skill 加边界与异常：边界声明就是护栏，"
                 "故意喂坏输入，它必须按声明的方式失败；下午揭开 Agent 的底牌——模型之外那副叫 Harness 的骨架"
                 "（工具表/记忆/规划/重试/日志），并让 Agent 正确调用你的 Skill。",
        "quiz": [
            ("Harness 是？",
             ["一个更大的模型", "模型之外让 Agent 跑起来的循环：工具表/记忆/规划/重试/日志", "一种编程语言"], 1,
             "同一模型换副骨架，能力天差地别。"),
            ("workflow 和 agent 的选择原则是？",
             ["永远上 agent，显得高级", "能写死用 workflow，写不死才上 agent", "抓阄"], 1,
             "agent 的自由度是用不确定性和成本换来的。"),
            ("Skill 边界声明的作用是？",
             ["免责声明", "护栏：异常时按声明的方式失败，而不是乱来", "凑文档厚度"], 1,
             "Guardrails 的朴素版。"),
            ("异常注入测试的做法是？",
             ["等线上出事再说", "故意喂坏输入（空数据/错格式/越界请求），验证按声明失败", "只测正常输入"], 1,
             "体面失败学：失败方式是被设计出来的。"),
            ("Agent 什么时候会选错 Skill？",
             ["模型心情不好时", "工具描述重叠、模糊、缺「何时不用」时", "永远不会错"], 1,
             "选错图谱：描述写得越清，第 1 步「理解任务」越不跑偏。"),
        ],
        "lab": {
            "title": "Skill v1 边界加固 + Agent 调用实测",
            "primary_files": ["skills/skill-01.md", "agent-run-log.md"],
            "prompt": "你是可靠性工程师。背景：FDE 训练营 Day 8，第一个 Skill（skills/skill-01.md）已能跑。\n"
                      "任务：1. 升级 Skill 到 v1——补边界声明（不做什么/异常分类与处置/何时求助人类）；"
                      "2. 设计 ≥3 条异常注入用例（空数据/错格式/越界请求），逐条执行并把结果记入 agent-run-log.md；"
                      "3. 用自然语言给 Agent 派一个匹配任务和一个故意不匹配的任务，记录它的工具选择，"
                      "分析「它什么时候会选错」写进日志。\n"
                      "要求：坏输入必须按声明的方式失败——任何「硬扛乱做」都要回炉改边界。",
            "rubric": [
                {"check": "text_contains", "args": {"path": "skills/skill-01.md", "needle": "边界"}},
                {"check": "file_exists", "args": {"path": "agent-run-log.md"}},
                {"check": "text_contains", "args": {"path": "agent-run-log.md", "needle": "注入"}},
                {"check": "text_contains", "args": {"path": "agent-run-log.md", "needle": "选错"}},
            ],
        },
        "nodes_lab": "异常注入 + Agent 选得对不对",
    },
    9: {
        "brief": "一个 Skill 是工具，多个 Skill 编成流程才是同事。工具表从 1 件变 3 件，"
                 "串成一条带人工确认闸的流水线：确认闸三问（看什么/谁来看/多久看一次），"
                 "执行日志三要素（时间/动作/结果）——确认点 + 日志 = 信任的工程设计。",
        "quiz": [
            ("确认闸三问是？",
             ["谁开发的/多少钱/快不快", "看什么 / 谁来看 / 多久看一次", "早上看/中午看/晚上看"], 1,
             "看什么＝决策所需最低信息；谁来看＝有责的人；多久看一次＝信任分级。"),
            ("确认界面必须提供什么？",
             ["一句「发送吗？」", "决策所需的最低信息：草稿 + 关键数字 + 风险标红", "全部原始日志"], 1,
             "信息不足逼人盲批——闸的第一种死法。"),
            ("执行日志三要素是？",
             ["时间 / 动作 / 结果", "谁 / 什么 / 为什么", "开始 / 结束 / 耗时"], 0,
             "出事故时回答三个问题：什么时候、谁干的、干成了什么。"),
            ("确认闸应该放在哪类步骤之前？",
             ["每一步都放", "不可撤回的步骤（对外发送/改数据/花钱）", "最快的步骤"], 1,
             "可撤回的自动连跑，比例通常是 5 步 1 闸。"),
            ("信任分级的含义是？",
             ["永远每次都看", "连续通过攒额度：从每次看降到抽看 + 定期审计", "完全放手不管"], 1,
             "信任不是感觉，是工程设计；抽看必须配审计。"),
        ],
        "lab": {
            "title": "三 Skill 编排：确认闸 + 执行日志",
            "primary_files": ["docs/orchestration.md", "runs/"],
            "prompt": "你是流程工程师。背景：FDE 训练营 Day 9，学员已有 3 件 Skill（skills/ 目录）。\n"
                      "任务：1. 生成 docs/orchestration.md——编排文档：步骤定死的串联图（A→B→C）、"
                      "数据流（谁的输出是谁的输入）、确认闸位置（必须在不可撤回步骤之前）、闸设计卡（三问）、日志格式；"
                      "2. 按文档把流水线真实跑一遍：A 跑 → B 产出确认界面（草稿+关键数字+风险标红）→ 停 → "
                      "人批准 → C 执行；再跑一次驳回路径（打回 B 重做、版本+1、留痕）；"
                      "3. 每步执行后向 runs/ 追加日志行（时间|步骤|结果）。\n"
                      "要求：不批准绝不执行 C；驳回必须能退回重做且留记录；日志可独立回放当天经过。",
            "rubric": [
                {"check": "file_exists", "args": {"path": "docs/orchestration.md"}},
                {"check": "text_contains", "args": {"path": "docs/orchestration.md", "needle": "确认闸"}},
                {"check": "text_contains", "args": {"path": "docs/orchestration.md", "needle": "日志"}},
            ],
        },
        "nodes_lab": "流水线施工：拦得住、回得来、查得了",
    },
    10: {
        "brief": "V2.0 收官：Agent 接入驾驶舱助手位（能唤起、看得见状态、踩得到刹车），"
                 "十条能力证据逐条自证，8 分钟答辩（作品 3′ + 架构 3′ + 迭代故事 2′），"
                 "最后画一张自己的行业地图 + 90 天自学路线。答辩通过的那一刻，你就是 FDE。",
        "quiz": [
            ("驾驶舱 AI 助手位的三要件是？",
             ["头像/昵称/表情包", "唤起 / 状态可见 / 闸在页内", "聊天/语音/视频"], 1,
             "助手位是驾驶位不是聊天框——优先级：闸 > 状态 > 唤起。"),
            ("十条能力证据的核心思想是？",
             ["证明自己很努力", "能力不是说出来的，是拿出来的——每条都要有文件或演示支撑", "凑够十条就行"], 1,
             "答辩不是讲情怀，是拿证据。"),
            ("答辩 3+3+2 结构指？",
             ["3 分钟寒暄 + 3 分钟演示 + 2 分钟问答", "作品 3′ + 架构 3′ + 迭代故事 2′", "3 页 PPT + 3 张图 + 2 个视频"], 1,
             "讲好一个失败，比讲好十个成功更像工程师。"),
            ("答辩演示中途系统挂了，正确处理是？",
             ["慌神道歉下台", "启用兜底：指着昨日成功运行日志讲——处理事故的方式也计分", "说网络不好跳过演示"], 1,
             "日志能回放，事故就变成了第九条证据的现场版。"),
            ("诚实声明的三件套是？",
             ["不好意思/下次一定/谢谢老师", "程度 + 差距 + 下一步", "我不知道/没学过/没做过"], 1,
             "「我知道我哪里弱」本身就是第十一条证据。"),
        ],
        "lab": {
            "title": "Agent 接入驾驶舱 + 毕业复盘",
            "primary_files": ["docs/final-review.md", "docs/defense-outline.md"],
            "prompt": "你是收官日教练。背景：FDE 训练营 Day 10，学员要完成 V2.0 接入与毕业复盘。\n"
                      "任务：1. 协助把 Agent 接入驾驶舱助手位——三要件按优先级施工（闸在页内 > 状态可见 > 唤起），"
                      "接不通真实环境时采用指令面板降级并写书面权衡；"
                      "2. 生成 docs/defense-outline.md——答辩提纲一页纸（作品演示路径/架构讲解三点/迭代故事五要素/诚实声明）；"
                      "3. 生成 docs/final-review.md——两周复盘：三对「我以为→我知道」、行业地图自评（五档 ✓/△/✗ 带证据链接）、"
                      "90 天路线（可衡量目标 + 30/60/90 里程碑 + 本周第一个动作）。\n"
                      "要求：拒绝空话；每条自评都要挂得上证据路径。",
            "rubric": [
                {"check": "file_exists", "args": {"path": "docs/final-review.md"}},
                {"check": "text_contains", "args": {"path": "docs/final-review.md", "needle": "90 天"}},
                {"check": "text_contains", "args": {"path": "docs/final-review.md", "needle": "我以为"}},
            ],
        },
        "nodes_lab": "V2.0 接入 + 答辩提纲与毕业复盘",
    },
}

WEEK_OF = {1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 2, 8: 2, 9: 2, 10: 2}

# ------------------------------------------------------- Day 1 精读配置
# 资源池（url 均可点击）：/docs/ 前缀 = 系统内图文阅读页；/course-assets/ = 直开图或下载；http = 外链
DAY1_RESOURCES = [
    {"id": "kg-day1", "title": "Day 1 知识图谱", "kind": "diagram",
     "summary": "六节概念串成一张图：浪潮 → 生态 → 四层 → 闭环 → 方向卡",
     "url": "/course-assets/assets/diagrams/knowledge-graph-day1.svg"},
    {"id": "dg-evolution", "title": "讲解图 · 技术演进时间线", "kind": "diagram",
     "summary": "六次浪潮，每次重排「谁值钱」", "url": "/course-assets/assets/diagrams/evolution-timeline.svg"},
    {"id": "dg-ecosystem", "title": "讲解图 · LLM 生态分层", "kind": "diagram",
     "summary": "模型 / 平台 / 协议工具 / 应用——你在哪一层", "url": "/course-assets/assets/diagrams/llm-ecosystem.svg"},
    {"id": "dg-four-layer", "title": "讲解图 · 应用四层架构", "kind": "diagram",
     "summary": "前端 / 接口 / 数据库 / 模型，同一艘驾驶舱逐层接电", "url": "/course-assets/assets/diagrams/four-layer.svg"},
    {"id": "dg-ten-day", "title": "讲解图 · 十天演进", "kind": "diagram",
     "summary": "每天接电一层，从 V0.1 到 V2.0", "url": "/course-assets/assets/diagrams/ten-day-grid.svg"},
    {"id": "open-o1", "title": "公开课 O1 · 时代与演进", "kind": "doc",
     "summary": "世界观完整版：六次浪潮与职业价值重排（快测考点）", "url": "/docs/open-course/o1-era.md"},
    {"id": "open-o2", "title": "公开课 O2 · LLM 与编排深化", "kind": "doc",
     "summary": "能力边界、幻觉机制、workflow vs agent（快测考点）", "url": "/docs/open-course/o2-llm.md"},
    {"id": "open-o3", "title": "公开课 O3 · 生态与基建", "kind": "doc",
     "summary": "模型层到应用层的完整生态地图（快测考点）", "url": "/docs/open-course/o3-ecosystem.md"},
    {"id": "open-o4", "title": "公开课 O4 · 新概念词典", "kind": "doc",
     "summary": "18+ 行业词随身查（快测考点）", "url": "/docs/open-course/o4-glossary.md"},
    {"id": "glossary", "title": "新概念词典（速查版）", "kind": "doc",
     "summary": "三行一词：定义 / 哪天遇到 / 延伸阅读", "url": "/docs/resources/glossary.md"},
    {"id": "reading-list", "title": "技术演进与生态阅读清单", "kind": "doc",
     "summary": "按「下一站」选读：30 分钟 / 半天 / 一个周末", "url": "/docs/resources/reading-list.md"},
    {"id": "cheatsheet-prompt", "title": "Prompt 工程速查卡", "kind": "doc",
     "summary": "四要素模板 + 迭代口诀 + 翻车现场", "url": "/docs/resources/cheatsheet-prompt.md"},
    {"id": "cheatsheet-four-layer", "title": "四层架构速查卡", "kind": "doc",
     "summary": "每层「是什么 / 为什么 / 怎么选 / 挂了什么症状」", "url": "/docs/resources/cheatsheet-four-layer.md"},
    {"id": "schedule-site", "title": "课程全景网站（课表/图集/公开课索引）", "kind": "site",
     "summary": "整门课的可视化总览，汇报与自学两相宜", "url": "/course-assets/schedule/index.html"},
    {"id": "tpl-direction-card", "title": "模板下载 · 方向卡", "kind": "download",
     "summary": "3 个可数据化问题的填写模板", "url": "/course-assets/resources/templates/direction-card.md"},
    {"id": "tpl-wireframe", "title": "模板下载 · 五区块线框", "kind": "download",
     "summary": "线框 + 字段 + 三态 + Prompt 草稿模板", "url": "/course-assets/resources/templates/wireframe.md"},
    {"id": "ext-3b1b", "title": "外链 · 3Blue1Brown《But what is a GPT?》", "kind": "link",
     "summary": "目前最好的 LLM 直觉化解释（25′）", "url": "https://www.youtube.com/watch?v=LPZh9BOjkQs"},
    {"id": "ext-karpathy", "title": "外链 · Karpathy《Intro to LLMs》", "kind": "link",
     "summary": "一小时建立大模型全局观，看前 30 分钟即可", "url": "https://www.youtube.com/watch?v=zjkBMFhNj_g"},
    {"id": "ext-arena", "title": "外链 · LMArena 模型盲测榜", "kind": "link",
     "summary": "用户投票的模型实时座次", "url": "https://lmarena.ai"},
]

DAY1_CAPSULE_EXTRA: dict[str, dict] = {
    "c1": {
        "resource_ids": ["dg-evolution", "dg-ecosystem", "open-o1", "open-o3", "ext-arena"],
        "quiz": [
            ("哪一次浪潮开始让「写代码」这件事本身贬值？",
             ["Web 浪潮", "云计算浪潮", "AI 辅助与 AI 原生浪潮"], 2,
             "AI 把「写」的成本打到接近零——值钱的是判断写什么、验收写得对不对。"),
            ("你的部门驾驶舱住在生态图的哪一层？",
             ["模型层", "平台层", "应用层"], 2,
             "应用层：它调用下面三层，但本身是解决业务问题的系统。"),
            ("平台层（网关 / 托管 / 本地推理）的核心价值是？",
             ["训练更强的模型", "让「换模型」变成「换配置」", "提供更好的界面"], 1,
             "Day 5 的体感：换模型只是换网关后面的牌子。"),
        ],
    },
    "c2": {
        "resource_ids": ["open-o2", "ext-3b1b", "ext-karpathy"],
        "quiz": [
            ("LLM 做不到的是？",
             ["生成通顺的文字", "记住对话之外的真相并主动核实", "总结长文档"], 1,
             "它没有记忆、没有真相源、不会主动行动——这些都要系统补。"),
            ("幻觉的机制根源是？",
             ["训练数据太少", "「预测最可能的下一个词」这一机制本身", "算力不足"], 1,
             "它永远给「最像真的」而非「经核实」的答案——机制不是 bug。"),
            ("幻觉对我们建系统的直接启示是？",
             ["能不用 AI 就不用", "AI 输出要验收，关键步骤要人确认", "只用开源模型"], 1,
             "这就是 Day 5 的 Rubric 和 Day 9 的确认闸存在的理由。"),
        ],
    },
    "c3": {
        "resource_ids": ["dg-four-layer", "dg-ten-day", "open-o4", "glossary", "schedule-site"],
        "quiz": [
            ("四层架构中，负责「把数据变成可传输格式、让前后端对话」的是？",
             ["前端层", "接口层", "模型层"], 1,
             "接口层是前后端唯一的对话方式——Day 3 全天都在讲它。"),
            ("「换内脏不换脸」在本课指什么？",
             ["重写前端页面", "换数据库 / 换模型，但页面与交互不变", "换一家公司实习"], 1,
             "Day 4 换库、Day 5 换模型——页面不动，这就是分层的红利。"),
            ("十天里你每天的工作对象是？",
             ["每天一个新项目", "同一艘驾驶舱，逐层接电", "只写学习文档"], 1,
             "同一代码库逐日迭代：V0.1 → V1.0 → V2.0，不重建。"),
        ],
    },
    "c4": {
        "resource_ids": ["cheatsheet-prompt"],
        "quiz": [
            ("五步闭环中「验收」失败的正确反应是？",
             ["手改生成的代码", "诊断问题，改 Prompt 约束后重新生成", "放弃这个任务"], 1,
             "Prompt 就是源码：改约束重生成，手改的产物下一轮留不住。"),
            ("在 Agent Lab 里，Prompt 的角色是？",
             ["临时聊天记录", "源码——可迭代、可验收、可追溯", "写给导师看的备忘录"], 1,
             "每一版 Prompt 都要记迭代日志。"),
        ],
        "local_prep": {
            "skill_id": "fde-local-prep",
            "codex_prompt": "你正在完成 FDE 训练营 Day 1 第 4 节「Agent Lab 环境导览」的本机加练。\n"
                            "背景：我刚学完五步闭环（需求/Prompt → 生成 → 验收 → 迭代 → 完成），需要在本机 AI 工具里独立走一遍。\n"
                            "任务：帮我完成一次迷你演练——用 3 句话描述一个「部门周报页面」需求，生成后指出一处不符合预期的地方，改约束重新生成，并记录两版 Prompt 的差异。\n"
                            "要求：先让我复述五步闭环的顺序再开始；不许跳过验收步；最后帮我把两版 Prompt 差异整理成三行迭代日志。",
            "checklist": [
                "五步闭环顺序能不看笔记背出",
                "两版 Prompt 的差异已记录（迭代日志 ≥2 行）",
                "第二次生成的产物已保存（文件或截图）",
            ],
            "suggested_questions": [
                "五步闭环第二步到底是生成还是验收？",
                "什么样的「不符合预期」值得改 Prompt？",
                "迭代日志要写多细？",
            ],
        },
    },
    "c5": {
        "resource_ids": ["tpl-direction-card", "tpl-wireframe", "cheatsheet-four-layer"],
        "quiz": [
            ("方向卡上每个业务问题的三要素是？",
             ["标题 / 口号 / 图标", "可数据化 + 有数据来源 + 有决策用途", "字数 / 排版 / 配色"], 1,
             "三要素缺一不可——否则明天 AI 生成的指标卡就是装饰品。"),
            ("线框上每个区块必须标注的三样是？",
             ["颜色 / 字体 / 圆角", "回答哪个问题编号 + 什么字段 + 三态怎么显示", "动画 / 阴影 / 渐变"], 1,
             "线框质量 = Prompt 质量 = V0.1 质量。"),
        ],
        "local_prep": {
            "skill_id": "fde-local-prep",
            "codex_prompt": "你正在完成 FDE 训练营 Day 1 第 5 节「方向卡 + 线框草稿」的本机任务。\n"
                            "背景：我已选定部门方向（运营/财务/HR/销售之一），需要把业务问题翻译成驾驶舱设计。\n"
                            "任务：帮我完成 direction-card.md（方向 + 一句话价值主张 + 3 个可数据化业务问题）和 wireframe.md（五区块线框：每区块标注问题编号 + 字段 + 三态，附四要素 Prompt 草稿）。\n"
                            "要求：先向我提出 3 个澄清问题（指标与问题的对应、明细表字段、异常行的判定），不要直接给出完整答案；每个业务问题必须可数据化、有数据来源、有决策用途。",
            "checklist": [
                "3 个业务问题全部可数据化且有决策用途",
                "五区块一个不缺（含 AI 摘要占位区）",
                "每区块标注问题编号 + 字段 + 三态",
                "Prompt 草稿四要素齐，约束与区块一一对应",
            ],
            "template_resource_id": "tpl-wireframe",
            "suggested_questions": [
                "什么样的问题算「可数据化」？",
                "异常行一般怎么判定？",
                "Prompt 草稿要写到多细？",
            ],
        },
    },
    "c6": {
        "resource_ids": ["kg-day1", "open-o1", "open-o2", "open-o3", "open-o4", "reading-list"],
        "quiz": [
            ("快测没过线（<4/6）的正确处理是？",
             ["直接进 Day 2，后面会懂", "当晚补学对应公开课，次日开营前补测", "放弃训练营"], 1,
             "不过当天补，不拖进明天——公开课就是免修考试。"),
            ("方向卡过导师闸的标准是？",
             ["写满一页纸", "3 个问题全部可数据化且有决策用途", "用词专业"], 1,
             "方向卡是 Day 2 的瞄准镜，含糊的方向卡 = 打歪的生成。"),
        ],
    },
}

# Day 1 视频清单：videos/fde-v06-day01-cN/renders/manifest.json 存在时合并时长与字幕
DAY1_MEDIA_PREFIX = "documents/shared/course-media"

# ---------------------------------------------------------------- 自动抽取


def _read(p: Path) -> str:
    return p.read_text(encoding="utf-8")


def _readme(day: int) -> dict:
    rm = _read(BC / f"day-{day:02d}" / "README.md")
    title = re.search(r"^# Day \d+ ·\s*(.+)$", rm, re.M).group(1).strip()
    total = int(re.search(r"总时长 (\d+)′", rm).group(1))
    caps = []
    for m in re.finditer(
        r"^\| (\d+) \| `([^`]+)/` \| (.+?) \| (\d+)′ \| (.+?) \| (.+?) \|$", rm, re.M
    ):
        caps.append(
            {
                "no": int(m.group(1)),
                "dir": m.group(2),
                "title": m.group(3).strip(),
                "minutes": int(m.group(4)),
                "form": m.group(5).strip(),
                "outcome": m.group(6).strip(),
            }
        )
    gm = re.search(r"## 今日验收（(.+?)）\n\n?(.*?)(?=\n## |\Z)", rm, re.S)
    gate_name = gm.group(1).strip() if gm else f"GATE {day}"
    checklist = []
    if gm:
        for line in gm.group(2).splitlines():
            line = line.strip()
            mm = re.match(r"^- (?:\[ \] )?(.+)$", line)
            if mm:
                checklist.append(mm.group(1).strip().rstrip("；。"))
    return {"title": title, "total": total, "caps": caps, "gate": gate_name, "checklist": checklist}


def _koubo(day: int, sdir: str) -> str:
    txt = _read(BC / f"day-{day:02d}" / sdir / "lesson.md")
    m = re.search(r"## 🎬 口播稿[^\n]*\n(.*?)(?=\n## |\Z)", txt, re.S)
    if m:
        lines = []
        for raw in m.group(1).splitlines():
            line = raw.strip()
            if not line:
                continue
            line = re.sub(r"^>\s*", "", line).strip()
            if line and not line.startswith("「" ) is False:
                pass
            lines.append(line)
        content = " ".join(lines).strip()
        if content:
            return content
    # fallback：教学目标
    m = re.search(r"## 教学目标\n(.*?)(?=\n## |\Z)", txt, re.S)
    if m:
        pts = [re.sub(r"^[-*]\s*", "", l).strip() for l in m.group(1).splitlines() if l.strip().startswith(("-", "*"))]
        return "；".join(pts)
    return "（见本节 lesson.md）"


def _practice(day: int, sdir: str) -> str:
    p = BC / f"day-{day:02d}" / sdir / "practice.md"
    if not p.exists():
        return "见本节 practice.md"
    txt = _read(p)
    m = re.search(r"## 完成标志\n(.*?)(?=\n## |\Z)", txt, re.S)
    if m:
        pts = [re.sub(r"^[-*]\s*", "", l).strip().rstrip("；。") for l in m.group(1).splitlines() if l.strip().startswith(("-", "*"))]
        if pts:
            return "完成标志：" + "；".join(pts) + "。"
    return "按本节 practice.md 完成任务并达到完成标志。"


def _day1_media(cno: int, title: str, cref: str) -> list[dict]:
    """Day 1 胶囊媒体：优先合并已合成视频的 manifest（时长/字幕），否则占位。"""
    base = f"{DAY1_MEDIA_PREFIX}/day01-c{cno}"
    media: dict = {
        "kind": "video",
        "title": f"视频讲解 · {title}",
        "object_key": f"{base}-explainer.mp4",
        "poster_key": f"{base}-poster.jpg",
        "transcript_ref": cref + "#口播稿",
    }
    manifest = ROOT / "videos" / f"fde-v06-day01-c{cno}" / "renders" / "manifest.json"
    if manifest.exists():
        import json as _json

        m = _json.loads(manifest.read_text(encoding="utf-8"))
        if m.get("duration_sec"):
            media["duration_sec"] = round(m["duration_sec"])
        if m.get("transcript"):
            media["transcript"] = m["transcript"]
    else:
        media["duration_sec"] = 90
        media["title"] += "（合成中）"
    return [media]


def build(day: int) -> dict:
    meta = _readme(day)
    data = DAYS[day]
    capsules = []
    for cap in meta["caps"]:
        cref = f"class/bootcamp/day-{day:02d}/{cap['dir']}/lesson.md"
        capsule: dict = {
            "id": f"c{cap['no']}",
            "title": cap["title"],
            "minutes": cap["minutes"],
            "form": cap["form"],
            "content_ref": cref,
            "content": _koubo(day, cap["dir"]),
            "practice": _practice(day, cap["dir"]),
        }
        if day == 1:
            capsule["media"] = _day1_media(cap["no"], cap["title"], cref)
            extra = DAY1_CAPSULE_EXTRA.get(f"c{cap['no']}") or {}
            if extra.get("resource_ids"):
                capsule["resource_ids"] = extra["resource_ids"]
            if extra.get("quiz"):
                capsule["quiz"] = {
                    "pass_rate": 0.67,
                    "questions": [
                        {"q": q, "options": opts, "answer": ans, "explain": ex}
                        for q, opts, ans, ex in extra["quiz"]
                    ],
                }
            if extra.get("local_prep"):
                capsule["local_prep"] = extra["local_prep"]
        else:
            capsule["media"] = [
                {
                    "kind": "video",
                    "title": f"口播视频 · {cap['title']}（待录制）",
                    "object_key": f"documents/shared/course-media/day{day:02d}-c{cap['no']}-explainer.mp4",
                    "duration_sec": 300,
                    "transcript_ref": cref + "#口播稿",
                }
            ]
        capsules.append(capsule)
    quiz = {
        "pass_rate": 0.67,
        "questions": [
            {"q": q, "options": opts, "answer": ans, "explain": ex}
            for q, opts, ans, ex in data["quiz"]
        ],
    }
    lab = data["lab"]
    # 累计工作区：继承此前各天的 primary_files（保持顺序、去重）
    inherited: list[str] = []
    for prev in range(1, day):
        for f in DAYS[prev]["lab"]["primary_files"]:
            if f not in inherited:
                inherited.append(f)
    return {
        "camp_version": "v0.6",
        "day": day,
        "title": meta["title"],
        "week": WEEK_OF[day],
        "project": "部门AI驾驶舱",
        "project_brief": data["brief"],
        "directions": DIRECTIONS,
        "review_checklist": meta["checklist"],
        "resources": DAY1_RESOURCES if day == 1 else [
            {"id": f"day{day}-courseware", "title": f"Day{day} 课件包（{len(meta['caps'])} 节）",
             "kind": "guide",
             "summary": f"class/bootcamp/day-{day:02d}/ 下每节 lesson/practice/resources/homework/ai-tutor"},
            {"id": "open-course", "title": "公开课 O1–O5（世界观完整版）", "kind": "guide",
             "summary": "class/open-course/；主课快通、公开课完整，快测考点全在这里"},
            {"id": "diagrams", "title": "讲解图集（27 张 SVG）", "kind": "guide",
             "summary": "class/assets/diagrams/；课表网站 class/schedule/index.html 可在线看"},
        ],
        "learn": {
            "lingzhi_tags": ["camp:v0.6", f"day:{day}", "project:cockpit"],
            "estimated_minutes": meta["total"],
            "require_capsules": True,
            "capsules": capsules,
        },
        "quiz": quiz,
        "nodes": [
            {"type": "learn", "title": f"今日课节（{len(meta['caps'])} 节 · {meta['total']}′）"},
            {"type": "quiz", "title": f"Day{day} 概念验收"},
            {"type": "lab", "title": data["nodes_lab"]},
            {"type": "project", "title": f"企业任务：{meta['title']}"},
            {"type": "review", "title": f"交付自检与 {meta['gate']}"},
        ],
        "lab": {
            "runner": "agent",
            "workspace_mode": "cumulative",
            "primary_files": lab["primary_files"],
            "inherited_files": inherited,
            "coach": {"help_mode": "debug", "skill_id": "fde-coach", "max_help_level": 3},
            "adapter_version": "1.0",
            "agent": {"prompt_template": lab["prompt"]},
            "rubric": lab["rubric"],
        },
    }


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for day in range(1, 11):
        pkg = build(day)
        path = OUT / f"day-{day:02d}-curriculum.yaml"
        with path.open("w", encoding="utf-8") as f:
            yaml.safe_dump(pkg, f, allow_unicode=True, sort_keys=False, width=120)
        print(f"day-{day:02d}: {pkg['title']} · {len(pkg['learn']['capsules'])} capsules · "
              f"{len(pkg['quiz']['questions'])} quiz · {len(pkg['review_checklist'])} checks")


if __name__ == "__main__":
    main()
