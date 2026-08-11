# 第八天 · 第 4 节 · 实战：实现 Agent Loop

路径：`class/bootcamp/day-09/section-04-agent-calls-skill/video/`  
PPT：`video/index.html`（**仅讲解图 + 概念要点，无口播正文**）  
分词稿：`video/scripts/narration/`

> 口播以分词稿为准 · TTS 后需重跑 `patch_section_video_timing.py`

---

## 01 · open

**PPT（屏幕）**
- 眉题：01 OPEN · 今天落地 loop.py
- 讲解图：agent-loop.svg
- 提示词 04 · 自建 Agent 循环
- LLM → tool_calls → 回灌

**口播**
> 同学们好，我是你们的老师404。先问一句：上一节 Harness 四要素里，哪一件还停在「人工版」？想三秒——循环。有同学可能会说：404老师，我不是已经会调 Skill 了吗？调过一次叫会用工具；能让模型自己连着调、看结果、再决定下一步，才叫 Agent Loop。今天这节只干一件事：在你们自己的学员仓库里实现 `agent/loop.py`，整份粘贴提示词 04，跑出 tool_calls 闭环。不读外部产品源码，也不进平台 Lab——循环就在你仓库里。来，看屏幕这张决策环，咱们先把伪代码钉死，再动手，对吧。

文稿：`video/scripts/narration/01-open.txt`

---

## 02 · loop-anatomy

**PPT（屏幕）**
- 眉题：02 LOOP · 一轮怎么转
- 讲解图：agent-loop.svg
- messages 进 · llm 出
- 有 tool_calls → 执行 → 回灌
- 无 tool_calls → 收束

**口播**
> 循环长什么样？用人话说：消息列表进模型，模型要么直接给最终答案，要么甩出一串 tool_calls。有调用，你就 dispatch 执行，把工具结果再塞回 messages，进入下一轮；没有调用，这一轮结束。有同学可能会问：那和我手动点一次 Skill 有啥区别？区别在「回灌」——结果回到模型眼前，它才能决定继续读文件、再调 Skill，还是收工。听见了吗？伪代码就五行：for turn、调 llm、追加 assistant、有工具就执行并追加、没有就 return。来，对着屏幕把「想 → 做 → 看 → 再想」念一遍，别跳过回灌这一步，嘛。

文稿：`video/scripts/narration/02-loop-anatomy.txt`

---

## 03 · tools-min

**PPT（屏幕）**
- 眉题：03 TOOLS · 最小工具集
- 讲解图：harness-anatomy.svg
- file_read · 项目内只读
- skill · 调已有 Skill
- 可选 http_get · 禁止裸 bash 删库

**口播**
> 工具先做最小集，别贪。第一件 `file_read`：只允许读项目目录内路径。第二件 `skill`：调用你已经写好的 Skill。第三件可选 `http_get`：只读本机业务 API。有同学可能会说：给我一个无限制 bash 不好吗？不好——今天公开课级别的 Agent，沙箱和超时是底线；要 bash，也必须 cwd 锁死加超时。听见了吗？工具表是手，手太野就会砸锅。System prompt 写进 `agent/prompts/agent_loop.md`：何时调工具、怎么结束、禁止编造工具结果。来，对照屏幕两件必做工具，先挂上再测，对吧。

文稿：`video/scripts/narration/03-tools-min.txt`

---

## 04 · max-turns

**PPT（屏幕）**
- 眉题：04 CAP · max_turns 护栏
- 讲解图：agent-loop.svg
- 默认 20 · 可配置
- 超限立刻停 · 别死循环

**口播**
> 循环没有上限，就是事故。默认 `max_turns` 二十，可配置；转到头还没收束，直接返回「超限停止」，别让它空转烧钱。有同学可能会问：二十够不够？够演示；真业务再调。听见了吗？上限不是小气，是工程纪律——模型偶尔会卡在「再试一次」里，你得有刹车。验收很简单：故意把上限改成三，看它超限会不会老实停。停不住的 loop，答辩当场红灯。来，把 max_turns 写进配置或函数参数，别写死在魔法数字里藏着，呢。

文稿：`video/scripts/narration/04-max-turns.txt`

---

## 05 · runs-log

**PPT（屏幕）**
- 眉题：05 LOG · runs 可回放
- 讲解图：agent-loop.svg
- 每 turn 追加 log.jsonl
- 工具名 · 摘要 · 结果截断

**口播**
> 每执行一个 tool_call，往 `runs/.../log.jsonl` 追加一行：时间、轮次、工具名、参数摘要、结果截断。有同学可能会说：我看终端输出不就行了？终端一关就没了；jsonl 能回放、能交作业、能给明天的确认闸打底。听见了吗？日志不是事后补的日记，是循环的副产物——写进 loop，自动记。关掉聊天窗口，只打开 log.jsonl，还能说出第几轮调了什么，才算有案底。来，对照屏幕：多 turn 可见，才叫闭环证据，对吧。

文稿：`video/scripts/narration/05-runs-log.txt`

---

## 06 · three-tasks

**PPT（屏幕）**
- 眉题：06 TASKS · 闭环实测三任务
- 讲解图：agent-loop.svg
- A 该调工具 · B 不该乱调
- C 模糊指令 · 记选错图谱

**口播**
> 挂上去，测三个任务，别只测 happy path。任务 A：「根据最新列表生成周报」——期望模型调 `skill` 或 `file_read`，别空口编数据。任务 B：「现在几点了」——期望不乱调业务 Skill。任务 C：模糊指令，观察它选什么，记进选错图谱。有同学可能会说：C 模糊了选错也正常啊。正常，所以要记——选错正是今天要抓的边界。听见了吗？CLI 或 curl 能演示 loop 就行，UI 接线是第十天的事；今天先把「会转、会停、会留痕」做实。改完工具描述或 system prompt，同一条任务必须重测，嘛。

文稿：`video/scripts/narration/06-three-tasks.txt`

---

## 07 · close

**PPT（屏幕）**
- 眉题：07 TAKEAWAY · 心里过三问
- 讲解图：harness-anatomy.svg
- loop.py · max_turns · log.jsonl
- 预告：明天 task_runner + HITL

**口播**
> 同学们，本节先到这里。我问三句，你们心里答得上，这节才算听明白。第一：loop 一轮的顺序是什么？第二：max_turns 超限该怎样？第三：log.jsonl 里至少能看见什么？含糊就回看提示词 04 和伪代码。带走一句——Skill 是工具，loop 才是让工具连着干活的发动机；发动机在你自己的仓库里，不在别人家的产品里。下一节第八天验收前，把多 turn 日志存好；明天第九天，咱们上长任务和确认闸，对吧。

文稿：`video/scripts/narration/07-close.txt`

---

## 评审清单

- [x] PPT 无口播正文，仅图 + 概念卡/表
- [x] 口播与 `narration/*.txt` 一致
- [ ] TTS 后 patch 时间轴并重渲
