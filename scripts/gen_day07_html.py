#!/usr/bin/env python3
"""Generate Day 07 section video/index.html from S04 rich-component template."""
from __future__ import annotations

import json
from pathlib import Path

BC = Path("/Users/qingjiu/workspace/research/digital-fde-platform/class/bootcamp")
DAY = BC / "day-07"

# ── CSS (copied from day-06 S04, the richest component library) ──
CSS = """@font-face{font-family:"Noto Sans SC";src:url("assets/fonts/NotoSansSC-Regular.woff2") format("woff2");font-weight:400;font-display:block}
@font-face{font-family:"Noto Sans SC";src:url("assets/fonts/NotoSansSC-Bold.woff2") format("woff2");font-weight:700;font-display:block}
@font-face{font-family:"Noto Serif SC";src:url("assets/fonts/NotoSerifSC-Regular.woff2") format("woff2");font-weight:400;font-display:block}
@font-face{font-family:"Noto Serif SC";src:url("assets/fonts/NotoSerifSC-Bold.woff2") format("woff2");font-weight:700;font-display:block}
@font-face{font-family:"JetBrains Mono";src:url("assets/fonts/JetBrainsMono-Bold.woff2") format("woff2");font-weight:700;font-display:block}
:root{--bg:#f2f5f0;--ink:#231f20;--ink-60:rgba(35,31,32,.72);--ink-40:rgba(35,31,32,.45);--ink-08:rgba(35,31,32,.1);--ink-05:rgba(35,31,32,.05);--accent:#1400ff;--serif:"Noto Serif SC",serif;--sans:"Noto Sans SC",sans-serif;--mono:"JetBrains Mono",monospace}
*{margin:0;padding:0;box-sizing:border-box}
html{margin:0;background:#111}
html.browser-preview{overflow:hidden;height:100%}
body{margin:0;width:1920px;height:1080px;overflow:hidden;background:#000;font-family:var(--sans);color:var(--ink)}
#root{position:relative;width:1920px;height:1080px;overflow:hidden}
.stage-bg{position:absolute;inset:0;background:var(--bg);z-index:0}
.slide{position:absolute;inset:0;z-index:2;padding:72px 420px 72px 96px}
.slide.invert{color:var(--bg)}
.slide.invert .stage-fill{background:var(--ink)}
.stage-fill{position:absolute;inset:0;background:var(--bg);z-index:0}
.slide-body{position:relative;z-index:2;height:100%}
.sec-label{font-family:var(--mono);font-size:15px;letter-spacing:.18em;text-transform:uppercase;color:var(--ink-60);display:flex;align-items:center;gap:14px;margin-bottom:22px}
.sec-label::after{content:"";flex:1;height:6px;background:var(--ink);margin-left:4px;max-width:520px}
.sec-label .num{color:var(--accent);font-weight:700}
.slide.invert .sec-label{color:rgba(242,245,240,.55)}
.slide.invert .sec-label::after{background:var(--bg)}
.meta-row{font-family:var(--mono);font-size:14px;letter-spacing:.14em;text-transform:uppercase;color:var(--ink-60);display:flex;gap:28px;flex-wrap:wrap;margin-bottom:28px}
.meta-row b{color:var(--accent);font-weight:700}
.display{font-family:var(--serif);font-weight:700;font-size:78px;line-height:1.12;letter-spacing:.01em;margin-bottom:18px;max-width:14ch}
.display .thin{font-weight:400;color:var(--ink-60)}
.slide.invert .display .thin{color:rgba(242,245,240,.55)}
.statement{font-family:var(--serif);font-size:32px;line-height:1.55;max-width:22em;margin-bottom:28px}
.statement strong{color:var(--accent);font-weight:700;border-bottom:6px solid var(--accent)}
.lede{font-size:22px;line-height:1.55;color:var(--ink-60);max-width:34em;margin-bottom:32px}
.slide.invert .lede{color:rgba(242,245,240,.55)}
.ladder{display:flex;align-items:stretch;border:1px solid var(--ink);width:max-content;max-width:100%}
.ladder .rung{font-family:var(--mono);padding:14px 16px;border-right:1px solid var(--ink);min-width:110px;white-space:nowrap}
.ladder .rung:last-child{border-right:none}
.ladder .rung small{display:block;font-size:11px;letter-spacing:.1em;color:var(--ink-40);text-transform:uppercase;margin-bottom:4px}
.ladder .rung b{font-size:18px;font-weight:700}
.ladder .rung.hot{background:var(--accent);color:#fff;border-right-color:var(--accent)}
.ladder .rung.hot small{color:rgba(255,255,255,.65)}
.split{display:grid;grid-template-columns:1.05fr .95fr;gap:40px;align-items:stretch;margin-top:8px;height:calc(100% - 210px)}
.split.tight{height:calc(100% - 170px)}
.photo-panel{position:relative;border:1px solid var(--ink);overflow:hidden;background:#ddd;min-height:420px}
.photo-panel img{width:100%;height:100%;object-fit:cover;display:block;filter:contrast(1.05) saturate(.92)}
.photo-cap{position:absolute;left:0;right:0;bottom:0;padding:14px 18px;font-family:var(--mono);font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:rgba(242,245,240,.85);background:linear-gradient(transparent,rgba(35,31,32,.85))}
.photo-frame-bar{position:absolute;top:0;left:0;width:26px;height:6px;background:var(--accent);z-index:2}
.note-stack{display:flex;flex-direction:column;gap:18px}
.blk{border-top:6px solid var(--ink);padding-top:16px}
.blk.accent{border-top-color:var(--accent)}
.blk h4{font-family:var(--serif);font-size:26px;font-weight:700;margin-bottom:8px}
.blk p{font-size:18px;line-height:1.55;color:var(--ink-60)}
.tag-row{display:flex;gap:10px;flex-wrap:wrap;margin:18px 0 0}
.tag{font-family:var(--mono);font-size:14px;letter-spacing:.06em;padding:7px 14px;border:1px solid var(--ink-40);color:var(--ink-60);background:transparent}
.tag.solid{background:var(--ink);color:var(--bg);border-color:var(--ink)}
.tag.hl{background:var(--accent);color:#fff;border-color:var(--accent)}
.duo{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-top:4px}
.card{border:1px solid var(--ink);padding:22px 22px 24px;background:rgba(255,255,255,.35)}
.card .lab{font-family:var(--mono);font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--accent);margin-bottom:10px;font-weight:700}
.card h4{font-family:var(--serif);font-size:24px;font-weight:700;margin-bottom:8px}
.card p{font-size:17px;line-height:1.5;color:var(--ink-60)}
.card.dim{background:var(--ink-05);opacity:.85}
.card.hot{background:var(--accent);color:#fff;border-color:var(--accent)}
.card.hot .lab{color:rgba(255,255,255,.7)}
.card.hot p{color:rgba(255,255,255,.78)}
.mile-rail{display:flex;gap:0;border:1px solid var(--ink);margin-top:6px}
.mile{flex:1;padding:18px 16px;border-right:1px solid var(--ink-08);font-family:var(--mono)}
.mile:last-child{border-right:none}
.mile small{display:block;font-size:12px;letter-spacing:.1em;color:var(--ink-40);margin-bottom:8px;text-transform:uppercase}
.mile b{display:block;font-size:18px;color:var(--ink);margin-bottom:6px;font-weight:700}
.mile span{font-family:var(--sans);font-size:14px;color:var(--ink-60);line-height:1.4}
.mile.hot{background:var(--accent);color:#fff}
.mile.hot small{color:rgba(255,255,255,.65)}
.mile.hot b,.mile.hot span{color:#fff}
.chat-mock{border:1px solid var(--ink);background:#fff;padding:18px 20px;margin-top:6px;font-family:var(--mono);font-size:15px;line-height:1.85}
.chat-mock .row{display:flex;gap:10px;align-items:baseline;flex-wrap:wrap}
.chat-mock .u{color:var(--ink-40)}
.chat-mock .a{color:var(--accent);font-weight:700}
.chat-mock .arrow{color:var(--ink-40);font-weight:700}
.chat-mock .ok{color:#2f9e44;font-weight:700}
.chat-mock .no{color:#f24e54;font-weight:700}
.flow{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:18px}
.flow .step{font-family:var(--mono);font-size:15px;padding:12px 16px;border:1px solid var(--ink);background:#fff}
.flow .step.hot{background:var(--accent);color:#fff;border-color:var(--accent)}
.flow .arrow{font-family:var(--mono);font-size:20px;color:var(--accent);font-weight:700}
.hub-grid{display:grid;grid-template-columns:260px 1fr 1fr;gap:18px;margin-top:24px}
.hub-grid.six{grid-template-columns:240px 1fr 1fr 1fr}
.hub-core{grid-row:span 2;border:1px solid rgba(242,245,240,.35);background:var(--accent);color:#fff;display:flex;flex-direction:column;justify-content:center;padding:28px 24px}
.hub-core .lab{font-family:var(--mono);font-size:13px;letter-spacing:.16em;text-transform:uppercase;opacity:.7;margin-bottom:12px}
.hub-core h3{font-family:var(--serif);font-size:36px;font-weight:700;line-height:1.2}
.hub-cell{border:1px solid rgba(242,245,240,.25);padding:22px 22px;background:rgba(242,245,240,.04)}
.hub-cell .lab{font-family:var(--mono);font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#7d8cff;margin-bottom:8px;font-weight:700}
.hub-cell h4{font-family:var(--serif);font-size:24px;font-weight:700;margin-bottom:6px;color:#fff}
.hub-cell p{font-size:16px;color:rgba(242,245,240,.6);line-height:1.45}
.side-photo{position:absolute;top:0;right:0;width:38%;height:100%;z-index:1;overflow:hidden;border-left:6px solid var(--ink)}
.side-photo img{width:100%;height:100%;object-fit:cover;display:block;filter:grayscale(.15) contrast(1.05)}
.side-photo .veil{position:absolute;inset:0;background:linear-gradient(90deg,rgba(242,245,240,.35),transparent 40%)}
.slide.has-side{padding-right:46%}
.quote-big{font-family:var(--serif);font-size:60px;line-height:1.35;max-width:16em;margin:18px 0 28px}
.quote-big strong{border-bottom:6px solid var(--accent);font-weight:700}
.brand-bar{position:absolute;left:96px;bottom:36px;z-index:20;font-family:var(--mono);font-size:13px;letter-spacing:.16em;text-transform:uppercase;color:var(--ink-40)}
.brand-bar em{font-style:normal;color:var(--accent)}
#avatar-pip{position:absolute;right:40px;bottom:36px;z-index:30;width:248px;height:380px;display:flex;flex-direction:column}
.avatar-frame{flex:1;width:100%;min-height:0;overflow:hidden;border:2px solid var(--ink);border-bottom:none;box-shadow:8px 8px 0 var(--accent);background:#0b1220;position:relative}
.avatar-frame video{width:100%;height:100%;object-fit:cover;object-position:50% 22%;display:block}
.avatar-caption{flex:none;height:30px;line-height:30px;padding:0 10px;font-family:var(--mono);font-size:11px;letter-spacing:.12em;text-transform:uppercase;text-align:center;background:var(--ink);color:#f2f5f0;border:2px solid var(--ink);border-top:none}
.speak-ring{position:absolute;inset:-8px;border:2px solid var(--accent);opacity:.35;pointer-events:none}
#preview-hint{position:fixed;left:12px;top:12px;z-index:9999;font:12px/1.4 var(--mono);color:#fff;background:rgba(0,0,0,.72);padding:8px 12px;border-radius:4px;display:none;pointer-events:none}
#preview-pager{position:fixed;right:12px;top:12px;z-index:9999;font:13px/1.4 var(--mono);color:#fff;background:rgba(20,0,255,.85);padding:8px 14px;border-radius:4px;display:none;pointer-events:none}
html.browser-preview #preview-hint,html.browser-preview #preview-pager{display:block}"""

