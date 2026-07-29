#!/usr/bin/env python3
"""Align bootcamp section PPT (Day 7+) with S01 standard: diagrams + cards, browser preview, no oral in slides."""

from __future__ import annotations

import argparse
import json
import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BOOT = ROOT / "class/bootcamp"
DIAG_SRC = ROOT / "class/assets/diagrams"
YAML_DIR = ROOT / "scripts/section_narrations"
GAP = 0.25
CPS = 4.5

DAY_NAMES = {
    6: "第六天", 7: "第七天", 8: "第八天", 9: "第九天", 10: "第十天",
}

DEFAULT_DIAGRAMS: dict[str, list[str]] = {
    "section-01-system-to-skill": ["five-blocks.svg", "skill-anatomy.svg"],
    "section-02-skill-anatomy": ["skill-anatomy.svg"],
    "section-03-pick-first": ["agentlab-five-steps.svg", "skill-anatomy.svg"],
    "section-04-define-skill": ["skill-anatomy.svg", "prompt-four-elements.svg"],
    "section-05-run-evidence": ["three-states.svg", "orchestration-confirm.svg"],
    "section-06-accept": ["skill-anatomy.svg", "harness-anatomy.svg"],
    "section-01-boundary-exceptions": ["exception-taxonomy.svg"],
    "section-02-harden-skill": ["skill-anatomy.svg", "exception-taxonomy.svg"],
    "section-03-agent-harness": ["harness-anatomy.svg", "agent-loop.svg", "workflow-vs-agent.svg"],
    "section-04-agent-calls-skill": ["harness-anatomy.svg", "skill-anatomy.svg", "agent-loop.svg"],
    "section-05-accept": ["agent-loop.svg", "skill-anatomy.svg", "v2-panorama.svg"],
    "section-01-process-as-orchestration": ["workflow-vs-agent.svg", "orchestration-confirm.svg"],
    "section-02-human-confirm": ["orchestration-confirm.svg", "exception-taxonomy.svg"],
    "section-03-two-more-skills": ["skill-anatomy.svg"],
    "section-04-orchestrate": ["orchestration-confirm.svg", "workflow-vs-agent.svg"],
    "section-05-accept-18words": [],
    "section-01-agent-in-cockpit": ["v2-panorama.svg", "five-blocks.svg"],
    "section-02-ten-evidences": ["v2-panorama.svg", "ten-day-grid.svg"],
    "section-03-defense-prep": ["v2-panorama.svg", "deploy-pipeline.svg"],
    "section-04-defense": ["v2-panorama.svg", "ten-day-grid.svg"],
    "section-05-two-week-review": ["ten-day-grid.svg", "v2-panorama.svg", "evolution-timeline.svg"],
}

SLUG_DIAGRAM_KEYWORDS: list[tuple[str, str]] = [
    ("harness", "harness-anatomy.svg"),
    ("decision-loop", "agent-loop.svg"),
    ("agent", "agent-loop.svg"),
    ("workflow", "workflow-vs-agent.svg"),
    ("orchestrat", "orchestration-confirm.svg"),
    ("confirm", "orchestration-confirm.svg"),
    ("human", "orchestration-confirm.svg"),
    ("boundary", "exception-taxonomy.svg"),
    ("exception", "exception-taxonomy.svg"),
    ("skill", "skill-anatomy.svg"),
    ("anatomy", "skill-anatomy.svg"),
    ("define", "skill-anatomy.svg"),
    ("run-evidence", "three-states.svg"),
    ("panorama", "v2-panorama.svg"),
    ("cockpit", "v2-panorama.svg"),
    ("defense", "v2-panorama.svg"),
    ("ten-evidence", "v2-panorama.svg"),
    ("review", "ten-day-grid.svg"),
    ("pick", "agentlab-five-steps.svg"),
    ("prompt", "prompt-four-elements.svg"),
    ("system", "five-blocks.svg"),
]

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
#preview-pager{position:fixed;right:12px;top:12px;z-index:9999;font:13px/1.4 var(--mono);color:#fff;background:rgba(20,0,255,.85);padding:8px 14px;border-radius:4px;display:none;pointer-events:none}
html.browser-preview #preview-hint,html.browser-preview #preview-pager{display:block}
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
    const pager = document.getElementById("preview-pager");
    if (pager) pager.textContent = (i + 1) + " / " + slidesEls.length;
  }
  gsap.set("#avatar-pip", { opacity: 1, y: 0 });
  fit(); show(0);
  window.addEventListener("resize", fit);
  document.getElementById("root").addEventListener("click", (e) => {
    if (e.target.closest("#avatar-pip")) return;
    idx = Math.min(idx + 1, slidesEls.length - 1);
    show(idx);
  });
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


