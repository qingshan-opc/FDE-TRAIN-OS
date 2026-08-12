# 第八天 · 第 3 节 · 编排骨架与决策环

路径：`class/bootcamp/day-09/section-03-agent-harness/video/`  
PPT：`video/index.html`（**仅讲解图 + 概念要点，无口播正文**）  
分词稿：`video/scripts/narration/`

> 口播以分词稿为准 · TTS 后需重跑 `patch_section_video_timing.py`

---

## 01 · open

**PPT（屏幕）**
- 眉题：01 OPEN · 四要素快答
- 讲解图：harness-anatomy.svg
- 模型 · 工具表 · 记忆 · 循环
- 你们早就在拼 Harness

**口播**
> 同学们好，我是你们的老师404。快答开场——Harness 四要素是什么？模型、工具表、记忆、循环。想三秒，心里默念一遍。惊喜来了：这四样你们全摸过。前几天接过对话网关、做过上下文装配；昨天写的 Skill 就是工具表上的一件工具；你们验收不过改说明书重跑，就是人工版循环。有同学可能会说：404老师，那我们今天学啥？学名字，学结构，学你这两天到底在给谁打工。听见了吗？你们已经在徒手拼 Harness 了，只是还没掀引擎盖。来，看屏幕这张解剖图，咱们逐件认——认完你就知道 Skill 该挂哪，对吧。

文稿：`video/scripts/narration/01-open.txt`

---

## 02 · four-elements

**PPT（屏幕）**
- 眉题：02 ELEMENTS · 四要素逐讲
- 讲解图：harness-anatomy.svg
- 模型 = 大脑 · 工具表 = 手
- 记忆 = 上下文 · 循环 = 想-做-看

**口播**
> 四要素逐讲，全是老熟人。模型管思考的大脑——第五天网关后的 LLM。工具表管能动手做什么——第七天的 Skill 马上挂上去。记忆管上下文里带什么——第五天的上下文装配。循环管反复想、做、看——你们迭代闭环就是人工版循环。有同学可能会问：记忆是不是聊天记录？是，但不限于——系统提示、检索到的资料、工具说明，都算记忆的一部分。听见了吗？缺一件，Agent 要么只会说不会做，要么做了不记得上一步。来，对照屏幕四格，每件对应你做过的一个动作——这不是新词表，是旧地图换名字，嘛。

文稿：`video/scripts/narration/02-four-elements.txt`

---

## 03 · agent-definition

**PPT（屏幕）**
- 眉题：03 AGENT · 骨架 + 角色
- 讲解图：agent-loop.svg
- Harness = 骨架 · 角色 = 说明书/人格/目标
- ai-tutor.yaml ≈ Agent 角色定义

**口播**
> Agent 是什么？一句话：Harness 是骨架，角色是你写的说明书、人格、目标。你们写的 ai-tutor.yaml，其实就是一份 Agent 角色定义——你们早就在造 Agent 了，只是没人告诉名字。Skill 是给 Agent 预备的工具；Agent 拿着工具表上的 Skill 去干活。有同学可能会说：Agent 和聊天机器人啥区别？聊天机器人只有模型；Agent 有工具表和循环——能动手、能分多步。听见了吗？今天 Advanced 形态会自己写 Skill，那是后话；今天它调用你写的。来，骨架认完了，下一页看它在骨架上怎么转圈，对吧。

文稿：`video/scripts/narration/03-agent-definition.txt`

---

## 04 · decision-loop

**PPT（屏幕）**
- 眉题：04 LOOP · 决策环
- 讲解图：agent-loop.svg
- 理解 → 规划 → 调工具 → 观察 → 继续
- 实例：生成本周周报

**口播**
> Agent 的工作方式叫决策环：理解任务、规划步骤、选择并调用工具、观察结果、继续或收尾——一圈一圈转，直到交活。用昨天 Skill 当实例：理解「生成本周周报」、规划四步、调 weekly-report、看产出、验收通过就收尾。有同学可能会问：它会不会一直转圈？会，所以工程上要设最大轮数和超时——别等它无限改稿。听见了吗？决策环不是魔法，是「想一步、做一步、看一眼」的自动化版；你们人工验收，就是在环外当裁判。来，看屏幕箭头，跟着走一圈——下一页专门讲护栏怎么设，呢。

文稿：`video/scripts/narration/04-decision-loop.txt`

---

## 05 · loop-guardrails

**PPT（屏幕）**
- 眉题：05 GUARDRAILS · 环要设护栏
- 讲解图：agent-loop.svg
- 最大轮数 · 超时 · 平台护栏
- 死循环 · 工程上可防

**口播**
> 决策环会死循环——同一工具调十遍、改来改去不交活，真会发生。护栏三件套：最大轮数、单次超时、平台侧拦截。有同学可能会说：我多给几轮让它想充分不行吗？可以，但企业场景要可预期——无限轮等于无限账单、无限等待。听见了吗？Harness 里的循环不是「让它自由发挥」，是「在框里反复试」；框的大小，你来定。下一节挂 Skill 到工具表时，也会碰到选错工具——那是环的第一步「理解+规划」出了问题，描述修好了能缓解。死循环和选错，都是 Harness 要管的，对吧。

文稿：`video/scripts/narration/05-loop-guardrails.txt`

---

## 06 · workflow-vs-agent

**PPT（屏幕）**
- 眉题：06 WORKFLOW VS AGENT · 分水岭
- 讲解图：workflow-vs-agent.svg
- workflow：步骤你定死
- agent：路径它现想 · 能 workflow 别 agent

**口播**
> 最后一个分水岭：workflow 还是 agent？步骤你定死，是 workflow——第九天学编排就是这个。路径它现想，是 agent。能 workflow 的别 agent——企业场景里，可预测是第一美德。报销审批适合 workflow；「帮我把这堆乱文件整理成 PRD」适合 agent。有同学可能会问：那周报生成用哪个？拉数、调 Skill、给你看——步骤稳定就 workflow；「帮我看看这周有什么值得注意的」才更像 agent。听见了吗？不是 agent 高级、workflow 低级，是风险不同。来，对照屏幕两张图，别用 agent 解决该写死流程的事，对吧。

文稿：`video/scripts/narration/06-workflow-vs-agent.txt`

---

## 07 · close

**PPT（屏幕）**
- 眉题：07 TAKEAWAY · 心里过三问
- 讲解图：harness-anatomy.svg
- 四要素 · 决策环 · workflow 优先
- 预告：Agent 调用 Skill

**口播**
> 同学们，本节先到这里。有同学可能会说：名字记住了，手还没挂工具——下一节就干这个。我问三句啊。第一问：Harness 四要素各管什么，对应你第几天做过啥？第二问：Agent 和聊天机器人差在哪——工具表和循环。第三问：workflow 和 agent 怎么选——步骤稳就 workflow，能 workflow 别 agent。答含糊就回看解剖图和决策环。下一节把你的 Skill 挂上 Agent 的工具表——从今天起，你派活用自然语言，挑工具的活 Agent 自己干，嘛。

文稿：`video/scripts/narration/07-close.txt`

---

## 评审清单

- [x] PPT 无口播正文，仅图 + 概念卡/表
- [x] 口播与 `narration/*.txt` 一致
- [ ] TTS 后 patch 时间轴并重渲
