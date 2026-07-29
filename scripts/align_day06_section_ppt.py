#!/usr/bin/env python3
"""Align Day06 S02-S06 video/index.html with S01 standard (diagrams + cards, no oral in PPT)."""

from __future__ import annotations

import json
import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DIAG_SRC = ROOT / "class/assets/diagrams"
BOOT = ROOT / "class/bootcamp/day-06"
GAP = 0.25
CPS = 4.5

CSS = r"""
@font-face{font-family:"Noto Sans SC";src:url("assets/fonts/NotoSansSC-Regular.woff2") format("woff2");font-weight:400;font-display:block}
@font-face{font-family:"Noto Sans SC";src:url("assets/fonts/NotoSansSC-Bold.woff2") format("woff2");font-weight:700;font-display:block}
@font-face{font-family:"Noto Serif SC";src:url("assets/fonts/NotoSerifSC-Bold.woff2") format("woff2");font-weight:700;font-display:block}
@font-face{font-family:"JetBrains Mono";src:url("assets/fonts/JetBrainsMono-Bold.woff2") format("woff2");font-weight:700;font-display:block}
:root{--bg:#f2f5f0;--ink:#231f20;--ink-60:rgba(35,31,32,.72);--accent:#1400ff;--serif:"Noto Serif SC",serif;--sans:"Noto Sans SC",sans-serif;--mono:"JetBrains Mono",monospace}
*{margin:0;padding:0;box-sizing:border-box}
html{margin:0;background:#111}
html.browser-preview{overflow:hidden;height:100%}
body{margin:0;width:1920px;height:1080px;overflow:hidden;background:#000;font-family:var(--sans);color:var(--ink)}
#root{position:relative;width:1920px;height:1080px;overflow:hidden}
.stage-bg{position:absolute;inset:0;background:var(--bg);z-index:0}
.slide{position:absolute;inset:0;z-index:2;padding:72px 420px 72px 96px}
.stage-fill{position:absolute;inset:0;background:var(--bg);z-index:0}
.slide-body{position:relative;z-index:2;height:100%;display:flex;flex-direction:column}
.sec-label{font-family:var(--mono);font-size:15px;letter-spacing:.18em;text-transform:uppercase;color:var(--ink-60);display:flex;align-items:center;gap:14px;margin-bottom:18px}
.sec-label::after{content:"";flex:1;height:6px;background:var(--ink);max-width:520px}
.sec-label .num{color:var(--accent);font-weight:700}
.display{font-family:var(--serif);font-weight:700;font-size:64px;line-height:1.12;margin-bottom:14px;max-width:14ch}
.subtitle{font-size:20px;line-height:1.5;color:var(--ink-60);max-width:30em;margin-bottom:12px}
.card-row{display:flex;flex-wrap:wrap;gap:14px;margin-top:8px}
.card{border:1px solid var(--ink);padding:16px 20px;background:#fff;min-width:180px;flex:1}
.card .k{font-family:var(--mono);font-size:11px;letter-spacing:.12em;color:var(--ink-60);margin-bottom:8px}
.card strong{font-size:18px;display:block;margin-bottom:6px}
.card span{font-size:15px;color:var(--ink-60);line-height:1.45}
.compare{display:grid;grid-template-columns:1fr 1fr;gap:0;border:1px solid var(--ink);max-width:920px;margin-top:8px}
.compare-col{padding:20px 24px;background:#fff}
.compare-col:first-child{border-right:1px solid var(--ink)}
.compare-col h3{font-family:var(--mono);font-size:13px;letter-spacing:.14em;margin-bottom:12px;color:var(--accent)}
.compare-col ul{list-style:none;font-size:16px;line-height:1.65;color:var(--ink-60)}
.compare-col li::before{content:"· ";color:var(--accent);font-weight:700}
.flow{display:flex;align-items:stretch;gap:0;margin-top:12px;max-width:960px;border:1px solid var(--ink)}
.flow-step{flex:1;padding:18px 16px;background:#fff;border-right:1px solid var(--ink);font-size:15px;line-height:1.5}
.flow-step:last-child{border-right:none}
.flow-step .k{font-family:var(--mono);font-size:11px;letter-spacing:.12em;color:var(--accent);margin-bottom:8px}
.checklist{border:1px solid var(--ink);background:#fff;margin-top:12px;max-width:920px}
.checklist li{list-style:none;padding:14px 20px;border-bottom:1px solid rgba(35,31,32,.12);font-size:17px;display:flex;gap:12px;align-items:flex-start}
.checklist li:last-child{border-bottom:none}
.checklist li::before{content:"□";font-family:var(--mono);color:var(--accent);font-weight:700;flex:none}
.diagram-box{border:1px solid var(--ink);padding:12px;background:#fff;margin-top:8px;flex:1;display:flex;flex-direction:column;min-height:0}
.diagram-box .dg-cap{font-family:var(--mono);font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--ink-60);margin-bottom:8px;flex:none}
.diagram-box img{width:100%;flex:1;object-fit:contain;display:block;min-height:0;max-height:520px}
.diagram-full .diagram-box{border:none;padding:0;background:transparent;margin:0}
.diagram-full img{max-height:720px}
.tag-row{display:flex;flex-wrap:wrap;gap:10px;margin-top:16px}
.tag{font-family:var(--mono);font-size:13px;padding:10px 16px;border:1px solid var(--ink);background:#fff}
.tag.hl{background:var(--accent);color:#fff;border-color:var(--accent)}
.brand-bar{position:absolute;left:96px;bottom:36px;z-index:20;font-family:var(--mono);font-size:13px;letter-spacing:.16em;text-transform:uppercase;color:rgba(35,31,32,.55)}
.brand-bar em{font-style:normal;color:var(--accent)}
#avatar-pip{position:absolute;right:40px;bottom:36px;z-index:30;width:248px;height:380px;display:flex;flex-direction:column}
.avatar-frame{flex:1;overflow:hidden;border:2px solid var(--ink);border-bottom:none;box-shadow:8px 8px 0 var(--accent);background:#0b1220}
.avatar-frame video{width:100%;height:100%;object-fit:cover;object-position:50% 22%;display:block}
.avatar-caption{height:30px;line-height:30px;font-family:var(--mono);font-size:11px;letter-spacing:.12em;text-transform:uppercase;text-align:center;background:var(--ink);color:#f2f5f0;border:2px solid var(--ink);border-top:none}
.speak-ring{position:absolute;inset:-8px;border:2px solid var(--accent);opacity:.35;pointer-events:none}
#preview-hint{position:fixed;left:12px;top:12px;z-index:9999;font:12px/1.4 var(--mono);color:#fff;background:rgba(0,0,0,.72);padding:8px 12px;border-radius:4px;display:none;pointer-events:none}
html.browser-preview #preview-hint{display:block}
"""

