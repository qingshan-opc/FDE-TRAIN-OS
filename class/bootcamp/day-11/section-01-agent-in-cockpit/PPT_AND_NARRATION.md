# 第十天 · 第 1 节 · 实战：把 Agent 挂进 UI

路径：`class/bootcamp/day-11/section-01-agent-in-cockpit/video/`  
PPT：`video/index.html`（**仅讲解图 + 概念要点，无口播正文**）  
分词稿：`video/scripts/narration/`

> 口播以分词稿为准 · TTS 后需重跑 `patch_section_video_timing.py`

---

## 01 · open

**PPT（屏幕）**
- 眉题：01 OPEN · 对话口接真 Agent
- 讲解图：v2-panorama.svg
- 提示词 06 · UI 事件流
- chat · loop · task 已通电

**口播**
> 同学们好，我是你们的老师404。先问一句：本周 chat、Skill、loop、长任务确认闸，哪一件你仓库里还是假的？想三秒。有同学可能会说：404老师，助手位空着是不是很丢人？空不空不重要——今天把对话口接到真 Agent。第一周业务系统能跑；第二周 Agent 在仓库里通电；今天收口，把事件流接到页面。助手位可以，任意业务页加面板也可以，驾驶舱 brief 不是硬门槛。整份粘贴提示词 06。来，看屏幕全景：业务、对话、Skill、Loop，今天要让人在页里看得见、拦得住，对吧。

文稿：`video/scripts/narration/01-open.txt`

---

## 02 · page-not-lab

**PPT（屏幕）**
- 眉题：02 PAGE · 交付面在页内
- 讲解图：v2-panorama.svg
- 助手位或任意页面板均可
- 不接外部 Lab 工作台
- 能控 > 好看

**口播**
> 先钉原则。交付面是用户打开的那一页——不是外部 Lab、不是别人家的工作台。有同学一听就懵：一定要完美驾驶舱吗？不一定。助手位接上可以；订单页、看板页侧面挂个面板，只要聊得着、状态看得见、闸点得到，也算接线。听见了吗？验收看能不能控，不是 brief 漂不漂亮。别把时间花在重做业务 CRUD 上，也别引入重型前端框架——现有 HTML 加一点 JS 就够。来，对照屏幕：人在页内下指令，Agent 在你仓库里跑——回路不能断，断了就白接，嘛。

文稿：`video/scripts/narration/02-page-not-lab.txt`

---

## 03 · three-wires

**PPT（屏幕）**
- 眉题：03 WIRES · 三根线一次齐
- 讲解图：v2-panorama.svg
- ① chat 多轮
- ② loop 调工具可见
- ③ task 确认闸可点

**口播**
> 接线三根线，记死。第一，普通多轮聊天：页内发消息，打到 chat 或 turn API。第二，任务入口：长句当 goal，或单独「执行任务」按钮，打到 task_runner。第三，确认闸在页内：approve、reject 写回任务状态。有同学可能会说：三件都要今天做完？理想态全亮；时间紧也要心里有数——缺闸的接线，答辩「拦得住」过不了。听见了吗？嘴是 chat，手是 loop，刹车是 task 闸。来，对照屏幕三根线，动手前先勾你的 API 路径，对吧。

文稿：`video/scripts/narration/03-three-wires.txt`

---

## 04 · events

**PPT（屏幕）**
- 眉题：04 EVENTS · 运行中看得见
- 讲解图：agent-loop.svg
- turn_start · tool_call · tool_result
- confirm_required · turn_done / task_done

**口播**
> 运行中要展示事件：`turn_start`、`tool_call` 带工具名和摘要、`tool_result` 截断、`confirm_required` 弹出批准拒绝、`turn_done` 或 `task_done`。轮询或 SSE 都行，答辩能看状态即可。有同学可能会问：必须上 WebSocket 吗？不必——稳比炫重要。听见了吗？黑盒 Agent 不算驾驶：用户得知道它在第几轮、调了啥、卡在哪。历史至少显示本会话消息，能链到 `runs/` 说明更好。来，对照屏幕事件列表，先让一条 tool_call 在页上闪出来，再谈别的，呢。