# ── GSAP script template (slides-array driven, same as S04) ──
SCRIPT_TMPL = """window.__timelines = window.__timelines || {{}};
const tl = gsap.timeline({{ paused: true }});
const slides = {slides_json};
function enter(id, t0) {{
  tl.from(`${{id}} .slide-body`, {{ opacity: 0, y: 28, duration: 0.55, ease: "power3.out" }}, t0);
  tl.from(`${{id}} [data-anim='k']`, {{ y: 18, opacity: 0, duration: 0.4, ease: "power2.out" }}, t0 + 0.12);
  tl.from(`${{id}} [data-anim='t']`, {{ y: 36, opacity: 0, duration: 0.55, ease: "power3.out" }}, t0 + 0.22);
  tl.from(`${{id}} [data-anim='s']`, {{ y: 20, opacity: 0, duration: 0.45, ease: "power2.out" }}, t0 + 0.32);
  tl.from(`${{id}} [data-anim='lede']`, {{ y: 20, opacity: 0, duration: 0.45, ease: "power2.out" }}, t0 + 0.4);
  tl.from(`${{id}} [data-anim='meta']`, {{ y: 14, opacity: 0, duration: 0.4, ease: "power2.out" }}, t0 + 0.08);
  tl.from(`${{id}} [data-anim='photo']`, {{ x: 40, opacity: 0, duration: 0.6, ease: "power3.out" }}, t0 + 0.1);
  tl.from(`${{id}} [data-anim='split']`, {{ y: 24, opacity: 0, duration: 0.5, ease: "power2.out" }}, t0 + 0.35);
  tl.from(`${{id}} [data-anim='ladder']`, {{ y: 24, opacity: 0, duration: 0.5, ease: "power2.out" }}, t0 + 0.45);
  tl.from(`${{id}} [data-anim='mock']`, {{ y: 14, opacity: 0, duration: 0.45, ease: "power2.out" }}, t0 + 0.55);
  tl.from(`${{id}} [data-anim='duo'] .card`, {{ y: 16, opacity: 0, stagger: 0.08, duration: 0.4, ease: "power2.out" }}, t0 + 0.65);
  tl.from(`${{id}} [data-anim='miles'] .mile`, {{ y: 14, opacity: 0, stagger: 0.08, duration: 0.35, ease: "power2.out" }}, t0 + 0.55);
  tl.from(`${{id}} [data-anim='flow'] .step`, {{ y: 12, opacity: 0, stagger: 0.06, duration: 0.3, ease: "power2.out" }}, t0 + 0.8);
  tl.from(`${{id}} [data-anim='hub'] .hub-core`, {{ y: 20, opacity: 0, duration: 0.5, ease: "power2.out" }}, t0 + 0.5);
  tl.from(`${{id}} [data-anim='hub'] .hub-cell`, {{ y: 18, opacity: 0, stagger: 0.08, duration: 0.4, ease: "power2.out" }}, t0 + 0.7);
  tl.from(`${{id}} [data-anim='tags'] .tag`, {{ y: 10, opacity: 0, stagger: 0.05, duration: 0.3, ease: "power2.out" }}, t0 + 0.95);
}}
function exit(id, tEnd) {{
  tl.to(`${{id}} .slide-body`, {{ opacity: 0, y: -18, duration: 0.4, ease: "power2.in" }}, tEnd - 0.45);
  tl.set(`${{id}} .slide-body`, {{ opacity: 0 }}, tEnd);
}}
slides.forEach((s) => {{ enter(s.id, s.start); exit(s.id, s.start + s.dur); }});
tl.from("#avatar-pip", {{ opacity: 0, y: 28, duration: 0.7, ease: "power3.out" }}, 0.25);
window.__timelines["main"] = tl;
(function bootBrowserPreview() {{
  const params = new URLSearchParams(location.search);
  const renderMode = params.get("render") === "1";
  const isDirect = !renderMode && (location.protocol === "file:" || params.has("preview"));
  if (!isDirect) {{ tl.seek(1); return; }}
  document.documentElement.classList.add("browser-preview");
  const slidesEls = [...document.querySelectorAll(".slide")];
  let idx = 0;
  function fit() {{ const s = Math.min(window.innerWidth / 1920, window.innerHeight / 1080); document.body.style.transform = "scale(" + s + ")"; document.body.style.transformOrigin = "top left"; }}
  function reveal(el) {{ gsap.set(el.querySelectorAll(".slide-body, [data-anim]"), {{ opacity: 1, y: 0, x: 0, clearProps: "transform" }}); }}
  function show(i) {{
    slidesEls.forEach((el, j) => {{ el.style.visibility = j === i ? "visible" : "hidden"; }});
    reveal(slidesEls[i]);
    const pager = document.getElementById("preview-pager");
    if (pager) pager.textContent = (i + 1) + " / " + slidesEls.length;
  }}
  gsap.set("#avatar-pip", {{ opacity: 1, y: 0 }});
  fit(); show(0);
  window.addEventListener("resize", fit);
  document.getElementById("root").addEventListener("click", (e) => {{ if (e.target.closest("#avatar-pip")) return; idx = Math.min(idx + 1, slidesEls.length - 1); show(idx); }});
  window.addEventListener("keydown", (e) => {{
    if (e.key === "ArrowRight" || e.key === " ") {{ idx = Math.min(idx + 1, slidesEls.length - 1); show(idx); e.preventDefault(); }}
    if (e.key === "ArrowLeft") {{ idx = Math.max(idx - 1, 0); show(idx); }}
  }});
}})();"""