PREVIEW_JS = r"""
(function bootBrowserPreview() {
  const params = new URLSearchParams(location.search);
  const renderMode = params.get("render") === "1";
  const isDirect = !renderMode && (location.protocol === "file:" || params.has("preview"));
  if (!isDirect) { tl.seek(1); return; }
  document.documentElement.classList.add("browser-preview");
  const slidesEls = [...document.querySelectorAll(".slide")];
  let idx = 0;
  function fit() {
    const s = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
    document.body.style.transform = "scale(" + s + ")";
    document.body.style.transformOrigin = "top left";
  }
  function reveal(el) {
    gsap.set(el.querySelectorAll(".slide-body, [data-anim]"), { opacity: 1, y: 0, clearProps: "transform" });
  }
  function show(i) {
    slidesEls.forEach((el, j) => { el.style.visibility = j === i ? "visible" : "hidden"; });
    reveal(slidesEls[i]);
  }
  gsap.set("#avatar-pip", { opacity: 1, y: 0 });
  fit(); show(0);
  window.addEventListener("resize", fit);
  window.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight" || e.key === " ") { idx = Math.min(idx + 1, slidesEls.length - 1); show(idx); e.preventDefault(); }
    if (e.key === "ArrowLeft") { idx = Math.max(idx - 1, 0); show(idx); }
  });
})();
"""


def esc(s: str) -> str:
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")


def cards_html(cards: list[tuple[str, str, str]]) -> str:
    parts = ['<div class="card-row" data-anim="diagram">']
    for k, strong, span in cards:
        parts.append(
            f'<div class="card"><div class="k">{esc(k)}</div><strong>{esc(strong)}</strong>'
            f"<span>{esc(span)}</span></div>"
        )
    parts.append("</div>")
    return "\n      ".join(parts)


def compare_html(left: tuple[str, list[str]], right: tuple[str, list[str]]) -> str:
    def col(title, items):
        lis = "".join(f"<li>{esc(i)}</li>" for i in items)
        return f'<div class="compare-col"><h3>{esc(title)}</h3><ul>{lis}</ul></div>'

    return f'<div class="compare" data-anim="diagram">{col(*left)}{col(*right)}</div>'


def flow_html(steps: list[tuple[str, str]]) -> str:
    parts = ['<div class="flow" data-anim="diagram">']
    for k, text in steps:
        parts.append(f'<div class="flow-step"><div class="k">{esc(k)}</div>{esc(text)}</div>')
    parts.append("</div>")
    return "\n      ".join(parts)


def checklist_html(items: list[str]) -> str:
    lis = "".join(f"<li>{esc(i)}</li>" for i in items)
    return f'<ul class="checklist" data-anim="diagram">{lis}</ul>'


def tags_html(tags: list[tuple[str, bool]]) -> str:
    parts = ['<div class="tag-row" data-anim="diagram">']
    for text, hl in tags:
        cls = "tag hl" if hl else "tag"
        parts.append(f'<span class="{cls}">{esc(text)}</span>')
    parts.append("</div>")
    return "\n      ".join(parts)


def diagram_html(caption: str, svg: str, full: bool = False) -> str:
    cls = "diagram-box"
    return (
        f'<div class="{cls}" data-anim="diagram">'
        f'<div class="dg-cap">{esc(caption)}</div>'
        f'<img src="assets/diagrams/{svg}" alt="{esc(caption)}" />'
        f"</div>"
    )


