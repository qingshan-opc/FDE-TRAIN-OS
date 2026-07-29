# 第六天 · 第 5 节 · Agent / Harness / Tool / MCP / Workflow vs Agent

路径：`class/bootcamp/day-06/section-05-agent-harness-mcp/video/`  
PPT：`video/index.html`（**仅讲解图 + 概念要点，无口播正文**）  
分词稿：`video/scripts/narration/`

> 口播以分词稿为准 · TTS 后需重跑 `patch_section_video_timing.py`

---

## 01 · open

**PPT（屏幕）**
- 眉题：01 OPEN · 六个词一次对齐
- Agent · Harness · Tool · MCP · Workflow · Copilot
- 听懂标志：能讲给同桌听并举例

**口播**
> 同学们好，我是你们的老师404。第五节词最多：Agent、Harness、Tool Calling、MCP、Workflow 跟 Agent、Copilot 跟 Agent。先问一句：你能不能用一句话说清——Harness 和 MCP 不是一回事？说不清很正常，今天就是来对齐的。有同学可能会怕背不完。不用背定义全文——听完要能跟同桌各讲一个词，并各举一条前五天的例子。第二周要封装 Skill，今天先把骨架名词立住。来，看屏幕，从 Agent 开始，嘛。

文稿：`video/scripts/narration/01-open.txt`

---

## 02 · agent

**PPT（屏幕）**
- 眉题：02 AGENT · 能决定下一步
- 讲解图：agent-loop.svg
- 理解 → 规划 → 调工具 → 观察 → 继续
- 你定目的地与验收 · 它选路线

**口播**
> Agent，智能体——不是只会接龙聊天的模型，而是能自己决定下一步的 AI。循环：理解任务、规划步骤、调工具、看结果、继续——直到完成或向你求助。Cursor Agent 模式、Claude Code、OpenAI Assistants，都是这条路。你定目的地和验收，它选怎么走。比方：你交代「把本周数据整理成摘要」，它自己去查、调接口、写草稿——像派出去办事的实习生。有同学可能会说：那不就是 ChatGPT 吗？不完全是——普通聊天多半停在「说」；Agent 还会「做」，会伸手调工具。听见了吗？。Agent 的价值是「多步办事」，风险也在多步——错了会错一串。

文稿：`video/scripts/narration/02-agent.txt`

---

## 03 · harness

**PPT（屏幕）**
- 眉题：03 HARNESS · 外面那层壳
- 讲解图：harness-anatomy.svg
- 工具表 · 记忆 · 规划 · 重试 · 日志 · 权限
- 同一模型 · 不同 Harness · 能力天差地别

**口播**
> Agent 外面那层壳，叫 Harness，可以叫编排框架。它管工具表、记忆、规划、重试、日志、权限。同一个大模型，套 Cursor 的 Harness 能改十个文件；套个简陋脚本可能只会一问一答——差的不是「脑子」，是「骨架」。第一节说的编排层，很大一块就是这类东西。有同学可能会问：那 Harness 是不是就是产品？接近——产品把 Harness 产品化了。你要记住：别只问「用哪个模型」，也要问「外面这层循环靠不靠谱」。问型号之前，先问骨架靠不靠谱。日志和重试看起来土，但没有它们，Agent 出事你查不到。

文稿：`video/scripts/narration/03-harness.txt`

---

## 04 · tool

**PPT（屏幕）**
- 眉题：04 TOOL · 伸出来的手
- 三卡：结构化请求 · Harness 执行 · 结果喂回
- 第五天 function calling = 雏形

**口播**
> Tool Calling 是模型伸出来的手。它不是「说说而已」，而是输出结构化请求，比如「我要调 search，参数 q 等于周报」；Harness 去执行，再把结果喂回上下文，模型再继续想下一步。第五天 API 里的 function calling，就是这套机制的雏形。有同学可能会说：那工具谁写？你写、同事写、或以后用 MCP 标准接。听见了吗？Agent 会决策，Tool 让决策能碰到真实世界。工具描述写糊，模型就会调错手——说明书质量就是能力上限。

文稿：`video/scripts/narration/04-tool.txt`