文稿：`video/scripts/narration/04-events.txt`

---

## 05 · awaken

**PPT（屏幕）**
- 眉题：05 AWAKEN · 第一跳真通
- 讲解图：v2-panorama.svg
- 页内对话区
- 打到本仓库 Agent API
- 禁 mock 冒充

**口播**
> 第一跳，唤起。最小实现：页内对话区，请求打到你自己仓库的 Agent API——发一句，回一句，链路真通。有同学可能会说：先 mock 个假回复凑合？不行。mock 只能骗自己，骗不了互评。测试也简单：刷新页面，问一个只读问题，看回复是不是从你配置的模型来的。听见了吗？嘴接上了，事件和闸才有意义。先通一条真消息，再叠任务入口。咱们 FDE 不怕慢，怕假；真通一件，胜过假亮三件，对吧。

文稿：`video/scripts/narration/05-awaken.txt`

---

## 06 · gate-in-page

**PPT（屏幕）**
- 眉题：06 GATE · 闸在页内可点
- 讲解图：orchestration-confirm.svg
- confirm_required → 两按钮
- approve / reject 写回
- 拒绝后状态明确

**口播**
> 闸必须在页内。任务跑到写操作，弹出确认：草稿或摘要可见，批准、驳回两个按钮，点了就打 approve 或 reject API。有同学可能会说：我去终端里敲命令行不行？演示可以，答辩交付面不行——用户、老板、评委盯的是这一页。听见了吗？拒绝之后界面要有明确状态，别按钮点了没反应。对照昨天双路径：页内也要能走出批准和驳回各一次。来，宁可做一个能点的真闸，不要三个半成品贴纸，嘛。

文稿：`video/scripts/narration/06-gate-in-page.txt`

---

## 07 · defense-demo

**PPT（屏幕）**
- 眉题：07 DEMO · 五步演示脚本
- 讲解图：v2-panorama.svg
- 打开页 → 只读聊 → 调 Skill 任务
- 确认闸 → 指 runs/
- 写入 docs/defense-demo.md

**口播**
> 动手顺序写进 `docs/defense-demo.md`，五步就够。一，打开页面，指你要演示的指标或入口。二，聊天问一个只读问题。三，发起一个会调 Skill 的任务。四，演示一次确认闸。五，打开 `runs/` 指给评委看。有同学可能会慌：三十分钟够吗？够，如果你守纪律——先闭环再化妆。听见了吗？脚本是给你自己的提词器，也是互评对照表。不要做：重写业务 CRUD、上重型框架、把接线拖去外部工作台。来，五步先写进文档再写代码，对吧。

文稿：`video/scripts/narration/07-defense-demo.txt`

---

## 08 · close

**PPT（屏幕）**
- 眉题：08 TAKEAWAY · 全景自查
- 讲解图：v2-panorama.svg
- 对话口 = 真 Agent
- 事件可见 · 闸可点 · runs 在
- 下一节十条证据

**口播**
> 同学们，本节先到这里。我问三句，你们心里过一遍：页内能真聊吗？tool_call 事件看得见吗？确认闸能在页内点批准驳回吗？答得含糊就回去补一件真的。带走一句——今天把对话口接到真 Agent；助手位也好，任意页面板也好，能控才叫接线。对照 teaching 包 V2.0 清单打勾。下一节拿十条证据自证，全亮再上台。咱们 FDE 不怕慢，怕假。

文稿：`video/scripts/narration/08-close.txt`

---

## 评审清单

- [x] PPT 无口播正文，仅图 + 概念卡/表
- [x] 口播与 `narration/*.txt` 一致
- [ ] TTS 后 patch 时间轴并重渲