def slide_body(slide: dict) -> str:
    sid = slide["id"]
    num = slide["num"]
    label = slide["label"]
    headline = slide["headline"]
    extra_class = " diagram-full" if slide.get("full") else ""
    lines = [
        f'<section id="slide-{sid}" class="clip slide{extra_class}" data-track-index="1" '
        f'data-start="{slide["start"]}" data-duration="{slide["dur"]}">',
        '  <div class="stage-fill"></div>',
        '  <div class="slide-body">',
        f'    <div class="sec-label" data-anim="k"><span class="num">{num}</span>{esc(label)}</div>',
    ]
    h_size = slide.get("h_size", 64)
    h_style = f' style="font-size:{h_size}px"' if h_size != 64 else ""
    if "<br/>" in headline or len(headline) <= 16:
        lines.append(f'    <h1 class="display"{h_style} data-anim="t">{headline}</h1>')
    else:
        short = headline[:14] + "…" if len(headline) > 14 else headline
        lines.append(f'    <h1 class="display"{h_style} data-anim="t">{esc(short)}</h1>')
    if slide.get("subtitle"):
        lines.append(f'    <p class="subtitle" data-anim="s">{esc(slide["subtitle"])}</p>')
    if slide.get("cards"):
        lines.append(f"    {cards_html(slide['cards'])}")
    if slide.get("compare"):
        lines.append(f"    {compare_html(*slide['compare'])}")
    if slide.get("flow"):
        lines.append(f"    {flow_html(slide['flow'])}")
    if slide.get("checklist"):
        lines.append(f"    {checklist_html(slide['checklist'])}")
    if slide.get("tags"):
        lines.append(f"    {tags_html(slide['tags'])}")
    if slide.get("diagram"):
        cap, svg = slide["diagram"]
        lines.append(f"    {diagram_html(cap, svg)}")
    if slide.get("subtitle2"):
        lines.append(f'    <p class="subtitle" style="margin-top:18px" data-anim="s">{esc(slide["subtitle2"])}</p>')
    lines += ["  </div>", "</section>"]
    return "\n".join(lines)