def diagram_html(caption: str, svg: str) -> str:
    return (
        f'<div class="diagram-box" data-anim="diagram">'
        f'<div class="dg-cap">{esc(caption)}</div>'
        f'<img src="assets/diagrams/{svg}" alt="{esc(caption)}" />'
        f"</div>"
    )


def slide_body(slide: dict) -> str:
    sid = slide["id"]
    extra_class = " diagram-full" if slide.get("full") else ""
    lines = [
        f'<section id="slide-{sid}" class="clip slide{extra_class}" data-track-index="1" '
        f'data-start="{slide["start"]}" data-duration="{slide["dur"]}">',
        '  <div class="stage-fill"></div>',
        '  <div class="slide-body">',
        f'    <div class="sec-label" data-anim="k"><span class="num">{slide["num"]}</span>{esc(slide["label"])}</div>',
    ]
    h_size = slide.get("h_size", 64)
    h_style = f' style="font-size:{h_size}px"' if h_size != 64 else ""
    headline = slide["headline"]
    if "<br/>" in headline or len(headline) <= 18:
        lines.append(f'    <h1 class="display"{h_style} data-anim="t">{headline}</h1>')
    else:
        lines.append(f'    <h1 class="display"{h_style} data-anim="t">{esc(headline[:16])}…</h1>')
    if slide.get("subtitle"):
        lines.append(f'    <p class="subtitle" data-anim="s">{esc(slide["subtitle"])}</p>')
    if slide.get("cards"):
        lines.append(f"    {cards_html(slide['cards'])}")
    if slide.get("compare"):
        lines.append(f"    {compare_html(*slide['compare'])}")
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


def read_narration(section_dir: Path, seg_id: str) -> str:
    manifest_path = section_dir / "video/scripts/narration/manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    for item in manifest:
        if item["id"] == seg_id:
            return (section_dir / "video/scripts/narration" / item["file"]).read_text(encoding="utf-8").strip()
    raise FileNotFoundError(f"{section_dir.name}/{seg_id}")


def parse_lesson_diagrams(section_dir: Path) -> list[str]:
    lesson = section_dir / "lesson.md"
    if not lesson.exists():
        return []
    names = re.findall(r"diagrams/([a-z0-9\-]+\.svg)", lesson.read_text(encoding="utf-8"))
    return list(dict.fromkeys(names))


def parse_ppt_md(section_dir: Path) -> tuple[str, list[dict]]:
    md_path = section_dir / "PPT_AND_NARRATION.md"
    text = md_path.read_text(encoding="utf-8")
    title_m = re.match(r"^#\s+(.+)$", text, re.M)
    md_title = title_m.group(1).strip() if title_m else section_dir.name

    segments = []
    blocks = re.split(r"\n---+\n", text)
    for block in blocks:
        hdr = re.search(r"^##\s+(\d+)\s+·\s+(\S+)\s*$", block, re.M)
        if not hdr:
            continue
        num, slug = hdr.group(1), hdr.group(2)
        seg_id = f"{num}-{slug}"
        ppt_m = re.search(r"\*\*PPT(?:（屏幕）)?\*\*\s*\n((?:- .+\n?)+)", block)
        bullets = []
        if ppt_m:
            bullets = [ln[2:].strip() for ln in ppt_m.group(1).strip().splitlines() if ln.startswith("- ")]
        segments.append({"id": seg_id, "slug": slug, "bullets": bullets})
    return md_title, segments


