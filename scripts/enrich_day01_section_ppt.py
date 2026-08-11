#!/usr/bin/env python3
"""Enrich Day1 section PPT (index.html) to s01 density: icons + open-split + SVG diagrams.

Reuses existing slide ids / timings from index.html + PPT_AND_NARRATION.md bullets.
Does NOT change narration/audio/lipsync. Run patch_section_video_timing.py after.
"""
from __future__ import annotations

import argparse
import html as html_lib
import json
import re
import xml.sax.saxutils as xu
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BC = ROOT / "class" / "bootcamp"
ICONS = [
    '<path d="M8 4H4v16h4"/><path d="M16 4h4v16h-4"/><path d="M10 12h4"/>',
    '<circle cx="12" cy="12" r="8"/><path d="M12 8v5l3 2"/>',
    '<path d="M4 12h16"/><path d="M12 4l8 8-8 8"/>',
    '<path d="M5 12l4 4L19 6"/>',
    '<path d="M12 3l2.2 4.5L19 8.2l-3.5 3.4.8 4.9L12 14.2 7.7 16.5l.8-4.9L5 8.2l4.8-.7L12 3z"/>',
    '<rect x="3" y="4" width="18" height="14"/><path d="M7 14l3-3 2 2 4-5"/>',
    '<circle cx="9" cy="8" r="3"/><path d="M3 19c1-3 3.5-5 6-5s5 2 6 5"/>',
    '<rect x="4" y="3" width="12" height="14"/><rect x="8" y="7" width="12" height="14"/>',
]