SECTIONS = [
    {
        "dir": "section-02-token-window-hallucination",
        "yaml": "day06_s02.yaml",
        "title": "第六天 · 第 2 节 · Token / 窗口 / 幻觉",
        "md_title": "第六天 · 第 2 节 · Token / 窗口 / 幻觉：能力与边界",
        "brand": "第六天 · 第 2 节",
        "diagrams": ["llm-capability.svg", "model-gateway.svg", "context-assembly.svg"],
        "slides_meta": [
            {"id": "01-open", "label": "OPEN", "ppt": ["眉题：01 OPEN · Token · 窗口 · 幻觉", "讲解图：llm-capability.svg", "副标题：max_tokens / usage · 对话越长越贵越慢"]},
            {"id": "02-token", "label": "TOKEN", "ppt": ["眉题：02 TOKEN", "三卡：最小单位 · 按 Token 计费 · 压缩 Prompt 省钱", "例子：Cursor 贴整份 repo = 烧 Token"]},
            {"id": "03-window", "label": "WINDOW", "ppt": ["眉题：03 WINDOW · 上下文窗口", "讲解图：context-assembly.svg", "满了：截断 / 摘要 / RAG（下节）"]},
            {"id": "04-hallucination", "label": "HALLUCINATION", "ppt": ["眉题：04 HALLUCINATION", "三卡：最像真的答案 · 会编 DOI · FDE 铁律可溯源"]},
            {"id": "05-boundary", "label": "BOUNDARY", "ppt": ["眉题：05 BOUNDARY · 能力边界", "三卡：擅长生成 · 不擅长实时/精确/私有 · 输出须验收"]},
            {"id": "06-close", "label": "TAKEAWAY", "ppt": ["眉题：06 TAKEAWAY", "标签：Token=钱+注意力 · 窗口=硬顶 · 幻觉=常态→验收", "预告：Prompt / RAG"]},
        ],
        "slides": [
            {"id": "01-open", "num": "01", "label": "OPEN", "headline": "Token<br/>窗口<br/>幻觉", "subtitle": "API 里的 max_tokens · usage · 对话越长越贵越慢", "diagram": ("讲解图 · LLM 能力与边界", "llm-capability.svg")},
            {"id": "02-token", "num": "02", "label": "TOKEN", "headline": "Token", "subtitle": "模型读写的最小单位（≠ 一个字）", "cards": [("英文", "≈ 1 词", "大约一个词"), ("中文", "≈ ½–1 字", "大约半个到一个字"), ("计费", "输入 + 输出", "按 Token 计费")], "subtitle2": "压缩 Prompt · 少贴整份 repo"},
            {"id": "03-window", "num": "03", "label": "WINDOW", "headline": "上下文窗口", "subtitle": "一次能看到的 Token 硬顶", "cards": [("Claude 3.5", "≈ 200K", "常见上限"), ("GPT-4o", "≈ 128K", "常见上限"), ("满了", "截断 · 摘要 · RAG", "PRD+架构+契约+聊天")], "diagram": ("讲解图 · Context 装填", "context-assembly.svg")},
            {"id": "04-hallucination", "num": "04", "label": "HALLUCINATION", "headline": "幻觉", "subtitle": "Hallucination · 机制不是偶发 bug", "cards": [("机制", "最像真的答案", "不是核实过的"), ("例子", "编造 DOI", "问不存在的论文也编"), ("FDE", "关键事实可溯源", "RAG 或人工验收")], "h_size": 56},
            {"id": "05-boundary", "num": "05", "label": "BOUNDARY", "headline": "能力边界", "cards": [("擅长", "模式匹配", "语言生成"), ("不擅长", "实时数据", "精确计算 · 私有事实"), ("必须", "输出验收", "对照 Rubric")], "subtitle2": "驾驶舱摘要：写得好不好你来判"},
            {"id": "06-close", "num": "06", "label": "TAKEAWAY", "headline": "带走三词", "h_size": 56, "tags": [("Token = 钱 + 注意力", True), ("窗口 = 硬顶", False), ("幻觉 = 常态 → 验收", False)], "subtitle2": "下一节：Prompt · Context · RAG"},
        ],
    },
    {
        "dir": "section-03-prompt-context-rag",
        "yaml": "day06_s03.yaml",
        "title": "第六天 · 第 3 节 · Prompt / Context / RAG",
        "md_title": "第六天 · 第 3 节 · Prompt / Context / RAG / Fine-tune vs Prompt",
        "brand": "第六天 · 第 3 节",
        "diagrams": ["prompt-four-elements.svg", "context-assembly.svg", "llm-capability.svg"],
        "slides_meta": [
            {"id": "01-open", "label": "OPEN", "ppt": ["眉题：01 OPEN · 四词总览", "Prompt · Context · RAG · Fine-tune", "设计一次调用的「视野」"]},
            {"id": "02-prompt", "label": "PROMPT", "ppt": ["眉题：02 PROMPT · 任务说明书", "讲解图：prompt-four-elements.svg", "角色 · 背景 · 任务 · 约束 · 格式"]},
            {"id": "03-context", "label": "CONTEXT", "ppt": ["眉题：03 CONTEXT · 装填术", "讲解图：context-assembly.svg", "给少了瞎编 · 给多了迷失"]},
            {"id": "04-rag", "label": "RAG", "ppt": ["眉题：04 RAG · 检索增强", "流程：切块 → 嵌入 → 检索 → 拼 Prompt → 生成", "驾驶舱摘要 = 简化版 RAG"]},
            {"id": "05-finetune", "label": "FINETUNE", "ppt": ["眉题：05 FINE-TUNE vs PROMPT", "双列：改权重（贵慢）vs 改话术（快便宜）", "90% 场景先用 Prompt"]},
            {"id": "06-close", "label": "TAKEAWAY", "ppt": ["眉题：06 TAKEAWAY", "Prompt=说明书 · Context=装填 · RAG=外挂记忆", "预告：Eval · Guardrails"]},
        ],
        "slides": [
            {"id": "01-open", "num": "01", "label": "OPEN", "headline": "Prompt<br/>Context<br/>RAG", "subtitle": "从写一段话 → 设计一次调用的视野", "tags": [("Prompt", False), ("Context Engineering", False), ("RAG", False), ("Fine-tuning", False)]},
            {"id": "02-prompt", "num": "02", "label": "PROMPT", "headline": "Prompt 工程", "subtitle": "给模型的任务说明书", "diagram": ("讲解图 · Prompt 四要素", "prompt-four-elements.svg"), "cards": [("坏", "格式不清", "约束缺失"), ("好", "工程师不用问第二遍", "可迭代 · 可验收")]},
            {"id": "03-context", "num": "03", "label": "CONTEXT", "headline": "Context 装填", "subtitle": "这次调用放什么进窗口？", "diagram": ("讲解图 · Context 组装", "context-assembly.svg"), "cards": [("给少了", "模型瞎编", "信息不足"), ("给多了", "迷失中间", "窗口浪费")]},
            {"id": "04-rag", "num": "04", "label": "RAG", "headline": "RAG", "subtitle": "检索增强生成 · 治幻觉主流药方", "flow": [("① 切块", "资料库文档"), ("② 嵌入", "向量 / 关键词"), ("③ 检索", "捞相关片段"), ("④ 生成", "基于片段回答")], "subtitle2": "驾驶舱本周摘要 = 简化版 RAG"},
            {"id": "05-finetune", "num": "05", "label": "FINETUNE", "headline": "Fine-tune<br/>vs Prompt", "compare": (("Fine-tuning", ["改模型权重", "贵 · 慢 · 持久", "固定风格/格式"]), ("Prompting", ["改给模型的话", "快 · 便宜", "90% 场景够用"]))},
            {"id": "06-close", "num": "06", "label": "TAKEAWAY", "headline": "收束", "h_size": 56, "tags": [("Prompt → 说明书", True), ("Context → 装填", False), ("RAG → 外挂记忆", False), ("Fine-tune → 最后手段", False)], "subtitle2": "下一节：Eval · Guardrails · Vibe Coding"},
        ],
    },
    {
        "dir": "section-04-eval-guardrails-vibe",
        "yaml": "day06_s04.yaml",
        "title": "第六天 · 第 4 节 · Eval / Guardrails / Vibe",
        "md_title": "第六天 · 第 4 节 · Eval / Guardrails / Vibe Coding",
        "brand": "第六天 · 第 4 节",
        "diagrams": ["llm-ops-triangle.svg", "exception-taxonomy.svg", "orchestration-confirm.svg"],
        "slides_meta": [
            {"id": "01-open", "label": "OPEN", "ppt": ["眉题：01 OPEN · 三词命名", "Eval · Guardrails · Vibe Coding", "带验收的 vibe coding"]},
            {"id": "02-eval", "label": "EVAL", "ppt": ["眉题：02 EVAL · 出考卷", "固定题库 · 明确判分 · 可重复跑", "20 条边界 case · 改版重跑"]},
            {"id": "03-guardrails", "label": "GUARDRAILS", "ppt": ["眉题：03 GUARDRAILS · 护栏", "讲解图：exception-taxonomy.svg", "敏感词 · 空结果 · 超时 · 三条降级"]},
            {"id": "04-vibe", "label": "VIBE", "ppt": ["眉题：04 VIBE CODING", "Cursor / Copilot / Claude Code", "会 vibe + 验收 → 变贵；只 vibe → 技术债"]},
            {"id": "05-triangle", "label": "TRIANGLE", "ppt": ["眉题：05 三角关系", "讲解图：llm-ops-triangle.svg", "Eval=好不好 · Guardrails=敢不敢 · Vibe=杠杆"]},
            {"id": "06-close", "label": "TAKEAWAY", "ppt": ["眉题：06 TAKEAWAY", "「我觉得还行」≠ 验收标准", "预告：Agent · Harness · MCP"]},
        ],
        "slides": [
            {"id": "01-open", "num": "01", "label": "OPEN", "headline": "Eval<br/>Guardrails<br/>Vibe", "subtitle": "给已在做的做法命名 · 带验收的 vibe coding", "cards": [("Eval", "出考卷", "代替「我觉得还行」"), ("Guardrails", "护栏", "输入输出规则"), ("Vibe", "氛围编程", "AI 写 diff · 你来验收")]},
            {"id": "02-eval", "num": "02", "label": "EVAL", "headline": "Eval 评测", "subtitle": "给 AI 产物出考卷", "cards": [("方法", "固定题库", "明确判分 · 可重复"), ("朴素版", "Rubric", "快测选择题"), ("上线前", "20 条边界 case", "分数掉了别发版")]},
            {"id": "03-guardrails", "num": "03", "label": "GUARDRAILS", "headline": "Guardrails", "subtitle": "拦在输入输出上的规则", "diagram": ("讲解图 · 异常与降级路径", "exception-taxonomy.svg"), "cards": [("不许问", "敏感信息", "如他人工资"), ("不许答", "没检索到", "禁止瞎编政策"), ("越界", "拒答 · 转人工", "降级模板")]},
            {"id": "04-vibe", "num": "04", "label": "VIBE", "headline": "Vibe Coding", "subtitle": "描述意图 · AI 写代码", "cards": [("工具", "Cursor · Copilot", "Claude Code"), ("爽点", "生产力杠杆", "真的快"), ("验收", "不能 vibe", "200≠对契约 · 摘要对数据")], "subtitle2": "会 vibe + 验收 → 变贵"},
            {"id": "05-triangle", "num": "05", "label": "TRIANGLE", "headline": "三角关系", "diagram": ("讲解图 · Eval · Guardrails · Ops", "llm-ops-triangle.svg"), "cards": [("缺 Eval", "盲飞", ""), ("缺 Guardrails", "裸奔", ""), ("缺验收 Vibe", "技术债工厂", "")]},
            {"id": "06-close", "num": "06", "label": "TAKEAWAY", "headline": "带走一句", "h_size": 56, "subtitle": "「我觉得还行」不是验收标准，Eval 才是", "tags": [("Agent", False), ("Harness", False), ("MCP", False), ("Workflow", False)], "subtitle2": "下一节：Agent 全家桶"},
        ],
    },
    {
        "dir": "section-05-agent-harness-mcp",
        "yaml": "day06_s05.yaml",
        "title": "第六天 · 第 5 节 · Agent / Harness / MCP",
        "md_title": "第六天 · 第 5 节 · Agent / Harness / Tool / MCP / Workflow vs Agent",
        "brand": "第六天 · 第 5 节",
        "diagrams": ["agent-loop.svg", "harness-anatomy.svg", "workflow-vs-agent.svg", "skill-anatomy.svg"],
        "slides_meta": [
            {"id": "01-open", "label": "OPEN", "ppt": ["眉题：01 OPEN · 六词骨架", "Agent · Harness · Tool · MCP · Workflow · Copilot", "第二周 Skill 封装前先对齐名词"]},
            {"id": "02-agent", "label": "AGENT", "ppt": ["眉题：02 AGENT · 智能体", "讲解图：agent-loop.svg", "理解 → 规划 → 调工具 → 看结果 → 继续"]},
            {"id": "03-harness-tool", "label": "HARNESS", "ppt": ["眉题：03 HARNESS + TOOL", "讲解图：harness-anatomy.svg", "Tool Calling：结构化请求 → 执行 → 喂回"]},
            {"id": "04-mcp", "label": "MCP", "ppt": ["眉题：04 MCP · USB-C 标准", "讲解图：skill-anatomy.svg（Skill≈朴素 MCP）", "读 SKILL.md · 调工具 · 交付"]},
            {"id": "05-workflow", "label": "WORKFLOW", "ppt": ["眉题：05 WORKFLOW vs AGENT", "讲解图：workflow-vs-agent.svg", "写死流程 vs 现场决策"]},
            {"id": "06-copilot", "label": "COPILOT", "ppt": ["眉题：06 COPILOT vs AGENT", "双列：副驾补全 vs 自主多步", "Copilot 错一行 · Agent 错十文件"]},
            {"id": "07-close", "label": "TAKEAWAY", "ppt": ["眉题：07 TAKEAWAY · 六词口诀", "Agent决策 · Harness骨架 · Tool手 · MCP插座", "预告：18 词抽测"]},
        ],
        "slides": [
            {"id": "01-open", "num": "01", "label": "OPEN", "headline": "Agent<br/>全家桶", "subtitle": "六个词一次讲清 · 第二周 Skill 封装前对齐", "tags": [("Agent", True), ("Harness", False), ("Tool Calling", False), ("MCP", False), ("Workflow", False), ("Copilot", False)]},
            {"id": "02-agent", "num": "02", "label": "AGENT", "headline": "Agent 智能体", "subtitle": "能自己决定下一步的 AI", "diagram": ("讲解图 · Agent 决策环", "agent-loop.svg"), "cards": [("你定", "目的地 + 验收", ""), ("它选", "路线 + 工具", "Cursor Agent · Claude Code")]},
            {"id": "03-harness-tool", "num": "03", "label": "HARNESS", "headline": "Harness<br/>+ Tool", "diagram": ("讲解图 · Harness 解剖", "harness-anatomy.svg"), "cards": [("Harness", "模型外循环", "工具表 · 记忆 · 重试"), ("Tool Call", "结构化请求", "执行后结果喂回模型")]},
            {"id": "04-mcp", "num": "04", "label": "MCP", "headline": "MCP", "subtitle": "Model Context Protocol · 接工具的 USB-C", "diagram": ("讲解图 · Skill ≈ 朴素 MCP", "skill-anatomy.svg"), "cards": [("标准", "写一次多处插", "Cursor · Claude Desktop"), ("训练营", "读 SKILL.md", "调工具 · 交付结果")]},
            {"id": "05-workflow", "num": "05", "label": "WORKFLOW", "headline": "Workflow<br/>vs Agent", "diagram": ("讲解图 · 写死 vs 自主", "workflow-vs-agent.svg"), "compare": (("Workflow", ["人画死流程", "先 A 再 B 再 C", "报销审批"]), ("Agent", ["模型决定下一步", "多步 · 调工具", "乱文件 → PRD"]))},
            {"id": "06-copilot", "num": "06", "label": "COPILOT", "headline": "Copilot<br/>vs Agent", "compare": (("Copilot 副驾", ["补全 · 问答", "局部改写", "错了改一行"]), ("Agent 主驾", ["接任务 · 多步", "调工具 · 日志", "错了可能十文件"]))},
            {"id": "07-close", "num": "07", "label": "TAKEAWAY", "headline": "六词口诀", "h_size": 56, "tags": [("Agent → 决策", True), ("Harness → 骨架", False), ("Tool → 手", False), ("MCP → 插座", False), ("Workflow → 写死", False), ("Copilot → 副驾", False)], "subtitle2": "下一节：18 词抽测 · 认知卡过闸"},
        ],
    },
    {
        "dir": "section-06-accept-18words",
        "yaml": "day06_s06.yaml",
        "title": "第六天 · 第 6 节 · 18 词验收",
        "md_title": "第六天 · 第 6 节 · 验收：18 词抽测 + 认知卡过闸",
        "brand": "第六天 · 第 6 节",
        "diagrams": ["four-layer.svg", "llm-ecosystem.svg", "v2-panorama.svg", "ten-day-grid.svg"],
        "slides_meta": [
            {"id": "01-open", "label": "ACCEPT", "ppt": ["眉题：01 ACCEPT · LLM 理论日验收", "两关：18 词抽测 + 认知卡", "快测=没学 · 认知卡=没连起来"]},
            {"id": "02-quiz", "label": "QUIZ", "ppt": ["眉题：02 QUIZ · 第一关", "12/18 题过线 · 考理解不考背诵", "范围：今天六节 18 词"]},
            {"id": "03-card", "label": "CARD", "ppt": ["眉题：03 认知卡 llm-cognition-card.md", "讲解图：v2-panorama.svg", "六大主题 · 配前五天真例子"]},
            {"id": "04-gate", "label": "GATE", "ppt": ["眉题：04 过闸标准", "抽测≥12 · 认知卡齐全 · 能向同桌讲三个词", "过了才有 Week 2 共同语言"]},
            {"id": "05-close", "label": "GRADUATE", "ppt": ["眉题：05 GRADUATE", "18 词地图 · 词典是随身工具", "LLM 理论日 · 毕业"]},
        ],
        "slides": [
            {"id": "01-open", "num": "01", "label": "ACCEPT", "headline": "LLM 理论日<br/>验收", "subtitle": "两关：18 词抽测 + 认知卡", "cards": [("快测", "防「没学」", "12/18 过线"), ("认知卡", "防「没连起来」", "六大主题 + 真例子"), ("逻辑", "同理论地图", "理解 > 背诵")]},
            {"id": "02-quiz", "num": "02", "label": "QUIZ", "headline": "18 词抽测", "subtitle": "随机 12 题 · 对 12 题过线", "tags": [("生态四层", False), ("Token/幻觉", False), ("Prompt/RAG", False), ("Eval/护栏", False), ("Agent/MCP", False)], "subtitle2": "考理解 — 只能背定义说明要回看讲解图"},
            {"id": "03-card", "num": "03", "label": "CARD", "headline": "认知卡", "subtitle": "llm-cognition-card.md · 六大主题", "diagram": ("讲解图 · 18 词全景", "v2-panorama.svg"), "cards": [("要求", "2–3 条/主题", "不许抄课件"), ("例子", "PRD · 架构", "摘要接口 · Cursor 页面"), ("测试", "30 秒讲给同桌", "同桌能复述一句")]},
            {"id": "04-gate", "num": "04", "label": "GATE", "headline": "过闸标准", "checklist": ["抽测 ≥ 12 分", "认知卡六大主题齐全", "能口头解释任意三个词", "同桌能复述核心一句", "Week 2 Agent/Skill 共同语言"]},
            {"id": "05-close", "num": "05", "label": "GRADUATE", "headline": "毕业", "h_size": 56, "diagram": ("讲解图 · 十天训练营脉络", "ten-day-grid.svg"), "subtitle": "六天前 LLM 是黑话；今天你有 18 词地图", "subtitle2": "词典不是课文，是随身工具 — LLM 理论日，毕业"},
        ],
    },
]