---

## 05 · mcp

**PPT（屏幕）**
- 眉题：05 MCP · 统一插座
- 讲解图：skill-anatomy.svg
- 以前：一工具一适配 · 现在：USB-C 标准
- Skill ≈ 朴素版 MCP 服务

**口播**
> MCP，Model Context Protocol——给 AI 接工具和数据源的统一标准。以前接一个工具，常常要给每个 Agent 单独写适配，像每种手机一个充电器。MCP 像 USB-C：按标准写一个 Server，Cursor、Claude Desktop 等都可能插得上。训练营里的 Skill，是朴素版：读说明书、描述工具、按约定执行、交付结果。第二周你们会亲手写。有同学可能会说：Skill 是不是等于 MCP？先记关系——Skill 是你能用的说明书加执行约定；MCP 是行业想统一的插座标准。今天对齐名词，下周长在手上。插座标准是为了少写适配，不是又多一个黑话。标准插座解决的是「重复造适配」，不解决「工具本身对不对」。

文稿：`video/scripts/narration/05-mcp.txt`

---

## 06 · workflow

**PPT（屏幕）**
- 眉题：06 WORKFLOW · 写死 vs 现场决策
- 讲解图：workflow-vs-agent.svg
- 双列：Workflow 稳定可审计 · Agent 灵活需 Eval
- 原则：能写死就写死

**口播**
> Workflow 跟 Agent 怎么选？Workflow 是人画死的流程图：先 A 再 B 再 C，稳定、可审计、好追责。Agent 是模型现场决定下一步，灵活，但得靠 Eval 和日志兜底。原则一句：能写死就写死，写不死才上 Agent。报销审批、固定报表适合 Workflow；「把这堆乱文件整理成 PRD」这种目标清楚、路径不确定的，适合 Agent。有同学喜欢啥都上 Agent，听着先进——流程稳定的地方，Workflow 往往更省心、也更安全。听见了吗？先进不是标准，合适才是。审计友好的流程，往往更像 Workflow；别为了酷改成 Agent。

文稿：`video/scripts/narration/06-workflow.txt`

---

## 07 · copilot

**PPT（屏幕）**
- 眉题：07 COPILOT · 副驾 vs 司机
- 副驾：补全·局部改 · 错一行
- 司机：多步·调工具 · 可能错十文件
- 信任与验收要求完全不同

**口播**
> Copilot 跟 Agent 差在哪？Copilot 是副驾：补全、问答、局部改写，你开车它递扳手，错了往往改一行。Agent 是司机：你定目的地它开，能跑多步、跨文件、调工具，错了可能改坏十个文件。所以啊，信任和验收完全不同——Copilot 可以边写边看；Agent 得有日志、回滚、Eval。有同学可能会说：那我少用 Agent 不就没事了？该用还是用，但别「不会验收就放手」。会开 Agent 的人变贵；不会验收就放手的人，背锅也最快。副驾错了你还握着方向盘；司机错了，车已经开出去了。

文稿：`video/scripts/narration/07-copilot.txt`

---

## 08 · close

**PPT（屏幕）**
- 眉题：08 TAKEAWAY · 六词口诀 + 自检
- Agent决策 · Harness骨架 · Tool手 · MCP插座
- 下一站：概念抽测 + 认知卡

**口播**
> 同学们，本节先到这里。带走口诀：Agent 决策，Harness 骨架，Tool 是手，MCP 是插座，Workflow 写死，Copilot 副驾。我问几句，你们心里过一遍：六个词各找一条前五天的例子——比如第五天 function calling 对应 Tool，驾驶舱产品落在应用层。今天理论日课节到这儿收口；接下来走概念抽测和企业任务认知卡，把词钉到你自己的项目上。听懂的标志不是会背英文，是能讲给人听。六个词各挂一个自己的例子，认知卡就有素材了。

文稿：`video/scripts/narration/08-close.txt`

---

## 评审清单

- [x] PPT 无口播正文，仅图 + 概念卡/表
- [x] 口播与 `narration/*.txt` 一致
- [ ] TTS 后 patch 时间轴并重渲