def slug_label(slug: str) -> str:
    mapping = {"close": "TAKEAWAY", "open": "OPEN", "gate": "GATE", "accept": "ACCEPT", "quiz": "QUIZ"}
    if slug in mapping:
        return mapping[slug]
    return slug.replace("-", " ").upper()[:22]


def format_headline(text: str) -> str:
    text = text.strip()
    if " · " in text:
        parts = [p.strip() for p in text.split(" · ") if p.strip()]
        if 2 <= len(parts) <= 4 and all(len(p) <= 12 for p in parts):
            return "<br/>".join(esc(p) for p in parts)
    if len(text) <= 18:
        return esc(text)
    return esc(text[:18])


def bullet_to_card(b: str, idx: int) -> tuple[str, str, str]:
    b = b.strip()
    for sep in [" · ", "：", ": ", " — ", " - "]:
        if sep in b:
            a, c = b.split(sep, 1)
            return (f"{idx+1:02d}", a.strip()[:28], c.strip()[:48])
    if " vs " in b.lower():
        return (f"{idx+1:02d}", b[:28], "")
    return (f"{idx+1:02d}", b[:28], "")


def try_compare(bullets: list[str]) -> tuple | None:
    pairs: list[tuple[str, list[str]]] = []
    for b in bullets:
        m = re.match(r"^([^：:]+)[：:]\s*(.+)$", b.strip())
        if m:
            title = m.group(1).strip()
            body = m.group(2).strip()
            items = [x.strip() for x in re.split(r"[·／/]", body) if x.strip()] or [body]
            pairs.append((title[:20], items[:4]))
    if len(pairs) >= 2:
        return (pairs[0], pairs[1])
    if len(bullets) == 2 and (" vs " in bullets[0].lower() or "vs" in bullets[1].lower()):
        return (
            (bullets[0].split("vs")[0].strip()[:20] or "A", [bullets[0]]),
            (bullets[1].split("vs")[-1].strip()[:20] or "B", [bullets[1]]),
        )
    return None


def pick_diagram(slug: str, diagrams: list[str], idx: int) -> str | None:
    if not diagrams:
        return None
    slug_l = slug.lower()
    for kw, name in SLUG_DIAGRAM_KEYWORDS:
        if kw in slug_l and name in diagrams:
            return name
    return diagrams[idx % len(diagrams)]


def bullets_to_ppt_meta(num: str, slug: str, label: str, bullets: list[str], diagram: str | None) -> list[str]:
    meta = [f"眉题：{num} {label}"]
    if diagram:
        meta.append(f"讲解图：{diagram}")
    for b in bullets[:4]:
        if b not in meta:
            meta.append(b)
    return meta[:5]


def build_slide(seg: dict, diagram: str | None, is_close: bool) -> dict:
    seg_id, slug, bullets = seg["id"], seg["slug"], seg["bullets"] or ["本节要点"]
    num = seg_id.split("-")[0]
    label = slug_label(slug)
    slide: dict = {"id": seg_id, "num": num, "label": label}

    if is_close or slug == "close":
        slide["headline"] = "收束"
        slide["h_size"] = 56
        if bullets:
            slide["tags"] = [(b, i == 0) for i, b in enumerate(bullets[:-1] if len(bullets) > 1 else bullets)]
            last = bullets[-1]
            if "下一节" in last or "预告" in last or "毕业" in last:
                slide["subtitle2"] = last
        if diagram:
            slide["diagram"] = (f"讲解图 · {diagram.replace('.svg', '')}", diagram)
        return slide

    if slug in ("gate", "checklist") or "过闸" in "".join(bullets):
        slide["headline"] = format_headline(bullets[0])
        slide["checklist"] = bullets[1:] if len(bullets) > 1 else bullets
        return slide

    cmp = try_compare(bullets)
    if cmp and ("vs" in slug or "prompt" in slug or "workflow" in slug or "copilot" in slug):
        slide["headline"] = format_headline(bullets[0])
        slide["compare"] = cmp
        if diagram:
            slide["diagram"] = (f"讲解图 · {diagram.replace('.svg', '')}", diagram)
        return slide

    slide["headline"] = format_headline(bullets[0])
    rest = bullets[1:]
    if rest:
        if len(rest) >= 2 and all(len(r) < 36 for r in rest):
            slide["cards"] = [bullet_to_card(b, i) for i, b in enumerate(rest[:4])]
        elif len(rest) == 1:
            slide["subtitle"] = rest[0]
        else:
            slide["cards"] = [bullet_to_card(b, i) for i, b in enumerate(rest[:4])]
    elif len(bullets[0]) > 20:
        slide["subtitle"] = bullets[0]

    if diagram:
        slide["diagram"] = (f"讲解图 · {diagram.replace('.svg', '')}", diagram)
        if slug == "open" and not slide.get("cards"):
            pass
        elif slide.get("cards") and len(slide["cards"]) > 2:
            slide.pop("diagram", None)

    return slide