def read_narration(section_dir: Path, seg_id: str) -> str:
    slug = seg_id.split("-", 1)[1] if "-" in seg_id else seg_id
    # try exact id file first
    for pattern in [f"{seg_id.split('-')[0]}-{slug}.txt", f"{seg_id}.txt"]:
        p = section_dir / "video/scripts/narration" / pattern
        if p.exists():
            return p.read_text(encoding="utf-8").strip()
    # manifest-based
    manifest = json.loads((section_dir / "video/scripts/narration/manifest.json").read_text())
    for item in manifest:
        if item["id"] == seg_id:
            return (section_dir / "video/scripts/narration" / item["file"]).read_text(encoding="utf-8").strip()
    raise FileNotFoundError(seg_id)


def estimate_durations(section_dir: Path, slide_ids: list[str]) -> list[float]:
    durs = []
    for sid in slide_ids:
        text = read_narration(section_dir, sid)
        durs.append(max(18, len(text) / CPS))
    return durs


def build_html(sec: dict, section_dir: Path) -> str:
    slide_ids = [s["id"] for s in sec["slides"]]
    durs = estimate_durations(section_dir, slide_ids)
    starts = []
    t = 0.0
    for d in durs:
        starts.append(round(t, 2))
        t += d + GAP
    total = round(starts[-1] + durs[-1], 2)

    for i, slide in enumerate(sec["slides"]):
        slide["start"] = starts[i]
        slide["dur"] = round(durs[i], 2)

    bodies = "\n\n".join(slide_body(s) for s in sec["slides"])
    gsap_slides = ",\n  ".join(
        f'{{ id: "#slide-{s["id"]}", start: {s["start"]}, dur: {s["dur"]} }}' for s in sec["slides"]
    )
    gsap_enter = "\n".join(f'  enter("#slide-{s["id"]}", {s["start"]});' for s in sec["slides"])
    gsap_exit = "\n".join(
        f'  exit("#slide-{s["id"]}", {round(s["start"] + s["dur"], 2)});' for s in sec["slides"]
    )

    return f"""<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>{esc(sec["title"])}</title>
<script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
<style>
{CSS}
</style>
</head>
<body>
<div id="preview-hint">浏览器预览 · ← → 或空格翻页</div>
<div id="root" data-composition-id="main" data-start="0" data-duration="{total}" data-width="1920" data-height="1080">
<div class="stage-bg"></div>

{bodies}

<div id="brand-bar" class="brand-bar clip" data-start="0" data-duration="{total}" data-track-index="2">FDE<em>·</em>训练营 <em>/</em> {esc(sec["brand"])}</div>
<div id="avatar-pip" class="clip" data-start="0" data-duration="{total}" data-track-index="5">
  <div class="speak-ring"></div>
  <div class="avatar-frame"><video id="avatar-lipsync" class="clip" src="assets/avatar-lipsync.mp4" muted playsinline preload="auto" data-start="0" data-duration="{total}" data-track-index="6"></video></div>
  <div class="avatar-caption">Lecturer · 口播</div>
</div>
<audio id="narration" class="clip" src="audio/narration-full.wav" data-start="0" data-duration="{total}" data-track-index="10" data-volume="1"></audio>
</div>
<script>
window.__timelines = window.__timelines || {{}};
const tl = gsap.timeline({{ paused: true }});
const slides = [
  {gsap_slides}
];
function enter(id, t0) {{
  tl.from(`${{id}} .slide-body`, {{ opacity: 0, y: 28, duration: 0.55, ease: "power3.out" }}, t0);
  tl.from(`${{id}} [data-anim='k']`, {{ y: 18, opacity: 0, duration: 0.4, ease: "power2.out" }}, t0 + 0.12);
  tl.from(`${{id}} [data-anim='t']`, {{ y: 36, opacity: 0, duration: 0.55, ease: "power3.out" }}, t0 + 0.22);
  tl.from(`${{id}} [data-anim='s']`, {{ y: 20, opacity: 0, duration: 0.45, ease: "power2.out" }}, t0 + 0.32);
  tl.from(`${{id}} [data-anim='diagram']`, {{ y: 16, opacity: 0, duration: 0.45, ease: "power2.out" }}, t0 + 0.42);
}}
function exit(id, tEnd) {{
  tl.to(`${{id}} .slide-body`, {{ opacity: 0, y: -18, duration: 0.4, ease: "power2.in" }}, tEnd - 0.45);
  tl.set(`${{id}} .slide-body`, {{ opacity: 0 }}, tEnd);
}}
{gsap_enter}
{gsap_exit}
tl.from("#avatar-pip", {{ opacity: 0, y: 28, duration: 0.7, ease: "power3.out" }}, 0.25);
window.__timelines["main"] = tl;
{PREVIEW_JS}
</script>
</body>
</html>
"""


