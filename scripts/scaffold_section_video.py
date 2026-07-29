#!/usr/bin/env python3
"""Scaffold HyperFrames index.html from narration manifest + S01 assets."""
from __future__ import annotations

import argparse
import json
import re
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BC = ROOT / "class" / "bootcamp"
GOLD = BC / "day-05" / "section-01-worldview-plain" / "video"
sys.path.insert(0, str(ROOT / "scripts"))
from bootcamp_sections import section_dirs  # noqa: E402


def lesson_title(section_dir: Path) -> str:
    md = section_dir / "lesson.md"
    if md.is_file():
        m = re.search(r"^# (.+)$", md.read_text(encoding="utf-8"), re.M)
        if m:
            return re.sub(r"^第 \d+ 节 · ", "", m.group(1).strip())
    return section_dir.name


def diagram_src(section_dir: Path) -> str | None:
    md = section_dir / "lesson.md"
    if not md.is_file():
        return None
    m = re.search(r"!\[[^\]]*\]\(([^)]+diagrams/[^)]+)\)", md.read_text(encoding="utf-8"))
    if not m:
        return None
    rel = m.group(1)
    # ../../assets/diagrams/foo.svg -> copy hint
    name = Path(rel).name
    return f"assets/diagrams/{name}"


def build_html(
    day: int,
    sec: str,
    title: str,
    segments: list[dict],
    diagram: str | None,
    narr_dir: Path,
) -> str:
    total_est = max(120.0, len(segments) * 22.0)
    slides = []
    gsap = []
    t = 0.0
    est = total_est / len(segments)
    for i, seg in enumerate(segments):
        sid = seg["id"]
        start = t
        dur = est
        t += dur + 0.25
        num = f"{i+1:02d}"
        label = sid.split("-", 1)[-1].upper().replace("-", " ")
        body = (narr_dir / seg["file"]).read_text(encoding="utf-8").strip()
        headline = body.split("。")[0][:28] + ("…" if len(body.split("。")[0]) > 28 else "")
        diag_block = ""
        if diagram and i == len(segments) // 2:
            diag_block = f'''
          <div class="diagram-box" data-anim="diagram">
            <div class="dg-cap">讲解图 · {title}</div>
            <img src="{diagram}" alt="" />
          </div>'''
        slides.append(f'''
      <section id="slide-{sid}" class="clip slide" data-track-index="1" data-start="{start:.3f}" data-duration="{dur:.3f}">
        <div class="stage-fill"></div>
        <div class="slide-body">
          <div class="sec-label" data-anim="k"><span class="num">{num}</span>{label}</div>
          <h1 class="display" data-anim="t">{headline}</h1>
          <p class="lede" data-anim="s">{body[:180]}{"…" if len(body)>180 else ""}</p>{diag_block}
        </div>
      </section>''')
        soft = max(0.0, start + dur - 0.45)
        hard = start + dur
        gsap.append(f'      enter("#slide-{sid}", {start:.3f});')
        if i < len(segments) - 1:
            gsap.append(f'      exit("#slide-{sid}", {soft:.3f}, {hard:.3f});')

    gsap_body = "\n".join(gsap)
    return f'''<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=1920, height=1080" />
<title>Day{day:02d} S{sec} · {title}</title>
<script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
<style>
@font-face{{font-family:"Noto Sans SC";src:url("assets/fonts/NotoSansSC-Regular.woff2") format("woff2");font-weight:400;font-display:block}}
@font-face{{font-family:"Noto Sans SC";src:url("assets/fonts/NotoSansSC-Bold.woff2") format("woff2");font-weight:700;font-display:block}}
@font-face{{font-family:"Noto Serif SC";src:url("assets/fonts/NotoSerifSC-Bold.woff2") format("woff2");font-weight:700;font-display:block}}
@font-face{{font-family:"JetBrains Mono";src:url("assets/fonts/JetBrainsMono-Bold.woff2") format("woff2");font-weight:700;font-display:block}}
:root{{--bg:#f2f5f0;--ink:#231f20;--ink-60:rgba(35,31,32,.72);--accent:#1400ff;--serif:"Noto Serif SC",serif;--sans:"Noto Sans SC",sans-serif;--mono:"JetBrains Mono",monospace}}
*{{margin:0;padding:0;box-sizing:border-box}}
html,body{{margin:0;width:1920px;height:1080px;overflow:hidden;background:#000;font-family:var(--sans);color:var(--ink)}}
#root{{position:relative;width:1920px;height:1080px;overflow:hidden}}
.stage-bg{{position:absolute;inset:0;background:var(--bg);z-index:0}}
.slide{{position:absolute;inset:0;z-index:2;padding:72px 420px 72px 96px}}
.stage-fill{{position:absolute;inset:0;background:var(--bg);z-index:0}}
.slide-body{{position:relative;z-index:2;height:100%}}
.sec-label{{font-family:var(--mono);font-size:15px;letter-spacing:.18em;text-transform:uppercase;color:var(--ink-60);display:flex;align-items:center;gap:14px;margin-bottom:22px}}
.sec-label::after{{content:"";flex:1;height:6px;background:var(--ink);max-width:520px}}
.sec-label .num{{color:var(--accent);font-weight:700}}
.display{{font-family:var(--serif);font-weight:700;font-size:72px;line-height:1.12;margin-bottom:18px;max-width:16ch}}
.lede{{font-size:22px;line-height:1.55;color:var(--ink-60);max-width:34em}}
.diagram-box{{border:1px solid var(--ink);padding:14px;background:#fff;margin-top:16px;max-width:980px}}
.diagram-box .dg-cap{{font-family:var(--mono);font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--ink-60);margin-bottom:10px}}
.diagram-box img{{width:100%;max-height:320px;object-fit:contain;display:block}}
.brand-bar{{position:absolute;left:96px;bottom:36px;z-index:20;font-family:var(--mono);font-size:13px;letter-spacing:.16em;text-transform:uppercase;color:rgba(35,31,32,.55)}}
.brand-bar em{{font-style:normal;color:var(--accent)}}
#avatar-pip{{position:absolute;right:40px;bottom:36px;z-index:30;width:248px;height:380px;display:flex;flex-direction:column}}
.avatar-frame{{flex:1;overflow:hidden;border:2px solid var(--ink);border-bottom:none;box-shadow:8px 8px 0 var(--accent);background:#0b1220}}
.avatar-frame video{{width:100%;height:100%;object-fit:cover;object-position:50% 22%;display:block}}
.avatar-caption{{height:30px;line-height:30px;font-family:var(--mono);font-size:11px;letter-spacing:.12em;text-transform:uppercase;text-align:center;background:var(--ink);color:#f2f5f0;border:2px solid var(--ink);border-top:none}}
.speak-ring{{position:absolute;inset:-8px;border:2px solid var(--accent);opacity:.35;pointer-events:none}}
</style>
</head>
<body>
<div id="root" data-composition-id="main" data-start="0" data-duration="{total_est:.3f}" data-width="1920" data-height="1080">
<div class="stage-bg"></div>
{"".join(slides)}
<div id="brand-bar" class="brand-bar clip" data-start="0" data-duration="{total_est:.3f}" data-track-index="2">FDE<em>·</em>训练营 <em>/</em> Day {day:02d} · {sec}</div>
<div id="avatar-pip" class="clip" data-start="0" data-duration="{total_est:.3f}" data-track-index="5">
<div class="speak-ring"></div>
<div class="avatar-frame"><video id="avatar-lipsync" class="clip" src="assets/avatar-lipsync.mp4" muted playsinline preload="auto" data-start="0" data-duration="{total_est:.3f}" data-track-index="6"></video></div>
<div class="avatar-caption">Lecturer · 口播</div>
</div>
<audio id="narration" class="clip" src="audio/narration-full.wav" data-start="0" data-duration="{total_est:.3f}" data-track-index="10" data-volume="1"></audio>
</div>
<script>
window.__timelines = window.__timelines || {{}};
const tl = gsap.timeline({{ paused: true }});
function enter(id, t0) {{
  tl.from(`${{id}} .slide-body`, {{ opacity: 0, y: 28, duration: 0.55, ease: "power3.out" }}, t0);
  tl.from(`${{id}} [data-anim='k']`, {{ y: 18, opacity: 0, duration: 0.4, ease: "power2.out" }}, t0 + 0.12);
  tl.from(`${{id}} [data-anim='t']`, {{ y: 36, opacity: 0, duration: 0.55, ease: "power3.out" }}, t0 + 0.22);
  tl.from(`${{id}} [data-anim='s']`, {{ y: 20, opacity: 0, duration: 0.45, ease: "power2.out" }}, t0 + 0.36);
  tl.from(`${{id}} [data-anim='diagram']`, {{ y: 16, opacity: 0, duration: 0.45, ease: "power2.out" }}, t0 + 0.5);
}}
function exit(id, tEnd, tHard) {{
  tl.to(`${{id}} .slide-body`, {{ opacity: 0, y: -18, duration: 0.4, ease: "power2.in" }}, tEnd);
  tl.set(`${{id}} .slide-body`, {{ opacity: 0 }}, tHard);
}}
{gsap_body}
tl.from("#avatar-pip", {{ opacity: 0, y: 28, duration: 0.7, ease: "power3.out" }}, 0.25);
window.__timelines["main"] = tl;
</script>
</body>
</html>'''