def section_meta(section_dir: Path, day: int, section_num: int, md_title: str) -> dict:
    day_name = DAY_NAMES.get(day, f"第{day}天")
    short = md_title.split("·")[-1].strip() if "·" in md_title else md_title
    return {
        "md_title": md_title,
        "title": f"{day_name} · 第 {section_num} 节 · {short[:24]}",
        "brand": f"{day_name} · 第 {section_num} 节",
        "day": day,
        "section_num": section_num,
        "dir_name": section_dir.name,
    }


def estimate_durations(section_dir: Path, slide_ids: list[str]) -> list[float]:
    return [max(18, len(read_narration(section_dir, sid)) / CPS) for sid in slide_ids]


def build_html(meta: dict, slides: list[dict], section_dir: Path) -> str:
    slide_ids = [s["id"] for s in slides]
    durs = estimate_durations(section_dir, slide_ids)
    t = 0.0
    for i, d in enumerate(durs):
        slides[i]["start"] = round(t, 2)
        slides[i]["dur"] = round(d, 2)
        t += d + GAP
    total = round(slides[-1]["start"] + slides[-1]["dur"], 2)

    bodies = "\n\n".join(slide_body(s) for s in slides)
    gsap_slides = ",\n  ".join(
        f'{{ id: "#slide-{s["id"]}", start: {s["start"]}, dur: {s["dur"]} }}' for s in slides
    )
    gsap_enter = "\n".join(f'  enter("#slide-{s["id"]}", {s["start"]});' for s in slides)
    gsap_exit = "\n".join(
        f'  exit("#slide-{s["id"]}", {round(s["start"] + s["dur"], 2)});' for s in slides
    )

    return f"""<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>{esc(meta["title"])}</title>
<script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
<style>
{CSS}
</style>
</head>
<body>
<div id="preview-hint">浏览器预览 · ← → 或空格翻页 · 点击画面下一页</div>
<div id="preview-pager">1 / 1</div>
<div id="root" data-composition-id="main" data-start="0" data-duration="{total}" data-width="1920" data-height="1080">
<div class="stage-bg"></div>

{bodies}

<div id="brand-bar" class="brand-bar clip" data-start="0" data-duration="{total}" data-track-index="2">FDE<em>·</em>训练营 <em>/</em> {esc(meta["brand"])}</div>
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


def build_ppt_md(meta: dict, slides_meta: list[dict], section_dir: Path) -> str:
    day = meta["day"]
    lines = [
        f"# {meta['md_title']}",
        "",
        f"路径：`class/bootcamp/day-{day:02d}/{section_dir.name}/video/`  ",
        "PPT：`video/index.html`（**仅讲解图 + 概念要点，无口播正文**）  ",
        "分词稿：`video/scripts/narration/`",
        "",
        "> 口播以分词稿为准 · **过稿后再 TTS / 渲染** · TTS 后需重跑 `patch_section_video_timing.py`",
        "",
        "---",
        "",
    ]
    for sm in slides_meta:
        sid, slug = sm["id"], sm["slug"]
        oral = read_narration(section_dir, sid)
        num = sid.split("-")[0]
        lines += [f"## {num} · {slug}", "", "**PPT（屏幕）**"]
        for b in sm["ppt"]:
            lines.append(f"- {b}")
        lines += [
            "",
            "**口播**",
            f"> {oral}",
            "",
            f"文稿：`video/scripts/narration/{num}-{slug}.txt`",
            "",
            "---",
            "",
        ]
    lines += [
        "## 评审清单",
        "",
        "- [x] PPT 无口播正文，仅图 + 概念卡/表",
        "- [x] 口播与 `narration/*.txt` 一致",
        "- [ ] 口播过稿确认",
        "- [ ] TTS 后 patch 时间轴并重渲",
        "",
    ]
    return "\n".join(lines)


def update_yaml(meta: dict, slides_meta: list[dict], section_dir: Path) -> None:
    yaml_path = YAML_DIR / f"day{meta['day']:02d}_s{meta['section_num']:02d}.yaml"
    if not yaml_path.exists():
        return
    title_match = re.search(r'^title: "(.+)"', yaml_path.read_text(encoding="utf-8"), re.M)
    title = title_match.group(1) if title_match else meta["md_title"]
    lines = [f'title: "{title}"', "segments:"]
    for sm in slides_meta:
        sid = sm["id"]
        oral = read_narration(section_dir, sid)
        lines.append(f'  - id: "{sid}"')
        lines.append("    ppt:")
        for p in sm["ppt"]:
            lines.append(f'      - "{p.replace(chr(34), chr(92)+chr(34))}"')
        lines.append("    text: |")
        for oline in oral.splitlines() or [""]:
            lines.append(f"      {oline}")
    yaml_path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def copy_diagrams(names: list[str], section_dir: Path) -> None:
    dest = section_dir / "video/assets/diagrams"
    dest.mkdir(parents=True, exist_ok=True)
    for name in names:
        src = DIAG_SRC / name
        if src.exists():
            shutil.copy2(src, dest / name)


def process_section(section_dir: Path, day: int) -> None:
    m = re.search(r"section-(\d+)", section_dir.name)
    if not m:
        return
    section_num = int(m.group(1))
    narr_dir = section_dir / "video/scripts/narration"
    if not narr_dir.exists() or not (section_dir / "PPT_AND_NARRATION.md").exists():
        print(f"SKIP {section_dir.name} (missing narration or md)")
        return

    md_title, segments = parse_ppt_md(section_dir)
    meta = section_meta(section_dir, day, section_num, md_title)

    diagrams = parse_lesson_diagrams(section_dir)
    if not diagrams:
        diagrams = DEFAULT_DIAGRAMS.get(section_dir.name, ["v2-panorama.svg"])
    # dedupe preserving order
    seen: set[str] = set()
    diagrams = [d for d in diagrams if not (d in seen or seen.add(d))]

    slides: list[dict] = []
    slides_meta: list[dict] = []
    for i, seg in enumerate(segments):
        is_close = seg["slug"] == "close" or i == len(segments) - 1 and "close" in seg["slug"]
        is_close = seg["slug"] == "close"
        diagram = pick_diagram(seg["slug"], diagrams, i)
        slide = build_slide(seg, diagram, is_close)
        slides.append(slide)
        label = slide["label"]
        sm_ppt = bullets_to_ppt_meta(seg["id"].split("-")[0], seg["slug"], label, seg["bullets"], diagram)
        slides_meta.append({"id": seg["id"], "slug": seg["slug"], "ppt": sm_ppt})

    copy_diagrams(diagrams, section_dir)
    html = build_html(meta, slides, section_dir)
    (section_dir / "video/index.html").write_text(html, encoding="utf-8")
    (section_dir / "PPT_AND_NARRATION.md").write_text(build_ppt_md(meta, slides_meta, section_dir), encoding="utf-8")
    update_yaml(meta, slides_meta, section_dir)
    print(f"OK day-{day:02d} {section_dir.name} ({len(slides)} slides)")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--from-day", type=int, default=7)
    ap.add_argument("--to-day", type=int, default=10)
    args = ap.parse_args()
    for day in range(args.from_day, args.to_day + 1):
        day_dir = BOOT / f"day-{day:02d}"
        if not day_dir.exists():
            continue
        for section_dir in sorted(day_dir.glob("section-*")):
            process_section(section_dir, day)


if __name__ == "__main__":
    main()