def build_ppt_md(sec: dict, section_dir: Path) -> str:
    try:
        rel = section_dir.relative_to(ROOT / "class" / "bootcamp")
        path_line = f"路径：`class/bootcamp/{rel}/video/`  "
    except ValueError:
        path_line = f"路径：`class/bootcamp/day-06/{sec['dir']}/video/`  "
    lines = [
        f"# {sec['md_title']}",
        "",
        path_line,
        "PPT：`video/index.html`（**仅讲解图 + 概念要点，无口播正文**）  ",
        "分词稿：`video/scripts/narration/`",
        "",
        "> 口播以分词稿为准 · TTS 后需重跑 `patch_section_video_timing.py`",
        "",
        "---",
        "",
    ]
    for meta in sec["slides_meta"]:
        sid = meta["id"]
        slug = sid.split("-", 1)[1]
        oral = read_narration(section_dir, sid)
        lines += [
            f"## {sid.split('-')[0]} · {slug}",
            "",
            "**PPT（屏幕）**",
        ]
        for b in meta["ppt"]:
            lines.append(f"- {b}")
        lines += [
            "",
            "**口播**",
            f"> {oral}",
            "",
            f"文稿：`video/scripts/narration/{sid.split('-')[0]}-{slug}.txt`",
            "",
            "---",
            "",
        ]
    lines += [
        "## 评审清单",
        "",
        "- [x] PPT 无口播正文，仅图 + 概念卡/表",
        "- [x] 口播与 `narration/*.txt` 一致",
        "- [ ] TTS 后 patch 时间轴并重渲",
        "",
    ]
    return "\n".join(lines)