def slide_open(num, sid, photo, meta, label, title, thin, statement, lede, ladder, tags):
    """OPEN slide: side-photo + ladder + tag-row."""
    rungs = "".join(
        f'<div class="rung{" hot" if r.get("hot") else ""}"><small>{r["n"]}</small><b>{r["t"]}</b></div>'
        for r in ladder
    )
    taghtml = "".join(f'<span class="tag {c}">{t}</span>' for t, c in tags)
    return f"""<!-- {num} OPEN · side-photo + ladder -->
<section id="slide-{sid}" class="clip slide has-side" data-track-index="1" data-start="0.0" data-duration="20.0">
  <div class="stage-fill"></div>
  <div class="side-photo" data-anim="photo"><img src="assets/photos/{photo}" alt="" /><div class="veil"></div></div>
  <div class="slide-body">
    <div class="meta-row" data-anim="meta">{meta}</div>
    <div class="sec-label" data-anim="k"><span class="num">{num}</span>{label}</div>
    <h1 class="display" data-anim="t">{title}<span class="thin">{thin}</span></h1>
    <p class="statement" data-anim="s">{statement}</p>
    <p class="lede" data-anim="lede">{lede}</p>
    <div class="ladder" data-anim="ladder">{rungs}</div>
    <div class="tag-row" data-anim="tags">{taghtml}</div>
  </div>
</section>"""


def slide_split(num, sid, photo, cap, label, title, thin, lede, right_html):
    """SPLIT slide: photo-panel + custom right column."""
    return f"""<!-- {num} · photo + content -->
<section id="slide-{sid}" class="clip slide" data-track-index="1" data-start="20.25" data-duration="20.0">
  <div class="stage-fill"></div>
  <div class="slide-body">
    <div class="sec-label" data-anim="k"><span class="num">{num}</span>{label}</div>
    <h1 class="display" data-anim="t">{title}<span class="thin">{thin}</span></h1>
    <p class="lede" data-anim="s">{lede}</p>
    <div class="split tight" data-anim="split">
      <div class="photo-panel"><div class="photo-frame-bar"></div><img src="assets/photos/{photo}" alt="" /><div class="photo-cap">{cap}</div></div>
      <div class="note-stack">{right_html}</div>
    </div>
  </div>
</section>"""


def slide_close(num, sid, label, title, thin, quote, hub_core_lab, hub_core_h3, hub_cells, lede):
    """CLOSE slide: invert + quote-big + hub-grid."""
    cells = "".join(
        f'<div class="hub-cell"><div class="lab">{c[0]}</div><h4>{c[1]}</h4><p>{c[2]}</p></div>'
        for c in hub_cells
    )
    ncells = len(hub_cells)
    grid_cls = "hub-grid six" if ncells >= 5 else "hub-grid"
    return f"""<!-- {num} CLOSE · invert + quote-big + hub-grid -->
<section id="slide-{sid}" class="clip slide invert" data-track-index="1" data-start="100.25" data-duration="20.0">
  <div class="stage-fill"></div>
  <div class="slide-body">
    <div class="sec-label" data-anim="k"><span class="num">{num}</span>{label}</div>
    <h1 class="display" style="max-width:none;font-size:72px" data-anim="t">{title}<span class="thin">{thin}</span></h1>
    <p class="quote-big" data-anim="s">{quote}</p>
    <div class="{grid_cls}" data-anim="hub">
      <div class="hub-core"><div class="lab">{hub_core_lab}</div><h3>{hub_core_h3}</h3></div>
      {cells}
    </div>
    <p class="lede" style="margin-top:22px;margin-bottom:0" data-anim="lede">{lede}</p>
  </div>
</section>"""


def duo(cards):
    h = ""
    for c in cards:
        cls = "card " + c.get("cls", "")
        h += f'<div class="{cls}"><div class="lab">{c["lab"]}</div><h4>{c["h4"]}</h4><p>{c["p"]}</p></div>'
    return f'<div class="duo" data-anim="duo">{h}</div>'


def chat(rows):
    h = ""
    for r in rows:
        h += f'<div class="row">{r}</div>'
    return f'<div class="chat-mock" data-anim="mock">{h}</div>'


def miles(items):
    h = ""
    for m in items:
        cls = "mile hot" if m.get("hot") else "mile"
        h += f'<div class="{cls}"><small>{m["n"]}</small><b>{m["t"]}</b><span>{m["s"]}</span></div>'
    return f'<div class="mile-rail" data-anim="miles">{h}</div>'


def tags(items):
    h = "".join(f'<span class="tag {c}">{t}</span>' for t, c in items)
    return f'<div class="tag-row" data-anim="tags">{h}</div>'


