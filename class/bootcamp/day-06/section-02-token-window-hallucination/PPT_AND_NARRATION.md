# 第六天 · 第 2 节 · Token / 窗口 / 幻觉：能力与边界

路径：`class/bootcamp/day-06/section-02-token-window-hallucination/video/`  
PPT：`video/index.html`（**仅讲解图 + 概念要点，无口播正文**）  
分词稿：`video/scripts/narration/`

> 口播以分词稿为准 · TTS 后需重跑 `patch_section_video_timing.py`

---

## 01 · open

**PPT（屏幕）**
- 眉题：01 OPEN · Token · 窗口 · 幻觉
- 讲解图：llm-capability.svg
- 副标题：max_tokens / usage · 对话越长越贵越慢

**口播**
> 同学们，上一节咱们把生态四层地图铺开了，对吧。这一节呢，往下扎一层——三个绑在一起的词：Token、上下文窗口，还有幻觉。你们调 API 的时候，是不是老看见 max_tokens、usage 这些字段？以前可能就当数字滑过去了；今天搞懂它，以后就不会奇怪：为啥对话越长越贵、越慢，为啥模型有时候说得跟真的一样、查起来却是编的。记一句：Token 是钱也是注意力，窗口是硬顶，幻觉是机制——三件绑在一起看，嘛。

文稿：`video/scripts/narration/01-open.txt`

---

## 02 · token

**PPT（屏幕）**
- 眉题：02 TOKEN
- 三卡：最小单位 · 按 Token 计费 · 压缩 Prompt 省钱
- 例子：Cursor 贴整份 repo = 烧 Token

**口播**
> 先说 Token。它呢，是模型读写的最小单位——不是一个汉字那么简单。英文大概一个词算一个 Token，中文呢，半个字到一个字不等。你往 Cursor 里贴整份仓库、整份 PRD，那是在烧 Token，对吧。API 按输入加输出一起计费，所以咱们写 Prompt 得省：废话清掉、格式写清，是真省钱。打个比方，Token 就像手机流量——不是字数，是模型眼里切出来的块，用完了就得掏钱，嘛。

文稿：`video/scripts/narration/02-token.txt`

---

## 03 · window

**PPT（屏幕）**
- 眉题：03 WINDOW · 上下文窗口
- 讲解图：context-assembly.svg
- 满了：截断 / 摘要 / RAG（下节）

**口播**
> 第二个词，上下文窗口。就是一次调用里，模型能「看见」的上限——Claude 常见二十万 Token 量级，GPT-4o 一百二十八 K，听着很大，对吧。但你把 PRD、架构、接口契约、聊天记录全塞进去，很快就顶了。满了咋办？三条路：截掉最早的对话；先让模型自己摘要再喂回去；或者 RAG，只检索相关片段——下一节细讲。窗口满了不是模型变笨，是装不下了，得会装填，呢。

文稿：`video/scripts/narration/03-window.txt`

---

## 04 · hallucination

**PPT（屏幕）**
- 眉题：04 HALLUCINATION
- 三卡：最像真的答案 · 会编 DOI · FDE 铁律可溯源

**口播**
> 第三个，幻觉。别被英文吓到——就是模型给「最像真的」答案，不是核实过的。你问一篇不存在的论文，它也能编一个像模像样的 DOI——这不是偶发 bug，是机制：它训练的目标是接龙顺，不是查档案。所以 FDE 的铁律：关键事实必须可溯源，RAG 或数据库喂真材料，输出还得验收。盲信模型，在驾驶舱里就是事故，对吧。

文稿：`video/scripts/narration/04-hallucination.txt`

---

## 05 · boundary

**PPT（屏幕）**
- 眉题：05 BOUNDARY · 能力边界
- 三卡：擅长生成 · 不擅长实时/精确/私有 · 输出须验收

**口播**
> 再收一下能力边界。擅长啥？模式匹配、语言生成、结构化输出——摘要、改写、问答，这些它又快又稳。不擅长啥？实时股价、精确大数计算、你们公司没训练过的私有事实——硬塞就翻车。第五天那个摘要接口，模型写得好不好，你得对照 Rubric，不能「看着挺像」就上线。知道它几斤几两，才能用对地方，嘛。

文稿：`video/scripts/narration/05-boundary.txt`

---

## 06 · close

**PPT（屏幕）**
- 眉题：06 TAKEAWAY
- 标签：Token=钱+注意力 · 窗口=硬顶 · 幻觉=常态→验收
- 预告：Prompt / RAG

**口播**
> 好，第二节收一下。带走三词：Token 是钱也是注意力；窗口是一次能看的硬顶；幻觉是常态，所以必须验收。下一节咱们讲 Prompt、Context、RAG——怎么把有限窗口用在刀刃上。同学们有问题，先翻讲解图，再回来听，对吧。

文稿：`video/scripts/narration/06-close.txt`

---

## 评审清单

- [x] PPT 无口播正文，仅图 + 概念卡/表
- [x] 口播与 `narration/*.txt` 一致
- [ ] TTS 后 patch 时间轴并重渲