def update_yaml(sec: dict, section_dir: Path) -> None:
    yaml_path = ROOT / "scripts/section_narrations" / sec["yaml"]
    if not yaml_path.exists():
        return
    title_match = re.search(r'^title: "(.+)"', yaml_path.read_text(encoding="utf-8"), re.M)
    title = title_match.group(1) if title_match else sec["md_title"]
    lines = [f'title: "{title}"', "segments:"]
    for meta in sec["slides_meta"]:
        sid = meta["id"]
        oral = read_narration(section_dir, sid)
        lines.append(f'  - id: "{sid}"')
        lines.append("    ppt:")
        for p in meta["ppt"]:
            lines.append(f'      - "{p.replace(chr(34), chr(92)+chr(34))}"')
        lines.append("    text: |")
        for oline in oral.splitlines() or [""]:
            lines.append(f"      {oline}")
        if not oral.endswith("\n"):
            pass
    yaml_path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def copy_diagrams(sec: dict, section_dir: Path) -> None:
    dest = section_dir / "video/assets/diagrams"
    dest.mkdir(parents=True, exist_ok=True)
    for name in sec["diagrams"]:
        src = DIAG_SRC / name
        if src.exists():
            shutil.copy2(src, dest / name)


def main() -> None:
    for sec in SECTIONS:
        section_dir = BOOT / sec["dir"]
        copy_diagrams(sec, section_dir)
        html = build_html(sec, section_dir)
        (section_dir / "video/index.html").write_text(html, encoding="utf-8")
        md = build_ppt_md(sec, section_dir)
        (section_dir / "PPT_AND_NARRATION.md").write_text(md, encoding="utf-8")
        try:
            update_yaml(sec, section_dir)
        except Exception as e:
            print(f"yaml warn {sec['dir']}: {e}")
        print(f"OK {sec['dir']}")


if __name__ == "__main__":
    main()