def build_html(title, day_label, total, slides_html, slides_arr):
    slides_json = json.dumps(slides_arr, ensure_ascii=False)
    script = SCRIPT_TMPL.format(slides_json=slides_json)
    return f"""<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=1920, height=1080" />
<title>{title}</title>
<script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
<style>
{CSS}
</style>
</head>
<body>
<div id="preview-hint">浏览器预览 · ← → 或空格翻页 · 点击画面下一页</div>
<div id="preview-pager">1 / {len(slides_arr)}</div>
<div id="root" data-composition-id="main" data-start="0" data-duration="{total}" data-width="1920" data-height="1080">
<div class="stage-bg"></div>
{slides_html}
<div id="brand-bar" class="brand-bar clip" data-start="0" data-duration="{total}" data-track-index="2">FDE<em>·</em>训练营 <em>/</em> {day_label}</div>
<div id="avatar-pip" class="clip" data-start="0" data-duration="{total}" data-track-index="5">
  <div class="speak-ring"></div>
  <div class="avatar-frame"><video id="avatar-lipsync" class="clip" src="assets/avatar-lipsync.mp4" muted playsinline preload="auto" data-start="0" data-duration="{total}" data-track-index="6"></video></div>
  <div class="avatar-caption">Lecturer · 口播</div>
</div>
<audio id="narration" class="clip" src="audio/narration-full.wav" data-start="0" data-duration="{total}" data-track-index="10" data-volume="1"></audio>
</div>
<script>
{script}
</script>
</body>
</html>"""


# placeholder durations (will be patched by patch_section_video_timing.py)
DUR = 20.0
GAP = 0.25


def make_slides_arr(sids):
    arr = []
    t = 0.0
    for i, sid in enumerate(sids):
        arr.append({"id": f"#slide-{sid}", "start": round(t, 3), "dur": DUR})
        t += DUR
        if i < len(sids) - 1:
            t += GAP
    return arr


def patch_starts(slides_html, sids):
    """Set data-start on each slide section in order."""
    t = 0.0
    for i, sid in enumerate(sids):
        import re
        slides_html, _ = re.subn(
            rf'(id="slide-{sid}"[^>]*data-start=")[^"]*(")',
            lambda m, tt=t: f'{m.group(1)}{tt:.3f}{m.group(2)}',
            slides_html, count=1,
        )
        t += DUR + (GAP if i < len(sids) - 1 else 0)
    return slides_html


def gen_section(sec_dir, title, day_label, slides_html, sids):
    arr = make_slides_arr(sids)
    total = arr[-1]["start"] + DUR
    # fix data-start in slides_html
    slides_html = patch_starts(slides_html, sids)
    html = build_html(title, day_label, round(total, 3), slides_html, arr)
    (sec_dir / "video" / "index.html").write_text(html, encoding="utf-8")
    print(f"  wrote {sec_dir.name}/video/index.html ({len(sids)} slides, total={total:.1f}s)")


# ════════════════════════════════════════════════════════════════
# SECTION CONTENT — 精炼自 lesson.md 口播稿 + day.yaml knowledge_cards
# ════════════════════════════════════════════════════════════════

def gen_s01():
    d = DAY / "section-01-system-to-skill"
    meta = '<span><b>FDE</b> Day 07 · Section 01</span><span>Skill 实战日 · 概念课</span><span>第一节</span>'
    s = ""
    s += slide_open("01", "01-open", "01-open.jpg", meta,
        "OPEN · Week 2 换档", "从做系统", "到造能力",
        "系统被使用，<strong>能力被执行</strong>",
        "第一周你们做的是系统——驾驶舱跑在那里等人来看。第二周换档：造能力，让 AI 拿着说明书去干活。你从操作者变成派活的人。",
        [{"n": "01", "t": "系统", "hot": True}, {"n": "02", "t": "能力"}, {"n": "03", "t": "Skill"}, {"n": "04", "t": "换档"}],
        [("系统→能力", "solid"), ("Prompt→Skill", ""), ("可复用", ""), ("三重价值", "hl")])
    s += slide_split("02", "02-core", "02-system-skill.jpg", "系统 vs 能力 · Unsplash",
        "CORE · 系统被使用，能力被执行", "驾驶舱等人看", "，Skill 被 AI 拿去干活",
        "驾驶舱是前端加接口加数据库加 LLM，等人打开；能力是一件具体的事——生成周报、整理线索、初审工单。载体是 Skill 说明书加执行者 AI。",
        duo([
            {"lab": "系统 WEEK 1", "h4": "驾驶舱", "p": "前端+接口+数据库+LLM，跑在那里等人来看。回答「发生了什么」。", "cls": "dim"},
            {"lab": "能力 WEEK 2", "h4": "Skill 说明书", "p": "一件具体可执行的事。AI 拿着说明书去干活。回答「接下来做什么」。", "cls": "hot"},
        ]) + tags([("驾驶舱", ""), ("Skill", "solid"), ("被使用", ""), ("被执行", "hl")]))
    s += slide_split("03", "03-detail", "03-prompt-skill.jpg", "Prompt vs Skill · Unsplash",
        "DETAIL · Prompt 管这次，Skill 管长期", "一次性对话", " vs 可复用说明书",
        "Prompt 想到哪写到哪；Skill 有四部件——输入、步骤、输出、验收。验收有标准能判对错，同事照着就能做。你们第一天写的 prompts/summary.md 已经半个 Skill 了。",
        chat([
            '<span class="u">Prompt</span> 想到哪写到哪 <span class="arrow">→</span> <span class="no">用完即弃</span>',
            '<span class="u">Skill</span> 四部件齐全 <span class="arrow">→</span> <span class="ok">可复用</span>',
            '<span class="u">Skill</span> 有验收标准 <span class="arrow">→</span> <span class="ok">可判对错</span>',
            '<span class="u">Skill</span> 同事照着做 <span class="arrow">→</span> <span class="ok">可交接</span>',
        ]) + duo([
            {"lab": "PROMPT", "h4": "一次性对话", "p": "寿命=这次对话；结构=想到哪写到哪；验收=凭感觉。", "cls": "dim"},
            {"lab": "SKILL", "h4": "长期复用", "p": "寿命=长期；结构=四部件；验收=有标准可判对错；可交接。", "cls": "hot"},
        ]))
    s += slide_split("04", "04-method", "04-triple-value.jpg", "三重价值 · Unsplash",
        "METHOD · Skill 的三重价值", "可复用", " · 可验收 · 可交接",
        "前两个好理解，第三个最被低估——好的 Skill 说明书，人类新同事也能照着做，不用你反复口头教。AI 能执行，人也能读，这就是 FDE 的工作方式。",
        '<div class="blk accent" data-anim="blk"><h4>把隐性经验写成显性流程</h4><p>你脑子里的「我知道怎么做」变成说明书里的「照着做就不会错」。AI 能执行，人也能读。</p></div>'
        + miles([{"n": "01", "t": "可复用", "s": "写一次，跑无数次", "hot": True}, {"n": "02", "t": "可验收", "s": "有标准，能判对错", "hot": True}, {"n": "03", "t": "可交接", "s": "同事照着就能做", "hot": True}])
        + tags([("可复用", ""), ("可验收", ""), ("可交接", "hl")]))
    s += slide_split("05", "05-extra", "05-anti.jpg", "不值得封装 · Unsplash",
        "EXTRA · 三类别封装", "避开这三个坑", "",
        "一年才做一次的，封装成本回不来；每次都不一样的，没有稳定步骤可写；必须人来拍板的，可以封装准备材料，不能封装做决定。",
        duo([
            {"lab": "反例 01", "h4": "一年一次", "p": "封装成本回不来——写完再没用过。", "cls": "dim"},
            {"lab": "反例 02", "h4": "每次不同", "p": "没有稳定步骤可写——开盲盒。", "cls": "dim"},
        ]) + duo([
            {"lab": "反例 03", "h4": "必须人拍板", "p": "可封装「准备材料」，不能封装「做决定」。", "cls": "dim"},
            {"lab": "正确", "h4": "高频+稳定+低险", "p": "每周一次、步骤可写死、出错代价小——才值得封装。", "cls": "hot"},
        ]) + tags([("低频别碰", ""), ("不稳定别碰", ""), ("高险别碰", "hl")]))
    s += slide_close("06", "06-close",
        "TAKEAWAY · 带走一句", "系统被使用", "，能力被执行",
        "<strong>Skill 是能力的说明书</strong>",
        "THREE VALUES", "可复用<br/>可验收<br/>可交接",
        [("01 · 复用", "写一次跑无数次", "封装成本才回得来——高频是第一筛。"),
         ("02 · 验收", "有标准能判对错", "「写得好」不算验收——必须可衡量。"),
         ("03 · 交接", "同事照着就能做", "最被低估的价值——隐性经验显性化。"),
         ("04 · 换档", "操作者→派活的", "你不再亲手做，而是写说明书让 AI 做。")],
        "下一节 → 解剖一只 Skill：输入、步骤、输出、验收，四个部件缺一个都转不动。")
    gen_section(d, "第七天 · 第 1 节 · 从系统到能力", "第七天 · 第 1 节",
        s, ["01-open", "02-core", "03-detail", "04-method", "05-extra", "06-close"])