CSS = r"""
@font-face{font-family:"Noto Sans SC";src:url("assets/fonts/NotoSansSC-Regular.woff2") format("woff2");font-weight:400;font-display:block}
@font-face{font-family:"Noto Sans SC";src:url("assets/fonts/NotoSansSC-Bold.woff2") format("woff2");font-weight:700;font-display:block}
@font-face{font-family:"Noto Serif SC";src:url("assets/fonts/NotoSerifSC-Bold.woff2") format("woff2");font-weight:700;font-display:block}
@font-face{font-family:"JetBrains Mono";src:url("assets/fonts/JetBrainsMono-Bold.woff2") format("woff2");font-weight:700;font-display:block}
:root{--bg:#f2f5f0;--ink:#231f20;--ink-60:rgba(35,31,32,.72);--ink-40:rgba(35,31,32,.55);--ink-08:rgba(35,31,32,.08);--ink-05:rgba(35,31,32,.05);--accent:#1400ff;--serif:"Noto Serif SC",serif;--sans:"Noto Sans SC",sans-serif;--mono:"JetBrains Mono",monospace}
*{margin:0;padding:0;box-sizing:border-box}
html{margin:0;background:#111}
html.browser-preview{overflow:hidden;height:100%}
body{margin:0;width:1920px;height:1080px;overflow:hidden;background:#000;font-family:var(--sans);color:var(--ink);-webkit-font-smoothing:antialiased}
#root{position:relative;width:1920px;height:1080px;overflow:hidden}
.stage-bg{position:absolute;inset:0;background:var(--bg);z-index:0}
.slide{position:absolute;inset:0;z-index:2;padding:72px 420px 72px 96px}
.stage-fill{position:absolute;inset:0;background:var(--bg);z-index:0}
.slide-body{position:relative;z-index:2;height:100%;display:flex;flex-direction:column}
.sec-label{font-family:var(--mono);font-size:15px;letter-spacing:.18em;text-transform:uppercase;color:var(--ink-60);display:flex;align-items:center;gap:14px;margin-bottom:14px}
.sec-label::after{content:"";flex:1;height:6px;background:var(--ink);max-width:520px}
.sec-label .num{color:var(--accent);font-weight:700}
.display{font-family:var(--serif);font-weight:700;font-size:52px;line-height:1.12;margin-bottom:10px;max-width:16ch}
.lede{font-size:18px;line-height:1.5;color:var(--ink-60);max-width:34em;margin-bottom:12px}
.card{border:1px solid var(--ink);padding:16px 18px 18px;background:rgba(255,255,255,.55)}
.card .lab{font-family:var(--mono);font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--accent);margin-bottom:0;font-weight:700}
.card h4{font-family:var(--serif);font-size:20px;font-weight:700;margin-bottom:6px;line-height:1.25}
.card p{font-size:15px;line-height:1.45;color:var(--ink-60)}
.card.hot{background:var(--accent);color:#fff;border-color:var(--accent)}
.card.hot .lab{color:rgba(255,255,255,.7)}
.card.hot p{color:rgba(255,255,255,.85)}
.card.dim{background:var(--ink-05)}
.open-split{display:grid;grid-template-columns:1.05fr .95fr;gap:20px;align-items:stretch;margin-top:4px;max-width:1320px;flex:1;min-height:0}
.open-split .stack{display:flex;flex-direction:column;gap:12px;min-width:0}
.card-head{display:flex;align-items:center;gap:12px;margin-bottom:8px}
.ico{width:40px;height:40px;border:1.5px solid var(--ink);background:#fff;display:flex;align-items:center;justify-content:center;flex:none}
.ico svg{width:24px;height:24px;display:block}
.card.hot .ico{border-color:rgba(255,255,255,.55);background:rgba(255,255,255,.12)}
.diagram-box{border:1px solid var(--ink);padding:12px;background:#fff;display:flex;flex-direction:column;min-height:0;height:100%}
.diagram-box .dg-cap{font-family:var(--mono);font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--ink-60);margin-bottom:8px;display:flex;align-items:center;gap:12px;flex:none}
.diagram-box .dg-cap::before{content:"";width:26px;height:6px;background:var(--accent)}
.diagram-box img{width:100%;flex:1;object-fit:contain;display:block;min-height:0;max-height:420px}
.tag-row{display:flex;flex-wrap:wrap;gap:8px;margin-top:2px}
.tag{font-family:var(--mono);font-size:12px;padding:8px 12px;border:1px solid var(--ink);background:#fff}
.tag.solid,.tag.hl{background:var(--accent);color:#fff;border-color:var(--accent)}
.tag.hot{border-color:var(--accent);color:var(--accent)}
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


def parse_ppt(md: str) -> list[dict]:
    slides = []
    blocks = re.split(r"\n##\s+", md)
    for block in blocks[1:]:
        if block.startswith("评审"):
            continue
        lines = block.strip().splitlines()
        head = lines[0].strip()
        m = re.match(r"(\d+)\s*·\s*(.+)", head)
        if not m:
            continue
        num, slug = m.group(1), m.group(2).strip()
        bullets: list[str] = []
        in_ppt = False
        for ln in lines[1:]:
            if ln.strip().startswith("**PPT"):
                in_ppt = True
                continue
            if ln.strip().startswith("**口播") or ln.strip().startswith("文稿："):
                break
            if in_ppt and ln.strip().startswith("- "):
                bullets.append(ln.strip()[2:].strip())
        if bullets:
            slides.append({"num": num.zfill(2), "slug": slug, "bullets": bullets})
    return slides


def extract_slide_meta(index_html: str) -> list[dict]:
    out = []
    for m in re.finditer(
        r'<section id="slide-([^"]+)"[^>]*data-start="([\d.]+)"[^>]*data-duration="([\d.]+)"',
        index_html,
    ):
        out.append({"id": m.group(1), "start": float(m.group(2)), "dur": float(m.group(3))})
    return out


def extract_total(index_html: str) -> float:
    m = re.search(r'id="root"[^>]*data-duration="([\d.]+)"', index_html)
    return float(m.group(1)) if m else 0.0


def esc(s: str) -> str:
    return html_lib.escape(s, quote=True)


DIAG_LIB = ROOT / "class" / "assets" / "diagrams"
ACCENT = "#1400ff"
INK = "#231f20"
BG = "#f2f5f0"


def _t(s: str, n: int = 18) -> str:
    return xu.escape((s or "").strip()[:n])


def _header(kind: str, title: str) -> str:
    return (
        f'<rect width="560" height="460" fill="{BG}"/>'
        f'<text x="28" y="34" font-family="Menlo,monospace" font-size="11" font-weight="700" '
        f'letter-spacing="2" fill="{ACCENT}">DIAGRAM · {xu.escape(kind.upper())}</text>'
        f'<text x="28" y="64" font-family="serif" font-size="22" font-weight="700" fill="{INK}">{_t(title, 16)}</text>'
    )


def _arrow_defs() -> str:
    return (
        '<defs><marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">'
        f'<path d="M0 0 L10 5 L0 10 z" fill="{INK}"/></marker></defs>'
    )


def svg_stack(title: str, items: list[str], hot_idx: int) -> str:
    rows = []
    for i, b in enumerate(items[:5]):
        y = 88 + i * 58
        hot = i == hot_idx
        fill = ACCENT if hot else "#fff"
        color = "#fff" if hot else INK
        rows.append(
            f'<rect x="40" y="{y}" width="480" height="48" fill="{fill}" stroke="{INK}" stroke-width="1.6"/>'
            f'<text x="56" y="{y + 18}" font-family="Menlo,monospace" font-size="11" fill="{ACCENT if not hot else "rgba(255,255,255,.7)"}">'
            f'{i + 1:02d}</text>'
            f'<text x="92" y="{y + 30}" font-family="sans-serif" font-size="16" font-weight="700" fill="{color}">{_t(b, 22)}</text>'
        )
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 560 460" role="img">{_header("stack", title)}{"".join(rows)}</svg>'


def svg_flow(title: str, items: list[str], hot_idx: int) -> str:
    items = items[:4] or ["步骤"]
    n = len(items)
    gap = 10
    w = (480 - gap * (n - 1)) / n
    parts = [_arrow_defs()]
    for i, b in enumerate(items):
        x = 40 + i * (w + gap)
        hot = i == hot_idx
        fill = ACCENT if hot else "#fff"
        color = "#fff" if hot else INK
        parts.append(
            f'<rect x="{x:.1f}" y="120" width="{w:.1f}" height="220" fill="{fill}" stroke="{INK}" stroke-width="1.8"/>'
            f'<circle cx="{x + w / 2:.1f}" cy="168" r="22" fill="{"#fff" if hot else ACCENT}"/>'
            f'<text x="{x + w / 2:.1f}" y="174" text-anchor="middle" font-family="Menlo,monospace" font-size="14" '
            f'font-weight="700" fill="{ACCENT if hot else "#fff"}">{i + 1:02d}</text>'
            f'<text x="{x + w / 2:.1f}" y="230" text-anchor="middle" font-family="serif" font-size="17" '
            f'font-weight="700" fill="{color}">{_t(b, 8)}</text>'
            f'<text x="{x + w / 2:.1f}" y="258" text-anchor="middle" font-family="sans-serif" font-size="12" '
            f'fill="{"rgba(255,255,255,.8)" if hot else "rgba(35,31,32,.55)"}">{_t(b, 12)}</text>'
        )
        if i < n - 1:
            x1 = x + w + 2
            x2 = x + w + gap - 2
            parts.append(
                f'<line x1="{x1:.1f}" y1="230" x2="{x2:.1f}" y2="230" stroke="{INK}" stroke-width="2" marker-end="url(#arr)"/>'
            )
    parts.append(
        f'<rect x="40" y="372" width="480" height="48" fill="{ACCENT}"/>'
        f'<text x="280" y="402" text-anchor="middle" font-family="sans-serif" font-size="15" font-weight="700" fill="#fff">'
        f'{_t(" → ".join(items[:4]), 36)}</text>'
    )
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 560 460" role="img">{_header("flow", title)}{"".join(parts)}</svg>'


def svg_vflow(title: str, items: list[str], hot_idx: int) -> str:
    items = items[:5] or ["步骤"]
    parts = [_arrow_defs()]
    for i, b in enumerate(items):
        y = 88 + i * 62
        hot = i == hot_idx
        fill = ACCENT if hot else "#fff"
        color = "#fff" if hot else INK
        parts.append(
            f'<rect x="70" y="{y}" width="420" height="48" fill="{fill}" stroke="{INK}" stroke-width="1.6"/>'
            f'<circle cx="98" cy="{y + 24}" r="14" fill="{"#fff" if hot else ACCENT}"/>'
            f'<text x="98" y="{y + 29}" text-anchor="middle" font-family="Menlo,monospace" font-size="11" '
            f'font-weight="700" fill="{ACCENT if hot else "#fff"}">{i + 1}</text>'
            f'<text x="128" y="{y + 30}" font-family="sans-serif" font-size="16" font-weight="700" fill="{color}">{_t(b, 24)}</text>'
        )
        if i < len(items) - 1:
            parts.append(
                f'<line x1="280" y1="{y + 48}" x2="280" y2="{y + 62}" stroke="{INK}" stroke-width="2" marker-end="url(#arr)"/>'
            )
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 560 460" role="img">{_header("pipeline", title)}{"".join(parts)}</svg>'


def svg_compare(title: str, items: list[str], hot_idx: int) -> str:
    mid = max(1, len(items) // 2)
    left, right = items[:mid] or ["A"], items[mid:] or ["B"]
    left_t, right_t = left[0], right[0]
    left_body, right_body = left[1:] or left, right[1:] or right

    def col(x: float, head: str, body: list[str], hot: bool) -> str:
        fill = ACCENT if hot else "#fff"
        color = "#fff" if hot else INK
        rows = [
            f'<rect x="{x}" y="88" width="228" height="300" fill="{fill}" stroke="{INK}" stroke-width="2"/>',
            f'<rect x="{x}" y="88" width="228" height="54" fill="{"#0a0080" if hot else ACCENT}"/>',
            f'<text x="{x + 114}" y="122" text-anchor="middle" font-family="serif" font-size="18" font-weight="700" fill="#fff">{_t(head, 10)}</text>',
        ]
        for i, b in enumerate(body[:5]):
            yy = 170 + i * 36
            rows.append(
                f'<text x="{x + 24}" y="{yy}" font-family="sans-serif" font-size="14" font-weight="600" fill="{color}">· {_t(b, 12)}</text>'
            )
        return "".join(rows)

    body = (
        col(40, left_t, left_body, hot_idx % 2 == 0)
        + col(292, right_t, right_body, hot_idx % 2 == 1)
        + f'<text x="280" y="420" text-anchor="middle" font-family="Menlo,monospace" font-size="13" font-weight="700" fill="{ACCENT}">VS · 对照看差异</text>'
    )
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 560 460" role="img">{_header("compare", title)}{body}</svg>'


def svg_triad(title: str, items: list[str], hot_idx: int) -> str:
    items = (items[:3] + ["—", "—", "—"])[:3]
    parts = []
    w = 148
    for i, b in enumerate(items):
        x = 40 + i * (w + 18)
        hot = i == (hot_idx % 3)
        fill = ACCENT if hot else "#fff"
        color = "#fff" if hot else INK
        parts.append(
            f'<rect x="{x}" y="100" width="{w}" height="260" fill="{fill}" stroke="{INK}" stroke-width="1.8"/>'
            f'<circle cx="{x + w / 2}" cy="160" r="28" fill="{"#fff" if hot else ACCENT}"/>'
            f'<text x="{x + w / 2}" y="166" text-anchor="middle" font-family="Menlo,monospace" font-size="16" '
            f'font-weight="700" fill="{ACCENT if hot else "#fff"}">{i + 1:02d}</text>'
            f'<text x="{x + w / 2}" y="230" text-anchor="middle" font-family="serif" font-size="18" '
            f'font-weight="700" fill="{color}">{_t(b, 7)}</text>'
            f'<text x="{x + w / 2}" y="262" text-anchor="middle" font-family="sans-serif" font-size="13" '
            f'fill="{"rgba(255,255,255,.85)" if hot else "rgba(35,31,32,.55)"}">{_t(b, 10)}</text>'
        )
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 560 460" role="img">{_header("triad", title)}{"".join(parts)}</svg>'


def svg_layers(title: str, items: list[str], hot_idx: int) -> str:
    items = items[:5] or ["层"]
    n = len(items)
    h = min(56, int(280 / n))
    parts = []
    for i, b in enumerate(items):
        inset = i * 18
        y = 96 + i * (h + 10)
        hot = i == hot_idx
        fill = ACCENT if hot else "#fff"
        color = "#fff" if hot else INK
        parts.append(
            f'<rect x="{40 + inset}" y="{y}" width="{480 - 2 * inset}" height="{h}" fill="{fill}" stroke="{INK}" stroke-width="1.8"/>'
            f'<text x="280" y="{y + h / 2 + 6:.0f}" text-anchor="middle" font-family="sans-serif" font-size="16" '
            f'font-weight="700" fill="{color}">{_t(b, 18)}</text>'
        )
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 560 460" role="img">{_header("layers", title)}{"".join(parts)}</svg>'


def svg_grid(title: str, items: list[str], hot_idx: int) -> str:
    items = (items + ["", "", "", ""])[:4]
    parts = []
    for i, b in enumerate(items):
        col, row = i % 2, i // 2
        x, y = 40 + col * 240, 96 + row * 160
        hot = i == (hot_idx % 4)
        fill = ACCENT if hot else "#fff"
        color = "#fff" if hot else INK
        parts.append(
            f'<rect x="{x}" y="{y}" width="220" height="140" fill="{fill}" stroke="{INK}" stroke-width="1.8"/>'
            f'<text x="{x + 18}" y="{y + 34}" font-family="Menlo,monospace" font-size="12" fill="{ACCENT if not hot else "rgba(255,255,255,.75)"}">{i + 1:02d}</text>'
            f'<text x="{x + 18}" y="{y + 78}" font-family="serif" font-size="20" font-weight="700" fill="{color}">{_t(b, 10)}</text>'
            f'<text x="{x + 18}" y="{y + 108}" font-family="sans-serif" font-size="13" fill="{"rgba(255,255,255,.8)" if hot else "rgba(35,31,32,.55)"}">{_t(b, 14)}</text>'
        )
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 560 460" role="img">{_header("grid", title)}{"".join(parts)}</svg>'


def svg_cycle(title: str, items: list[str], hot_idx: int) -> str:
    items = (items[:4] + ["A", "B", "C", "D"])[:4]
    cx, cy, r = 280, 250, 118
    parts = [
        _arrow_defs(),
        f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="none" stroke="{INK}" stroke-width="2" stroke-dasharray="6 6"/>',
        f'<circle cx="{cx}" cy="{cy}" r="46" fill="{ACCENT}"/>',
        f'<text x="{cx}" y="{cy + 6}" text-anchor="middle" font-family="Menlo,monospace" font-size="12" font-weight="700" fill="#fff">LOOP</text>',
    ]
    import math

    for i, b in enumerate(items):
        ang = -math.pi / 2 + i * (math.pi / 2)
        x = cx + math.cos(ang) * r
        y = cy + math.sin(ang) * r
        hot = i == (hot_idx % 4)
        fill = ACCENT if hot else "#fff"
        color = "#fff" if hot else INK
        parts.append(
            f'<rect x="{x - 58:.1f}" y="{y - 28:.1f}" width="116" height="56" fill="{fill}" stroke="{INK}" stroke-width="1.6"/>'
            f'<text x="{x:.1f}" y="{y + 5:.1f}" text-anchor="middle" font-family="sans-serif" font-size="13" font-weight="700" fill="{color}">{_t(b, 8)}</text>'
        )
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 560 460" role="img">{_header("cycle", title)}{"".join(parts)}</svg>'


def svg_hub(title: str, items: list[str], hot_idx: int) -> str:
    hub = items[0] if items else title
    sats = items[1:5] or ["A", "B", "C"]
    parts = [
        _arrow_defs(),
        f'<rect x="190" y="190" width="180" height="90" fill="{ACCENT}" stroke="{INK}" stroke-width="2"/>',
        f'<text x="280" y="242" text-anchor="middle" font-family="serif" font-size="18" font-weight="700" fill="#fff">{_t(hub, 8)}</text>',
    ]
    coords = [(40, 100), (340, 100), (40, 320), (340, 320)]
    for i, b in enumerate(sats[:4]):
        x, y = coords[i]
        hot = (i + 1) == hot_idx
        fill = ACCENT if hot else "#fff"
        color = "#fff" if hot else INK
        parts.append(
            f'<rect x="{x}" y="{y}" width="180" height="70" fill="{fill}" stroke="{INK}" stroke-width="1.6"/>'
            f'<text x="{x + 90}" y="{y + 42}" text-anchor="middle" font-family="sans-serif" font-size="14" font-weight="700" fill="{color}">{_t(b, 10)}</text>'
            f'<line x1="{x + 90}" y1="{y + (70 if y < 200 else 0)}" x2="280" y2="{235 if y < 200 else 235}" '
            f'stroke="{INK}" stroke-width="1.5" marker-end="url(#arr)"/>'
        )
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 560 460" role="img">{_header("hub", title)}{"".join(parts)}</svg>'


def svg_gate(title: str, items: list[str], hot_idx: int) -> str:
    checks = items[:-1] if len(items) > 1 else items[:3]
    gate = items[-1] if len(items) > 1 else "确认通过"
    parts = []
    for i, b in enumerate(checks[:4]):
        y = 92 + i * 52
        hot = i == hot_idx
        parts.append(
            f'<rect x="40" y="{y}" width="360" height="42" fill="{"#fff" if not hot else "#e8e6ff"}" stroke="{INK}" stroke-width="1.5"/>'
            f'<rect x="52" y="{y + 10}" width="22" height="22" fill="{ACCENT if hot else "#fff"}" stroke="{INK}" stroke-width="1.5"/>'
            f'<text x="90" y="{y + 27}" font-family="sans-serif" font-size="15" font-weight="700" fill="{INK}">{_t(b, 18)}</text>'
        )
    parts.append(
        f'<path d="M430 120 L520 230 L430 340 Z" fill="{ACCENT}" stroke="{INK}" stroke-width="2"/>'
        f'<text x="468" y="228" text-anchor="middle" font-family="Menlo,monospace" font-size="12" font-weight="700" fill="#fff">GATE</text>'
        f'<text x="468" y="248" text-anchor="middle" font-family="sans-serif" font-size="12" font-weight="700" fill="#fff">{_t(gate, 6)}</text>'
        f'<rect x="40" y="372" width="480" height="48" fill="{INK}"/>'
        f'<text x="280" y="402" text-anchor="middle" font-family="sans-serif" font-size="15" font-weight="700" fill="#fff">'
        f'等人确认 · {_t(gate, 16)}</text>'
    )
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 560 460" role="img">{_header("gate", title)}{"".join(parts)}</svg>'


def svg_metaphor(title: str, items: list[str], hot_idx: int) -> str:
    """Restaurant / mapping style: labeled boxes with relation arrows."""
    items = items[:4] or ["A", "B", "C", "D"]
    parts = [_arrow_defs()]
    boxes = [
        (40, 110, ACCENT if hot_idx == 0 else "#fff"),
        (300, 110, ACCENT if hot_idx == 1 else "#fff"),
        (40, 270, ACCENT if hot_idx == 2 else "#fff"),
        (300, 270, ACCENT if hot_idx == 3 else "#fff"),
    ]
    labels = ["角色 / ROLE", "接口 / API", "处理 / LOGIC", "存储 / DATA"]
    for i, ((x, y, fill), b) in enumerate(zip(boxes, items)):
        color = "#fff" if fill == ACCENT else INK
        parts.append(
            f'<rect x="{x}" y="{y}" width="220" height="110" fill="{fill}" stroke="{INK}" stroke-width="1.8"/>'
            f'<text x="{x + 16}" y="{y + 28}" font-family="Menlo,monospace" font-size="11" fill="{ACCENT if fill != ACCENT else "rgba(255,255,255,.75)"}">{labels[i]}</text>'
            f'<text x="{x + 16}" y="{y + 68}" font-family="serif" font-size="18" font-weight="700" fill="{color}">{_t(b, 12)}</text>'
        )
    parts += [
        f'<line x1="260" y1="165" x2="300" y2="165" stroke="{INK}" stroke-width="2" marker-end="url(#arr)"/>',
        f'<line x1="150" y1="220" x2="150" y2="270" stroke="{INK}" stroke-width="2" marker-end="url(#arr)"/>',
        f'<line x1="410" y1="220" x2="410" y2="270" stroke="{INK}" stroke-width="2" marker-end="url(#arr)"/>',
        f'<rect x="40" y="400" width="480" height="36" fill="{INK}"/>',
        f'<text x="280" y="423" text-anchor="middle" font-family="sans-serif" font-size="13" font-weight="700" fill="#fff">{_t(title, 28)}</text>',
    ]
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 560 460" role="img">{_header("map", title)}{"".join(parts)}</svg>'


def svg_callout(title: str, items: list[str], hot_idx: int) -> str:
    big = items[0] if items else title
    rest = items[1:4] or items
    parts = [
        f'<rect x="40" y="96" width="480" height="120" fill="{ACCENT}" stroke="{INK}" stroke-width="2"/>',
        f'<text x="280" y="168" text-anchor="middle" font-family="serif" font-size="28" font-weight="700" fill="#fff">{_t(big, 14)}</text>',
    ]
    for i, b in enumerate(rest[:3]):
        x = 40 + i * 160
        hot = i == (hot_idx % 3)
        fill = "#fff" if not hot else "#e8e6ff"
        parts.append(
            f'<rect x="{x}" y="244" width="148" height="140" fill="{fill}" stroke="{INK}" stroke-width="1.6"/>'
            f'<text x="{x + 16}" y="{244 + 36}" font-family="Menlo,monospace" font-size="12" fill="{ACCENT}">{i + 1:02d}</text>'
            f'<text x="{x + 16}" y="{244 + 80}" font-family="sans-serif" font-size="15" font-weight="700" fill="{INK}">{_t(b, 8)}</text>'
        )
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 560 460" role="img">{_header("callout", title)}{"".join(parts)}</svg>'


LAYOUTS = {
    "stack": svg_stack,
    "flow": svg_flow,
    "vflow": svg_vflow,
    "compare": svg_compare,
    "triad": svg_triad,
    "layers": svg_layers,
    "grid": svg_grid,
    "cycle": svg_cycle,
    "hub": svg_hub,
    "gate": svg_gate,
    "metaphor": svg_metaphor,
    "callout": svg_callout,
}

# slug substring → curated library SVG (slug-only; never match loose bullet words)
LIB_TOPIC = [
    (("api-six", "api-doc", "contract"), "api-contract.svg"),
    (("http-status", "status-map"), "http-status-map.svg"),
    (("schema", "sql-four", "db-schema"), "sql-four-moves.svg"),
    (("rollback", "deployment", "deploy"), "deploy-pipeline.svg"),
    (("simple-stack",), "four-layer.svg"),
    (("states",), "three-states.svg"),
    (("exception",), "exception-taxonomy.svg"),
    (("environment",), "env-config-split.svg"),
    (("why-replay",), "day5-dev-process.svg"),
]


def pick_layout(slug: str, bullets: list[str], slide_i: int) -> str:
    s = (slug or "").lower()
    if s in {"open", "close"}:
        return "callout" if s == "open" else "stack"
    if s in {"gate"} or s.endswith("-gate"):
        return "gate"
    if any(k in s for k in ("traditional", "ai-era", "boundary", "vs")):
        return "compare"
    if any(k in s for k in ("restaurant", "menu", "map", "no-direct", "ownership", "handoff")):
        return "metaphor"
    if any(k in s for k in ("three", "triad", "three-things", "severity")):
        return "triad"
    if any(k in s for k in ("layer", "stack", "simple-stack", "files", "six-files", "coverage")):
        return "layers"
    if any(k in s for k in ("flow", "pipeline", "main-flow", "release", "smoke", "query", "submit")):
        return "flow"
    if any(k in s for k in ("cycle", "retest", "regression", "loop", "retro")):
        return "cycle"
    if any(k in s for k in ("hub", "inputs", "six-inputs", "impact", "folder")):
        return "hub"
    if any(k in s for k in ("grid", "priority", "severity", "artifacts", "evidence")):
        return "grid"
    if any(k in s for k in ("p1", "p2", "p3", "p4", "plan", "implement", "execute")):
        return "vflow"
    rotate = ["grid", "flow", "hub", "layers", "triad", "callout", "metaphor", "vflow"]
    return rotate[slide_i % len(rotate)]


def try_copy_library(slug: str, bullets: list[str], dest: Path) -> bool:
    s = (slug or "").lower()
    for keys, name in LIB_TOPIC:
        if any(k.lower() in s for k in keys):
            src = DIAG_LIB / name
            if src.exists():
                dest.write_text(src.read_text(encoding="utf-8"), encoding="utf-8")
                return True
    return False


def make_svg(
    path: Path,
    title: str,
    bullets: list[str],
    hot_idx: int = -1,
    slug: str = "",
    slide_i: int = 0,
    prefer_library: bool = True,
) -> str:
    path.parent.mkdir(parents=True, exist_ok=True)
    items = [b for b in bullets if b.strip()] or [title or "要点"]
    if hot_idx < 0:
        hot_idx = min(1, len(items) - 1)

    # curated diagrams for high-signal topics (skip generic open/close)
    if prefer_library and slug not in {"open", "close"} and try_copy_library(slug, items, path):
        return "library"

    layout = pick_layout(slug, items, slide_i)
    # content shape overrides
    if layout == "triad" and len(items) >= 5:
        layout = "grid"
    if layout == "flow" and len(items) <= 2:
        layout = "callout"
    fn = LAYOUTS.get(layout, svg_stack)
    # for compare/callout use all bullets; for others skip duplicate title if present
    body_items = items
    if layout not in {"compare", "callout", "metaphor", "hub"} and len(items) > 1:
        body_items = items[1:] if items[0] == title else items
        if not body_items:
            body_items = items
    path.write_text(fn(title or items[0], body_items, hot_idx), encoding="utf-8")
    return layout


def ico(i: int, hot: bool = False) -> str:
    stroke = "#fff" if hot else "#1400ff"
    return (
        f'<div class="ico" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" '
        f'stroke="{stroke}" stroke-width="1.8">{ICONS[i % len(ICONS)]}</svg></div>'
    )


def slide_html(meta: dict, ppt: dict, sec_no: int, svg_rel: str, layout: str = "stack") -> str:
    sid = meta["id"]
    bullets = ppt["bullets"]
    title = bullets[0]
    lede = bullets[1] if len(bullets) > 1 else ""
    rest = bullets[2:] if len(bullets) > 2 else bullets[:1]
    cards = []
    for i, b in enumerate(rest[:4] or [title]):
        hot = i == len(rest[:4]) - 1
        cls = "card hot" if hot else "card"
        # split "label · body" or "A：B"
        if "：" in b:
            h4, p = b.split("：", 1)
        elif "·" in b and len(b) > 12:
            parts = [x.strip() for x in b.split("·")]
            h4, p = parts[0], " · ".join(parts[1:])
        else:
            h4, p = b, ""
        cards.append(
            f'<div class="{cls}"><div class="card-head">{ico(i, hot)}'
            f'<div class="lab">{esc(f"{i+1:02d}")}</div></div>'
            f"<h4>{esc(h4[:22])}</h4>"
            f'<p>{esc(p[:60] if p else h4)}</p></div>'
        )
    tags = "".join(
        f'<span class="tag {"solid" if i == 0 else "hot" if i == 1 else ""}">{esc(t[:18])}</span>'
        for i, t in enumerate(bullets[:3])
    )
    label = f'{ppt["num"]} {ppt["slug"].upper()}'
    return f'''
<section id="slide-{sid}" class="clip slide" data-track-index="1" data-start="{meta["start"]:.3f}" data-duration="{meta["dur"]:.3f}">
  <div class="stage-fill"></div>
  <div class="slide-body">
    <div class="sec-label" data-anim="k"><span class="num">{esc(ppt["num"])}</span>{esc(label)}</div>
    <h1 class="display" data-anim="t">{esc(title[:20])}</h1>
    <p class="lede" data-anim="s">{esc(lede[:80] if lede else title)}</p>
    <div class="open-split" data-anim="diagram">
      <div class="stack">
        {"".join(cards)}
        <div class="tag-row">{tags}</div>
      </div>
      <div class="diagram-box">
        <div class="dg-cap">Visual · {esc((layout or ppt["slug"])[:24])}</div>
        <img src="{esc(svg_rel)}" alt="" />
      </div>
    </div>
  </div>
</section>
'''


def build_js(slides: list[dict], total: float) -> str:
    arr = ",\n  ".join(
        f'{{ id: "#slide-{s["id"]}", start: {s["start"]:.3f}, dur: {s["dur"]:.3f} }}' for s in slides
    )
    enters = "\n".join(f'  enter("#slide-{s["id"]}", {s["start"]:.3f});' for s in slides)
    exits = []
    for i, s in enumerate(slides):
        soft = max(0.0, s["start"] + s["dur"] - 0.45)
        hard = s["start"] + s["dur"]
        if i + 1 < len(slides):
            # keep gap to next start if timing has pause
            hard = min(hard, slides[i + 1]["start"])
            soft = max(0.0, hard - 0.45)
        else:
            hard = total
            soft = max(0.0, hard - 0.45)
        exits.append(f'  exit("#slide-{s["id"]}", {soft:.3f}, {hard:.3f});')
    return f'''
<script>
window.__timelines = window.__timelines || {{}};
const tl = gsap.timeline({{ paused: true }});
const slides = [
  {arr}
];
function enter(id, t0) {{
  tl.from(`${{id}} .slide-body`, {{ opacity: 0, y: 28, duration: 0.55, ease: "power3.out" }}, t0);
  tl.from(`${{id}} [data-anim='k']`, {{ y: 18, opacity: 0, duration: 0.4, ease: "power2.out" }}, t0 + 0.12);
  tl.from(`${{id}} [data-anim='t']`, {{ y: 36, opacity: 0, duration: 0.55, ease: "power3.out" }}, t0 + 0.22);
  tl.from(`${{id}} [data-anim='s']`, {{ y: 20, opacity: 0, duration: 0.45, ease: "power2.out" }}, t0 + 0.32);
  tl.from(`${{id}} [data-anim='diagram']`, {{ y: 16, opacity: 0, duration: 0.45, ease: "power2.out", stagger: 0.06 }}, t0 + 0.42);
}}
function exit(id, tEnd, tHard) {{
  tl.to(`${{id}} .slide-body`, {{ opacity: 0, y: -18, duration: 0.4, ease: "power2.in" }}, tEnd);
  tl.set(`${{id}} .slide-body`, {{ opacity: 0 }}, tHard);
}}
{enters}
{chr(10).join(exits)}
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
  function fit() {{
    const s = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
    document.body.style.transform = "scale(" + s + ")";
    document.body.style.transformOrigin = "top left";
  }}
  function reveal(el) {{
    gsap.set(el.querySelectorAll(".slide-body, [data-anim]"), {{ opacity: 1, y: 0, clearProps: "transform" }});
  }}
  function show(i) {{
    slidesEls.forEach((el, j) => {{ el.style.visibility = j === i ? "visible" : "hidden"; }});
    reveal(slidesEls[i]);
  }}
  gsap.set("#avatar-pip", {{ opacity: 1, y: 0 }});
  fit(); show(0);
  window.addEventListener("resize", fit);
  window.addEventListener("keydown", (e) => {{
    if (e.key === "ArrowRight" || e.key === " ") {{ idx = Math.min(idx + 1, slidesEls.length - 1); show(idx); e.preventDefault(); }}
    if (e.key === "ArrowLeft") {{ idx = Math.max(idx - 1, 0); show(idx); }}
  }});
}})();
</script>
'''


def enrich(day: int, section: str) -> Path:
    from bootcamp_sections import section_dirs

    sec = section.zfill(2)
    dirname = section_dirs(day)[sec]
    section_dir = BC / f"day-{day:02d}" / dirname
    video = section_dir / "video"
    index = video / "index.html"
    ppt_md = (section_dir / "PPT_AND_NARRATION.md").read_text(encoding="utf-8")
    old = index.read_text(encoding="utf-8")
    metas = extract_slide_meta(old)
    total = extract_total(old) or (metas[-1]["start"] + metas[-1]["dur"] if metas else 0)
    ppts = parse_ppt(ppt_md)
    if len(ppts) != len(metas):
        # align by order; pad/truncate
        while len(ppts) < len(metas):
            ppts.append({"num": f"{len(ppts)+1:02d}", "slug": metas[len(ppts)]["id"], "bullets": [metas[len(ppts)]["id"]]})
        ppts = ppts[: len(metas)]

    diagrams = video / "assets" / "diagrams"
    slides_html = []
    for i, (meta, ppt) in enumerate(zip(metas, ppts)):
        svg_name = f"{meta['id']}.svg"
        slug = ppt.get("slug") or meta["id"]
        layout = make_svg(
            diagrams / svg_name,
            ppt["bullets"][0],
            ppt["bullets"],
            hot_idx=min(1, len(ppt["bullets"]) - 1),
            slug=slug,
            slide_i=i,
        )
        slides_html.append(slide_html(meta, ppt, int(sec), f"assets/diagrams/{svg_name}", layout=layout))

    title_m = re.search(r"<title>([^<]*)</title>", old)
    title = title_m.group(1) if title_m else dirname
    day_cn = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十", "十一"]
    day_label = day_cn[day] if 0 <= day < len(day_cn) else str(day)
    brand = f"FDE<em>·</em>训练营 <em>/</em> 第{day_label}天 · 第 {int(sec)} 节"
    out = f'''<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>{esc(title)}</title>
<script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
<style>
{CSS}
</style>
</head>
<body>
<div id="root" data-composition-id="main" data-start="0" data-duration="{total:.3f}" data-width="1920" data-height="1080">
<div id="preview-hint">浏览器预览 · ← → 或空格翻页</div>
<div class="stage-bg"></div>
{"".join(slides_html)}
<div id="brand-bar" class="brand-bar clip" data-start="0" data-duration="{total:.3f}" data-track-index="2">{brand}</div>
<div id="avatar-pip" class="clip" data-start="0" data-duration="{total:.3f}" data-track-index="5">
  <div class="speak-ring"></div>
  <div class="avatar-frame"><video id="avatar-lipsync" class="clip" src="assets/avatar-lipsync.mp4" muted playsinline preload="auto" data-start="0" data-duration="{total:.3f}" data-track-index="6"></video></div>
  <div class="avatar-caption">Lecturer · 口播</div>
</div>
<audio id="narration" class="clip" src="audio/narration-full.wav" data-start="0" data-duration="{total:.3f}" data-track-index="10" data-volume="1"></audio>
</div>
{build_js(metas, total)}
</body>
</html>
'''
    index.write_text(out, encoding="utf-8")
    print(f"enriched {index} slides={len(metas)} diagrams={diagrams}")
    return index


def main() -> None:
    import sys

    sys.path.insert(0, str(ROOT / "scripts"))
    ap = argparse.ArgumentParser()
    ap.add_argument("--day", type=int, default=1)
    ap.add_argument("--section", required=True, help="01..06 or comma list / all")
    args = ap.parse_args()
    secs = (
        ["01", "02", "03", "04", "05", "06"]
        if args.section.strip().lower() == "all"
        else [s.strip().zfill(2) for s in args.section.split(",") if s.strip()]
    )
    # skip already hand-crafted s01 unless explicitly asked alone
    for s in secs:
        enrich(args.day, s)


if __name__ == "__main__":
    main()