def scaffold(day: int, sec: str) -> Path:
    global section_dir
    mapping = section_dirs(day)
    if sec not in mapping:
        raise SystemExit(f"day {day} has no section {sec}; have {list(mapping)}")
    section_dir = BC / f"day-{day:02d}" / mapping[sec]
    video = section_dir / "video"
    narr = video / "scripts" / "narration"
    manifest = json.loads((narr / "manifest.json").read_text(encoding="utf-8"))
    title = lesson_title(section_dir)
    diagram = diagram_src(section_dir)

    for sub in ("assets/fonts", "assets/diagrams", "audio", "renders"):
        (video / sub).mkdir(parents=True, exist_ok=True)
    fonts = GOLD / "assets" / "fonts"
    if fonts.is_dir():
        shutil.copytree(fonts, video / "assets" / "fonts", dirs_exist_ok=True)
    portrait = GOLD / "assets" / "lecturer-portrait.jpg"
    if portrait.is_file():
        shutil.copy2(portrait, video / "assets" / "lecturer-portrait.jpg")

    if diagram:
        src_name = Path(diagram).name
        for cand in [
            ROOT / "class" / "assets" / "diagrams" / src_name,
            section_dir.parent.parent.parent / "assets" / "diagrams" / src_name,
            ROOT / "class" / "assets" / "diagrams" / src_name,
        ]:
            if cand.is_file():
                shutil.copy2(cand, video / "assets" / "diagrams" / src_name)
                break

    pkg = video / "package.json"
    if not pkg.is_file():
        shutil.copy2(GOLD / "package.json", pkg)
    hf = video / "hyperframes.json"
    if not hf.is_file():
        shutil.copy2(GOLD / "hyperframes.json", hf)

    html = build_html(day, sec, title, manifest, diagram, narr)
    (video / "index.html").write_text(html, encoding="utf-8")
    print(f"scaffolded {video / 'index.html'}")
    return video


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--day", type=int, required=True)
    ap.add_argument("--section", required=True)
    args = ap.parse_args()
    scaffold(args.day, args.section.zfill(2))


if __name__ == "__main__":
    main()