def gen_s02():
    d = DAY / "section-02-skill-anatomy"
    meta = '<span><b>FDE</b> Day 07 · Section 02</span><span>Skill 实战日 · 概念课</span><span>第二节</span>'
    s = ""
    s += slide_open("01", "01-open", "01-open.jpg", meta,
        "OPEN · 解剖一只 Skill", "四个部件", "缺一个都转不动",
        "一份能被 AI 执行的说明书长什么样？<strong>输入、步骤、输出、验收</strong>",
        "这节咱们解剖一只 Skill。四个部件：输入管吃什么料，步骤管怎么做，输出管交什么货，验收管好坏怎么判。缺一个，说明书就转不动。",
        [{"n": "01", "t": "输入", "hot": True}, {"n": "02", "t": "步骤"}, {"n": "03", "t": "输出"}, {"n": "04", "t": "验收"}],
        [("四部件", "solid"), ("缺一不转", ""), ("周报示例", ""), ("可执行", "hl")])
    s += slide_split("02", "02-core", "02-input.jpg", "输入 · 吃什么料 · Unsplash",
        "CORE · 输入管吃什么料", "具体到来源", "和范围",
        "「相关数据」不是输入，是缺陷。周报 Skill 的输入：驾驶舱 /api/kpi 和 /api/sales，近七天，读者总监。来源写死，范围写死。",
        chat([
            '<span class="u">缺陷写法</span> 相关数据 <span class="arrow">→</span> <span class="no">AI 不知道从哪拿</span>',
            '<span class="u">正确写法</span> /api/kpi + /api/sales <span class="arrow">→</span> <span class="ok">来源写死</span>',
            '<span class="u">正确写法</span> 近七天 <span class="arrow">→</span> <span class="ok">范围写死</span>',
            '<span class="u">正确写法</span> 读者：总监 <span class="arrow">→</span> <span class="ok">对象写死</span>',
        ]) + tags([("来源", "solid"), ("范围", ""), ("读者对象", ""), ("写死", "hl")]))
    s += slide_split("03", "03-detail", "03-output-accept.jpg", "输出+验收 · Unsplash",
        "DETAIL · 输出交货，验收判好坏", "格式+长度+红线", "对应第五天结构化输出",
        "输出：Markdown 四段、三百字以内、数字只用来源里真实存在的。验收：四段齐全、每个数字有出处、意图偏差转人工。验收必须可判对错。",
        duo([
            {"lab": "输出", "h4": "交什么货", "p": "Markdown 四段、≤300 字、数字必须有出处。格式+长度+红线。", "cls": "hot"},
            {"lab": "验收", "h4": "怎么判好坏", "p": "结构判四段齐全；数字判有出处；意图判偏差转人工。可判对错。", "cls": "hot"},
        ]) + miles([{"n": "结构", "t": "四段齐全", "s": "含字段 A/B/C"}, {"n": "数字", "t": "有出处", "s": "来源里真实存在", "hot": True}, {"n": "意图", "t": "偏差转人工", "s": "不硬编"}])
        + tags([("可判对错", "hl"), ("写得好≠验收", "")]))
    s += slide_split("04", "04-method", "04-example.jpg", "完整示例 · Unsplash",
        "METHOD · 周报 Skill 完整示例", "四部件齐全", "的说明书长这样",
        "输入写着两个接口、近七天、读者总监；步骤四条，拉 KPI、找环比变化、生成摘要、检查数字；输出 Markdown 四段三百字；验收四段齐全、数字有出处。",
        chat([
            '<span class="u">输入</span> /api/kpi + /api/sales · 近7天 · 总监',
            '<span class="u">步骤</span> 拉KPI → 找环比 → 生成摘要 → 检查数字',
            '<span class="u">输出</span> Markdown 四段 · ≤300字',
            '<span class="u">验收</span> 四段齐全 + 数字有出处 + 偏差转人工 <span class="ok">✓</span>',
        ]) + tags([("拉取", ""), ("筛选", ""), ("对比", ""), ("汇总", "solid"), ("检查", "hl")]))
    s += slide_split("05", "05-extra", "05-defects.jpg", "常见缺陷 · Unsplash",
        "EXTRA · 四个缺陷词", "看到这些词", "说明书还没写完",
        "「相关数据」「分析一下」「写个周报」「写得好」——这四个词出现，说明书就还没写完。步骤要多细？细到换个人照着做不会做出第二种理解。",
        duo([
            {"lab": "缺陷 01", "h4": "相关数据", "p": "没写来源——AI 不知道从哪拿。", "cls": "dim"},
            {"lab": "缺陷 02", "h4": "分析一下", "p": "不是步骤——AI 不知道怎么分析。", "cls": "dim"},
        ]) + duo([
            {"lab": "缺陷 03", "h4": "写个周报", "p": "没写格式——AI 不知道交什么。", "cls": "dim"},
            {"lab": "缺陷 04", "h4": "写得好", "p": "不是验收——第三方无法判对错。", "cls": "dim"},
        ]) + tags([("相关数据", "no"), ("分析一下", "no"), ("写个周报", "no"), ("写得好", "no")]))
    s += slide_close("06", "06-close",
        "TAKEAWAY · Week 1 概念在 Week 2 各有一格", "输出+验收", " = 结构化输出 + Rubric",
        "<strong>四部件一个不能少</strong>",
        "FOUR PARTS", "输入<br/>步骤<br/>输出<br/>验收",
        [("01 · 输入", "吃什么料", "来源+范围+读者，写死不留黑洞。"),
         ("02 · 步骤", "怎么做", "动作动词开头，可照做不歧义。"),
         ("03 · 输出", "交什么货", "格式+长度+红线，对应结构化输出。"),
         ("04 · 验收", "怎么判", "可判对错，对应 Rubric 验收。")],
        "下一节 → 选品：高频、稳定、低险——第一个 Skill 选错了，后面写得再漂亮也跑不通。")
    gen_section(d, "第七天 · 第 2 节 · Skill 解剖四部件", "第七天 · 第 2 节",
        s, ["01-open", "02-core", "03-detail", "04-method", "05-extra", "06-close"])


