# 第六天 · 第 5 节 · Agent / Harness / Tool / MCP / Workflow vs Agent

路径：`class/bootcamp/day-06/section-05-agent-harness-mcp/video/`  
PPT：`video/index.html`（**仅讲解图 + 概念要点，无口播正文**）  
分词稿：`video/scripts/narration/`

> 口播以分词稿为准 · TTS 后需重跑 `patch_section_video_timing.py`

---

## 01 · open

**PPT（屏幕）**
- 眉题：01 OPEN · 六词骨架
- Agent · Harness · Tool · MCP · Workflow · Copilot
- 第二周 Skill 封装前先对齐名词

**口播**
> 同学们，第五节词最多，六个一次讲清：Agent、Harness、Tool Calling、MCP、Workflow 跟 Agent 怎么分，还有 Copilot 跟 Agent 差在哪。第二周你们要封装 Skill——今天先把骨架名词对齐，别到时候 Harness 和 MCP 混成一团，听完了能跟同桌各讲一个词，就算过关，嘛。

文稿：`video/scripts/narration/01-open.txt`

---

## 02 · agent

**PPT（屏幕）**
- 眉题：02 AGENT · 智能体
- 讲解图：agent-loop.svg
- 理解 → 规划 → 调工具 → 看结果 → 继续

**口播**
> 先说 Agent，智能体——不是只会接龙的模型，是能自己决定下一步的 AI。你给目标，它理解任务、规划步骤、调工具、看结果、继续跑，直到完成或者求助。Cursor 的 Agent 模式、Claude Code、OpenAI Assistants，都是这个路子。你定的是目的地和验收标准，它选路线怎么走。打个比方，Agent 像派出去办事的实习生——你交代「把本周数据整理成摘要」，它自己查资料、调接口、写草稿，对吧。

文稿：`video/scripts/narration/02-agent.txt`

---

## 03 · harness-tool

**PPT（屏幕）**
- 眉题：03 HARNESS + TOOL
- 讲解图：harness-anatomy.svg
- Tool Calling：结构化请求 → 执行 → 喂回

**口播**
> Agent 外面那层壳，叫 Harness，编排框架——管工具表、记忆、规划、重试、日志。同一个 GPT-4，套 Cursor 的 Harness 能改十个文件，套个简陋脚本只能问答，能力天差地别。Tool Calling 是模型伸出来的手：它输出结构化请求「我要调 search，参数 q 等于周报」，Harness 执行完，把结果喂回去。第五天 API 里的 function calling，就是这个机制，呢。

文稿：`video/scripts/narration/03-harness-tool.txt`

---

## 04 · mcp

**PPT（屏幕）**
- 眉题：04 MCP · USB-C 标准
- 讲解图：skill-anatomy.svg（Skill≈朴素 MCP）
- 读 SKILL.md · 调工具 · 交付

**口播**
> MCP，Model Context Protocol，模型上下文协议——给 AI 接工具和数据源的统一标准。以前接一个工具，得给每个 Agent 单独写适配；MCP 像 USB-C 插座，按标准写一个 Server，Cursor、Claude Desktop、各种 Agent 都能插。训练营里的 Skill 是朴素版 MCP：读 SKILL.md，描述工具，按约定执行，交付结果。第二周你们会亲手写，今天先知道「Skill 就是自己能用的 MCP 服务」，对吧。

文稿：`video/scripts/narration/04-mcp.txt`

---

## 05 · workflow

**PPT（屏幕）**
- 眉题：05 WORKFLOW vs AGENT
- 讲解图：workflow-vs-agent.svg
- 写死流程 vs 现场决策

**口播**
> Workflow 跟 Agent 怎么选？Workflow 是人画死的流程图——先 A 再 B 再 C，稳定、可审计；Agent 是模型现场决定下一步，灵活，但得靠 Eval 兜底。能写死就写死，写不死才上 Agent。报销审批、固定报表，适合 Workflow；「把这堆乱文件整理成 PRD」这种目标清楚、路径不确定的，适合 Agent。别啥都上 Agent——流程稳定的地方，Workflow 更省心，嘛。

文稿：`video/scripts/narration/05-workflow.txt`

---

## 06 · copilot

**PPT（屏幕）**
- 眉题：06 COPILOT vs AGENT
- 双列：副驾补全 vs 自主多步
- Copilot 错一行 · Agent 错十文件

**口播**
> Copilot 跟 Agent 差在哪？Copilot 是副驾——补全、问答、局部改写，你开车它递扳手，错了改一行就行。Agent 是司机——你定目的地它开，能跑多步、调工具，错了可能改坏十个文件。信任要求和验收完全不同：Copilot 你可以边写边看；Agent 必须有日志、回滚、Eval。会开 Agent 的人变贵，不会验收就放手 Agent 的人，背锅也最快，对吧。

文稿：`video/scripts/narration/06-copilot.txt`

---

## 07 · close

**PPT（屏幕）**
- 眉题：07 TAKEAWAY · 六词口诀
- Agent决策 · Harness骨架 · Tool手 · MCP插座
- 预告：18 词抽测

**口播**
> 第五节收个口诀：Agent 决策，Harness 骨架，Tool 是手，MCP 是插座，Workflow 写死，Copilot 副驾。最后一节是十八词抽测加认知卡——检验今天有没有真过线。同学们，六个词回去各找一条前五天的例子，串起来就是你们的 Agent 地图，呢。

文稿：`video/scripts/narration/07-close.txt`

---

## 评审清单

- [x] PPT 无口播正文，仅图 + 概念卡/表
- [x] 口播与 `narration/*.txt` 一致
- [ ] TTS 后 patch 时间轴并重渲
