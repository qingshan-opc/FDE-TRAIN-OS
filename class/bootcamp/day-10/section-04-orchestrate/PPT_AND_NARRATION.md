# 第九天 · 第 4 节 · 长跑任务机 + 人在回路确认闸

路径：`class/bootcamp/day-10/section-04-orchestrate/video/`  
PPT：`video/index.html`（**仅讲解图 + 概念要点，无口播正文**）  
分词稿：`video/scripts/narration/`

> 口播以分词稿为准 · TTS 后需重跑 `patch_section_video_timing.py`

---

## 01 · open

**PPT（屏幕）**
- 眉题：01 OPEN · 长任务开工
- 讲解图：orchestration-confirm.svg
- 提示词 05 · task_runner.py
- 复用 loop · 写前停闸

**口播**
> 同学们好，我是你们的老师404。先问一句：昨天的 `loop.py` 能转几轮、日志看得见吗？想三秒。有同学可能会说：404老师，那今天再写一套循环？不是——今天在 loop 上面盖一层 `agent/task_runner.py`：一个业务 goal 拆成多 turn，写文件、改库、变更类 API 之前必须停下等人。整份粘贴提示词 05。工具表至少两件 Skill，goal 要能串到它们。不进平台 Lab，不靠外部编排产品——闸和证据都在你仓库的 `runs/` 里。来，看屏幕确认闸图，施工三件事：长跑、装闸、双路径留证，对吧。

文稿：`video/scripts/narration/01-open.txt`

---

## 02 · task-runner

**PPT（屏幕）**
- 眉题：02 RUNNER · run_goal 长跑
- 讲解图：orchestration-confirm.svg
- goal → while turns
- 复用 run_one_turn
- ≥3 turn 才算长

**口播**
> `run_goal` 怎么写？消息里塞 system_task 加用户 goal，然后 while 没超 max_turns：调昨天的 `run_one_turn`。结果 done 就 break；结果说需要人确认，就 pause。有同学可能会问：为啥不直接 while 调 llm？因为单轮纪律昨天已经写好了——tool_calls、回灌、记日志，今天复用，别复制粘贴两套。听见了吗？验收第一条：单个 goal 至少三轮 turn，不是「点一下出全文」。拉数、生成、再准备写入——三步都该在日志里看得见。来，对照屏幕伪代码，先把长跑骨架立起来，再往上面装闸，嘛。

文稿：`video/scripts/narration/02-task-runner.txt`

---

## 03 · hitl-gate

**PPT（屏幕）**
- 眉题：03 HITL · 写操作前停
- 讲解图：orchestration-confirm.svg
- needs_human_confirm = true
- 草稿 + 风险摆人前
- 你不批 · 它不动

**口播**
> HITL 硬性要求：任何写操作前，`needs_human_confirm` 必须为真——写文件、改数据库、调变更类接口，全算。Agent 把草稿、关键数字、风险标红摊开，等你 approve 或 reject。有同学可能会说：我信任模型啊。信任归信任，对外动作必须过闸——这是工程纪律，不是人情。API 最小集：启动任务、approve、reject；CLI 能演示也行。听见了吗？你不说话，流水线就停；它自作主张写出去了，说明闸没装进第一行。实测时故意沉默十秒，看它会不会偷跑，对吧。

文稿：`video/scripts/narration/03-hitl-gate.txt`

---

## 04 · approve-path

**PPT（屏幕）**
- 眉题：04 APPROVE · 批准路径
- 讲解图：orchestration-confirm.svg
- 到闸停 → 你批 → 继续写
- runs/ 留成功证据

**口播**
> 先跑批准路径：goal 跑起来，到闸自动停——你不批它就不动，这是第一个验收点。你发 approve，写操作才执行，日志记下谁批的、写到了哪。有同学可能会说：停了一下算不算过？算一半；还要查 `runs/` 里有没有确认行、写操作是不是批后才出现。听见了吗？批准路径绿了，别急着收工——只测批准，等于闸只装了一半。批准跑通后，在实测表第一行打勾，立刻测驳回。来，把成功路径的目录名记清楚，等会儿双证据要用，呢。

文稿：`video/scripts/narration/04-approve-path.txt`

---

## 05 · reject-path

**PPT（屏幕）**
- 眉题：05 REJECT · 驳回路径
- 讲解图：orchestration-confirm.svg
- reject → 停止或改计划
- 日志记原因 · 不装死

**口播**
> 第二条必测：驳回。你说 reject，附一句原因——比如「第二段数字不对」。流水线得停止或退回改计划，不能卡死，更不能假装批准继续写。有同学可能会问：驳回一次就算本事吧？不算——驳回了有记录、有状态、有下一步策略，这条线才有回路。没有回路的闸是断头路：人不敢驳，因为驳了没法交代。来，实测表上批准、驳回各打勾；驳回后界面或 CLI 状态要明确，别静默，对吧。

文稿：`video/scripts/narration/05-reject-path.txt`

---

## 06 · dual-evidence

**PPT（屏幕）**
- 眉题：06 EVIDENCE · 双路径留证
- 讲解图：orchestration-confirm.svg
- approve 成功 · 一份 runs/
- reject 中止 · 再一份 runs/
- 缺一边 = 闸没验收

**口播**
> 证据要成双：`runs/` 里同时保留 approve 成功路径与 reject 中止路径各一次。有同学可能会说：我口头演示过驳回了。口头不算——目录在、文件在、时间戳在，才叫证据。听见了吗？评委或互评同学打开两个目录，应能复述：一次你放行写进去了，一次你拦住停住了。缺一边，GATE 9 直接红。作业提交前扫一眼：两个路径的 goal 名、确认行、最终状态，别混在同一个文件夹里，到时候说不清，嘛。

文稿：`video/scripts/narration/06-dual-evidence.txt`

---

## 07 · log-replay

**PPT（屏幕）**
- 眉题：07 REPLAY · 只看日志复述
- 讲解图：orchestration-confirm.svg
- 停不停 · 动不动 · 回不回
- ≥2 Skill · ≥3 turn

**口播**
> 最后两分钟做日志回放：关掉别的窗口，只打开 `runs/`，复述今天发生了什么——几点开跑、第几轮调了哪个 Skill、何时要确认、你批了还是驳了。三个验收点：到闸停不停、批了动不动、驳了回不回得来或停得清。有同学可能会说：日志太长看不懂。那就失败了——每行只留时间、步骤、结果，别贴整段草稿。听见了吗？会跑长任务不够，会读日志才算 FDE 的运维眼。对照检查表：两件 Skill、三轮 turn、双路径，全绿再收工，对吧。

文稿：`video/scripts/narration/07-log-replay.txt`

---

## 08 · close

**PPT（屏幕）**
- 眉题：08 TAKEAWAY · 心里过三问
- 讲解图：orchestration-confirm.svg
- task_runner · HITL · 双证据
- 预告：明天 UI 接线

**口播**
> 同学们，本节先到这里。我问三句，你们心里答得上，这节才算听明白。第一：task_runner 和 loop 谁复用谁？第二：什么操作前必须停闸？第三：双路径证据缺一边算不算过？带走一句——长任务跑通不算完，批准加驳回都留证、日志能复述，才算交付。明天第十天，咱们把 chat、loop、task 接到页面上；今天把两份 `runs/` 存好，别关窗口就丢。

文稿：`video/scripts/narration/08-close.txt`

---

## 评审清单

- [x] PPT 无口播正文，仅图 + 概念卡/表
- [x] 口播与 `narration/*.txt` 一致
- [ ] TTS 后 patch 时间轴并重渲