def gen_s03():
    d = DAY / "section-03-pick-first"
    meta = '<span><b>FDE</b> Day 07 · Section 03</span><span>Skill 实战日 · 方法课</span><span>第三节</span>'
    s = ""
    s += slide_open("01", "01-open", "01-open.jpg", meta,
        "OPEN · 第一个 Skill 选品", "选错了", "后面再漂亮也跑不通",
        "三筛法：<strong>高频 → 稳定 → 低险</strong>",
        "第一个 Skill 选品决定你今天的成就感。选错了，后面写得再漂亮也跑不通，今天就会卡在验收。三筛法按顺序过，第一筛高频，第二筛稳定，第三筛低险。",
        [{"n": "01", "t": "高频", "hot": True}, {"n": "02", "t": "稳定"}, {"n": "03", "t": "低险"}, {"n": "04", "t": "打分"}],
        [("三筛法", "solid"), ("按顺序过", ""), ("低险硬筛", "hl")])
    s += slide_split("02", "02-core", "02-fail.jpg", "选品失败 · Unsplash",
        "CORE · 两个选品失败的故事", "小张和小李", "都栽在哪",
        "小张封装了一年一次的年报——写完再没用过，封装成本回不来。小李封装了处理客户投诉——每次情况都不同，没有稳定步骤可写。两个都栽在三筛上。",
        duo([
            {"lab": "小张的坑", "h4": "年报 · 一年一次", "p": "低频——封装成本回不来。第一筛（高频）就没过。", "cls": "dim"},
            {"lab": "小李的坑", "h4": "投诉 · 每次不同", "p": "不稳定——没有可写死的步骤。第二筛（稳定）就没过。", "cls": "dim"},
        ]) + tags([("低频别碰", "no"), ("不稳定别碰", "no"), ("三筛先过", "hl")]))
    s += slide_split("03", "03-detail", "03-three-filters.jpg", "三筛法 · Unsplash",
        "DETAIL · 三筛法按顺序过", "高频 → 稳定", " → 低险",
        "第一筛高频：每周至少做一次吗？低频的封装成本回不来。第二筛稳定：步骤能写成无歧义说明书吗？第三筛低险：出错代价小吗？对外发送、改数据、花钱的先别碰。",
        miles([{"n": "筛 01", "t": "高频", "s": "每周≥1次，封装成本才回得来", "hot": True}, {"n": "筛 02", "t": "稳定", "s": "步骤可写死，不是开盲盒", "hot": True}, {"n": "筛 03", "t": "低险", "s": "出错代价小，练信任优先", "hot": True}])
        + duo([
            {"lab": "过三筛", "h4": "周报生成", "p": "高频、结构稳定、不对外发送、数据可从驾驶舱拉。", "cls": "hot"},
            {"lab": "不过三筛", "h4": "年度总结", "p": "低频——一年一次，写完再没用过。", "cls": "dim"},
        ]))
    s += slide_split("04", "04-method", "04-low-risk.jpg", "低险优先 · Unsplash",
        "METHOD · 低险是硬筛", "第一个 Skill", "练的是信任",
        "对外发送、改数据库、花钱的事，先别碰。第一个 Skill 练的是你和 AI 的信任——错了代价要小。高险操作等 Day 9 学完确认闸再说。",
        '<div class="blk accent" data-anim="blk"><h4>低险优先</h4><p>第一个 Skill 是练信任——错了代价要小。对外发送/改数据/花钱的，Day 9 确认闸后再碰。</p></div>'
        + duo([
            {"lab": "低险 ✓", "h4": "周报生成", "p": "产出不对外发送，数据从驾驶舱拉——错了最多重跑。", "cls": "hot"},
            {"lab": "高险 ✗", "h4": "发报价邮件", "p": "对外发送、不可撤回——第一个 Skill 别碰。", "cls": "dim"},
        ]) + tags([("对外发送", "no"), ("改数据", "no"), ("花钱", "no"), ("低险优先", "hl")]))
    s += slide_split("05", "05-extra", "05-score.jpg", "打分表 · Unsplash",
        "EXTRA · 动手打分", "每项 1-5 分", "加一列数据可得",
        "高频、稳定、低险各打 1-5 分，加一列数据可得——输入能直接从驾驶舱或现有文件拿到的，今天就能跑通。拿不定就选两个候选打分，但定品只定一个。",
        chat([
            '<span class="u">周报</span> 高频5 稳定4 低险5 数据5 <span class="arrow">→</span> <span class="ok">19分 ✓</span>',
            '<span class="u">线索整理</span> 高频4 稳定3 低险4 数据4 <span class="arrow">→</span> <span class="ok">15分 ✓</span>',
            '<span class="u">年报</span> 高频1 稳定3 低险4 数据3 <span class="arrow">→</span> <span class="no">11分 ✗</span>',
            '<span class="u">发报价</span> 高频3 稳定2 低险1 数据3 <span class="arrow">→</span> <span class="no">9分 ✗</span>',
        ]) + tags([("高频1-5", ""), ("稳定1-5", ""), ("低险1-5", ""), ("数据可得", "hl")]))
    s += slide_close("06", "06-close",
        "TAKEAWAY · 带走一句", "今天只做", "一个 Skill，做透",
        "<strong>定品只定一个</strong>",
        "THREE FILTERS", "高频<br/>稳定<br/>低险",
        [("01 · 高频", "每周≥1次", "封装成本才回得来——第一筛。"),
         ("02 · 稳定", "步骤可写死", "不是开盲盒——第二筛。"),
         ("03 · 低险", "出错代价小", "练信任优先——硬筛。"),
         ("04 · 数据", "今天能跑通", "从驾驶舱或文件直接拿——加分项。")],
        "下一节 → 开写：skills/<name>.md，四部件齐全，倒着写，换人测试消歧义。")
    gen_section(d, "第七天 · 第 3 节 · 选品三筛", "第七天 · 第 3 节",
        s, ["01-open", "02-core", "03-detail", "04-method", "05-extra", "06-close"])


