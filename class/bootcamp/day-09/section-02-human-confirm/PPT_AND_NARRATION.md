# 第九天 · 第 2 节 · 人工确认与执行记录

路径：`class/bootcamp/day-09/section-02-human-confirm/video/`  
PPT：`video/index.html`（**仅讲解图 + 概念要点，无口播正文**）  
分词稿：`video/scripts/narration/`

> 口播以分词稿为准 · TTS 后需重跑 `patch_section_video_timing.py`

---

## 01 · open

**PPT（屏幕）**
- 眉题：01 OPEN
- 讲解图：orchestration-confirm.svg
- 确认闸最大的敌人是点确定大赛

**口播**
> 同学们好，我是你们的老师404。确认闸最大的敌人不是 AI，是点确定大赛——弹得多了，人看都不看就批。所以闸不能装样子，得按工程设计来做。今天咱们把确认点怎么设计、日志怎么记，一次讲透，对吧。

文稿：`video/scripts/narration/01-open.txt`

---

## 02 · gate-three

**PPT（屏幕）**
- 眉题：02 GATE THREE
- 讲解图：orchestration-confirm.svg
- 确认闸三问

**口播**
> 确认闸设计时必答三问。看什么？给决策所需的最低信息——草稿加关键数字加风险标红，不是一坨原始日志。谁来看？有责的那个人，训练营里就是你自己。多久看一次？这个咱们下一节讲信任分级。

文稿：`video/scripts/narration/02-gate-three.txt`

---

## 03 · trust-tier

**PPT（屏幕）**
- 眉题：03 TRUST TIER
- 讲解图：orchestration-confirm.svg
- 信任分级：新上线 → 抽看 → 定期审计

**口播**
> 信任分级呢，新上线每次都看；连续十次通过，改成抽看三分之一；稳定期抽看加定期审计。这就是第七天攒的信任额度兑现的地方——不是偷懒，是风险管理。弹窗太多人会麻木，分级就是治这个，对吧。

文稿：`video/scripts/narration/03-trust-tier.txt`

---

## 04 · exec-log

**PPT（屏幕）**
- 眉题：04 EXEC LOG
- 讲解图：orchestration-confirm.svg
- 执行日志：时间、动作、结果

**口播**
> 再说执行日志，每步一条：时间、动作、结果。出事故时它能回答三个问题——什么时候、谁干的、干成了什么。没有日志的团队，出事只能靠回忆和甩锅，咱们可不走那条路，对吧。

文稿：`video/scripts/narration/04-exec-log.txt`

---

## 05 · trust-engineering

**PPT（屏幕）**
- 眉题：05 TRUST ENGINEERING
- 讲解图：orchestration-confirm.svg
- 确认点 + 日志 = 信任的工程设计

**口播**
> 同学们，本节先到这里。反模式也记一下：信息不足逼人盲批、一天弹二十次麻木、批了没记录互相甩锅。避开这三条，你的闸才拦得住。同学们带走一句——确认点加日志，等于信任的工程设计，这个得记牢。

文稿：`video/scripts/narration/05-trust-engineering.txt`

---

## 评审清单

- [x] PPT 无口播正文，仅图 + 概念卡/表
- [x] 口播与 `narration/*.txt` 一致
- [ ] TTS 后 patch 时间轴并重渲