def gen_s04():
    d = DAY / "section-04-define-skill"
    meta = '<span><b>FDE</b> Day 07 · Section 04</span><span>Skill 实战日 · 实战课</span><span>第四节</span>'
    s = ""
    s += slide_open("01", "01-open", "01-open.jpg", meta,
        "OPEN · 开写 Skill", "三十分钟后", "skills/ 里要有你的说明书",
        "四部件齐全，<strong>commit 进 Git</strong>",
        "这节开写。三十分钟后，skills/ 目录里要有你的第一份 Skill 说明书——四部件齐全，commit 进 Git。带走两个库：动作动词写步骤，判据句式写验收。",
        [{"n": "01", "t": "动作动词", "hot": True}, {"n": "02", "t": "判据句式"}, {"n": "03", "t": "倒着写"}, {"n": "04", "t": "换人测试"}],
        [("skills/<name>.md", "solid"), ("commit", ""), ("倒着写", "hl")])
    s += slide_split("02", "02-core", "02-verbs.jpg", "动作动词 · Unsplash",
        "CORE · 步骤只许动作动词", "拉取 筛选 对比", "汇总 排序 找出",
        "步骤段只许出现动作动词：拉取、筛选、对比、汇总、排序、找出、计算、生成、检查、列出。「分析一下」「处理一下」不是步骤，是黑洞词。",
        chat([
            '<span class="u">✓ 动作动词</span> 拉取 /api/kpi 近7天数据',
            '<span class="u">✓ 动作动词</span> 筛选环比变化 >10% 的指标',
            '<span class="u">✓ 动作动词</span> 汇总成 Markdown 四段',
            '<span class="no">✗ 黑洞词</span> 分析一下数据 <span class="arrow">→</span> <span class="no">AI 不知道怎么分析</span>',
        ]) + tags([("拉取", "solid"), ("筛选", ""), ("对比", ""), ("汇总", ""), ("排序", ""), ("找出", "hl")]))
    s += slide_split("03", "03-detail", "03-criteria.jpg", "判据句式 · Unsplash",
        "DETAIL · 验收用判据句式", "结构判 + 数字判", " + 意图判",
        "验收段用判据句式：结构判 X 段齐全、含字段 A/B/C；数字判每个数字能在来源中找到出处；意图判当某值超阈值时标注异常并转人工。",
        miles([{"n": "结构", "t": "结构判", "s": "X 段齐全 + 含字段 A/B/C", "hot": True}, {"n": "数字", "t": "数字判", "s": "每个数字能在来源找到出处", "hot": True}, {"n": "意图", "t": "意图判", "s": "超阈值标注异常 + 转人工", "hot": True}])
        + duo([
            {"lab": "合格验收", "h4": "四段齐全+数字有出处", "p": "第三方能独立判过/不过——可衡量。", "cls": "hot"},
            {"lab": "不合格验收", "h4": "写得好", "p": "主观——第三方无法客观判对错。", "cls": "dim"},
        ]))
    s += slide_split("04", "04-method", "04-reverse.jpg", "倒着写 · Unsplash",
        "METHOD · 写作顺序倒着写", "输出 → 验收", " → 输入 → 步骤",
        "先写输出——交什么货；再写验收——怎么判；然后输入——吃什么料；最后步骤——从输入到输出怎么走。倒着写，因为输出和验收决定一切。",
        '<div class="blk accent" data-anim="blk"><h4>倒着写的逻辑</h4><p>输出和验收是目标，输入和步骤是路径。先定目标再定路径——和 PRD 先定验收标准同一套逻辑。</p></div>'
        + '<div class="flow" data-anim="flow"><div class="step hot">输出</div><div class="arrow">→</div><div class="step hot">验收</div><div class="arrow">→</div><div class="step">输入</div><div class="arrow">→</div><div class="step">步骤</div></div>'
        + tags([("先定目标", "solid"), ("再定路径", "hl")]))
    s += slide_split("05", "05-extra", "05-test.jpg", "换人测试 · Unsplash",
        "EXTRA · 换人测试消歧义", "同桌只看说明书", "说出要做什么怎么判",
        "写完做换人测试：同桌只看你的说明书，说出要做什么、怎么判好坏。他说错了，就是你写岔了——改说明书，不是教他。换人测试是最高效的消歧义。",
        duo([
            {"lab": "换人测试", "h4": "同桌照着说", "p": "只看说明书，说出要做什么、怎么判。说对了=合格。", "cls": "hot"},
            {"lab": "说错了", "h4": "改说明书", "p": "不是教他——是说明书有歧义。改完再测。", "cls": "dim"},
        ]) + tags([("换人测试", "solid"), ("消歧义", "hl")]))
    s += slide_close("06", "06-close",
        "TAKEAWAY · 带走两个库", "动作动词写步骤", "判据句式写验收",
        "<strong>换人测试消歧义</strong>",
        "TWO TOOLKITS", "动词<br/>+判据",
        [("01 · 步骤", "动作动词", "拉取/筛选/对比/汇总——不许黑洞词。"),
         ("02 · 验收", "判据句式", "结构判+数字判+意图判——可衡量。"),
         ("03 · 顺序", "倒着写", "输出→验收→输入→步骤——先定目标。"),
         ("04 · 测试", "换人测试", "同桌照着说——说错了改说明书。")],
        "下一节 → 运行一次：AI 拿着说明书上岗，你派活、收货、验收、留证据。")
    gen_section(d, "第七天 · 第 4 节 · 定义 Skill", "第七天 · 第 4 节",
        s, ["01-open", "02-core", "03-detail", "04-method", "05-extra", "06-close"])


def gen_s05():
    d = DAY / "section-05-run-evidence"
    meta = '<span><b>FDE</b> Day 07 · Section 05</span><span>Skill 实战日 · 实战课</span><span>第五节</span>'
    s = ""
    s += slide_open("01", "01-open", "01-open.jpg", meta,
        "OPEN · AI 拿着说明书上岗", "你的工作变成", "派活·收货·验收·留证",
        "不再是亲手做，<strong>是派活的人</strong>",
        "这节 AI 拿着你的说明书上岗。你的工作变成四步：派活、收货、按标准验收、留证据——不再是亲手做，是派活的人。",
        [{"n": "01", "t": "派活", "hot": True}, {"n": "02", "t": "收货"}, {"n": "03", "t": "验收"}, {"n": "04", "t": "留证"}],
        [("AI 执行", "solid"), ("你验收", ""), ("留证据", "hl")])
    s += slide_split("02", "02-core", "02-run.jpg", "运行方式 · Unsplash",
        "CORE · 怎么运行", "粘贴说明书", "再粘贴输入数据",
        "运行方式很简单：Agent Lab 或模型对话里，先粘贴 Skill 说明书全文，再粘贴输入数据——AI 按步骤执行，产出结果。你收货，按验收标准判过/不过。",
        chat([
            '<span class="u">Step 1</span> 粘贴 Skill 说明书全文',
            '<span class="u">Step 2</span> 粘贴输入数据（/api/kpi 近7天）',
            '<span class="arrow">→</span> <span class="a">AI 按步骤执行</span>',
            '<span class="u">Step 3</span> 收货 → 按验收标准判过/不过 <span class="ok">✓</span>',
        ]) + tags([("粘贴说明书", "solid"), ("粘贴数据", ""), ("AI执行", ""), ("你验收", "hl")]))
    s += slide_split("03", "03-detail", "03-evidence.jpg", "证据三件套 · Unsplash",
        "DETAIL · 每次运行留证据三件套", "runs/ 目录下", "input + output + 验收记录",
        "每次运行留证据三件套：runs/日期-skill名/ 目录下，input.md 是输入快照，output.md 是产出，result.md 是验收结果。没有证据的运行等于没跑。",
        miles([{"n": "01", "t": "input.md", "s": "输入快照——跑了什么数据", "hot": True}, {"n": "02", "t": "output.md", "s": "产出——AI 交了什么货", "hot": True}, {"n": "03", "t": "result.md", "s": "验收结果——过/不过+原因", "hot": True}])
        + duo([
            {"lab": "有证据", "h4": "可复查可回放", "p": "第三方打开 runs/ 即可验证——和 Eval 思维一致。", "cls": "hot"},
            {"lab": "没证据", "h4": "等于没跑", "p": "口头「跑过了」不算数——GATE 7 打回。", "cls": "dim"},
        ]))
    s += slide_split("04", "04-method", "04-debug.jpg", "验收不过 · Unsplash",
        "METHOD · 验收不过怎么办", "定位是歧义", "还是执行偏差",
        "验收不过，先定位是说明书歧义还是 AI 执行偏差。歧义就改说明书——多数情况是这个；偏差就换表达方式重跑。改完重跑，连续两次过才算稳。",
        duo([
            {"lab": "多数情况", "h4": "说明书歧义", "p": "步骤写得不够细——改说明书，不是怪 AI。", "cls": "hot"},
            {"lab": "少数情况", "h4": "AI 执行偏差", "p": "换表达方式重跑——加「严格按步骤顺序执行」。", "cls": "dim"},
        ]) + chat([
            '<span class="u">验收不过</span> → 定位：歧义 or 偏差？',
            '<span class="arrow">→</span> <span class="a">歧义</span> 改说明书 <span class="ok">多数</span>',
            '<span class="arrow">→</span> <span class="a">偏差</span> 换表达重跑 <span class="u">少数</span>',
            '<span class="u">连续两次过</span> <span class="arrow">→</span> <span class="ok">才算稳</span>',
        ]))
    s += slide_split("05", "05-extra", "05-fix.jpg", "AI 偏差修正 · Unsplash",
        "EXTRA · AI 不按步骤做怎么办", "加一句指令", "严格按步骤顺序执行",
        "AI 没按步骤做、直接跳到生成？在说明书开头加「严格按步骤顺序执行，每步完成后简述结果」。每次跑结果不一样？把模糊步骤拆细，拆到无歧义。",
        chat([
            '<span class="u">问题</span> AI 跳过步骤直接生成',
            '<span class="arrow">→</span> <span class="a">加</span> 「严格按步骤顺序执行，每步简述结果」',
            '<span class="u">问题</span> 每次跑结果不一样',
            '<span class="arrow">→</span> <span class="a">拆细</span> 模糊步骤拆到无歧义 <span class="ok">✓</span>',
        ]) + tags([("严格按步骤", "solid"), ("每步简述", ""), ("拆细", "hl")]))
    s += slide_close("06", "06-close",
        "TAKEAWAY · 带走一句", "没有证据", "等于没跑",
        "<strong>runs/ 是你的证据链</strong>",
        "FOUR STEPS", "派活<br/>收货<br/>验收<br/>留证",
        [("01 · 派活", "粘贴说明书+数据", "AI 按步骤执行——你不再亲手做。"),
         ("02 · 收货", "收 AI 的产出", "按验收标准判过/不过。"),
         ("03 · 验收", "判据句式逐条判", "结构+数字+意图——可判对错。"),
         ("04 · 留证", "runs/ 三件套", "input+output+result——可复查。")],
        "下一节 → GATE 7 验收：Skill 三问口试，导师看证据链。")
    gen_section(d, "第七天 · 第 5 节 · 运行与证据", "第七天 · 第 5 节",
        s, ["01-open", "02-core", "03-detail", "04-method", "05-extra", "06-close"])


def gen_s06():
    d = DAY / "section-06-accept"
    meta = '<span><b>FDE</b> Day 07 · Section 06</span><span>Skill 实战日 · 验收课</span><span>第六节</span>'
    s = ""
    s += slide_open("01", "01-open", "01-open.jpg", meta,
        "OPEN · 第七天验收", "第二周第一关", "Skill 三问 + GATE 7",
        "三问脱口而出，<strong>证据链完整</strong>",
        "第七天验收，第二周第一关。第一周最后一天，你的驾驶舱上线了；第七天，你的第一个同事上岗了——这个同事是 AI，拿着你写的 Skill 说明书。",
        [{"n": "问 01", "t": "做什么", "hot": True}, {"n": "问 02", "t": "步骤谁定"}, {"n": "问 03", "t": "好坏谁判"}],
        [("三问口答", "solid"), ("证据链", ""), ("GATE 7", "hl")])
    s += slide_split("02", "02-core", "02-three-q.jpg", "三问 · Unsplash",
        "CORE · Skill 三问", "脱口而出", "输入→输出 / 步骤谁定 / 好坏谁判",
        "第一问它做什么？输入到输出，一句话：吃某某，交某某。第二问步骤谁定？你定的，写在说明书里。第三问好坏谁判？验收标准判，可判对错。",
        chat([
            '<span class="u">Q1</span> 它做什么？ <span class="arrow">→</span> <span class="a">吃某某，交某某</span>',
            '<span class="u">Q2</span> 步骤谁定？ <span class="arrow">→</span> <span class="a">你定的，写在说明书</span>',
            '<span class="u">Q3</span> 好坏谁判？ <span class="arrow">→</span> <span class="a">验收标准，可判对错</span>',
            '<span class="ok">三问脱口而出 = 理解到位</span>',
        ]) + tags([("做什么", "solid"), ("步骤谁定", ""), ("好坏谁判", "hl")]))
    s += slide_split("03", "03-detail", "03-evidence-chain.jpg", "证据链 · Unsplash",
        "DETAIL · 证据链验收", "说明书 + 三件套", " + 连续两次过",
        "skills/ 里的说明书、runs/ 里的三件套、连续两次验收全过，全部进 Git。导师抽查判据，你要能指到 runs/ 里的具体文件——口头「跑过了」不算数。",
        miles([{"n": "01", "t": "skills/", "s": "说明书进 Git——四部件齐全", "hot": True}, {"n": "02", "t": "runs/", "s": "三件套——input+output+result", "hot": True}, {"n": "03", "t": "连续两次过", "s": "验收全过——才算稳", "hot": True}])
        + duo([
            {"lab": "证据可查", "h4": "指到具体文件", "p": "导师抽查判据，你打开 runs/ 指到 result.md。", "cls": "hot"},
            {"lab": "口头汇报", "h4": "不算数", "p": "「跑过了」没有证据——GATE 7 打回。", "cls": "dim"},
        ]))
    s += slide_split("04", "04-method", "04-gate.jpg", "GATE 7 清单 · Unsplash",
        "METHOD · GATE 7 清单", "能跑 + 有证据", " + 可交接",
        "GATE 7 清单：Skill 三问脱口而出；证据链完整；抽查判据能指证据；commit 信息写 feat: 第一个 Skill——你的 Skill 名称。一天就做了一个 Skill，少吗？第一个做透比什么都重要。",
        miles([{"n": "01", "t": "三问", "s": "脱口而出——做什么/步骤谁定/好坏谁判", "hot": True}, {"n": "02", "t": "证据", "s": "runs/ 三件套——input+output+result", "hot": True}, {"n": "03", "t": "判据", "s": "抽查能指证——指到具体文件", "hot": True}, {"n": "04", "t": "commit", "s": "feat: 第一个 Skill——<你的 Skill 名>", "hot": True}])
        + tags([("三问", "solid"), ("证据链", ""), ("抽查", ""), ("commit", "hl")]))
    s += slide_close("05", "05-extra",
        "TAKEAWAY · 带走一句", "第一个做透", "比什么都重要",
        "<strong>说明书就是交接物</strong>",
        "GATE 7", "三问<br/>+证据<br/>+commit",
        [("01 · 三问", "脱口而出", "做什么/步骤谁定/好坏谁判——口答。"),
         ("02 · 证据", "runs/ 三件套", "input+output+result——可复查。"),
         ("03 · 判据", "抽查能指证", "导师抽查，你指到具体文件。"),
         ("04 · commit", "进 Git", "feat: 第一个 Skill——<你的 Skill 名>")],
        "下一节 → Day 8：Agent 全家桶——你的 Skill 是 Agent 的工具，MCP 是接工具的标准。")
    gen_section(d, "第七天 · 第 6 节 · Skill 三问 + GATE 7", "第七天 · 第 6 节",
        s, ["01-open", "02-core", "03-detail", "04-method", "05-extra"])


def main():
    print("Generating Day 07 section index.html...")
    gen_s01()
    gen_s02()
    gen_s03()
    gen_s04()
    gen_s05()
    gen_s06()
    print("Done. 6 sections generated.")


if __name__ == "__main__":
    main()
