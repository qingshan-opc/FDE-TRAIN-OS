"""Inject the v2 visual system + breathing animation into all bootcamp video pages.

Idempotent: skips files already containing the v2 marker or a hand-built
breath system (e.g. day-07/section-01 redesigned by hand).

Usage:
    .venv/bin/python scripts/upgrade_video_style.py [--dry-run]
"""
from __future__ import annotations

import argparse
from pathlib import Path

BC = Path(__file__).resolve().parents[1] / "class" / "bootcamp"
MARKER = "v2 visual system"
SKIP_MARKER = "breathSlide"  # hand-redesigned pages already breathe

V2_STYLE = """
<style id="v2-visual">
/* ===== v2 visual system (auto-injected by scripts/upgrade_video_style.py) ===== */
:root{--accent-2:#14b8a6;--radius-lg:26px;--radius-md:20px;--shadow-1:0 2px 6px rgba(35,31,32,.05),0 16px 38px rgba(35,31,32,.10);--shadow-2:0 3px 8px rgba(35,31,32,.06),0 24px 54px rgba(35,31,32,.13);--shadow-teal:0 14px 38px rgba(13,148,136,.32)}
html.browser-preview body{border-radius:20px}
html.browser-preview #root{border-radius:20px}
.stage-bg{background:radial-gradient(1200px 700px at 18% 12%,rgba(13,148,136,.10),transparent 55%),radial-gradient(900px 600px at 88% 78%,rgba(35,31,32,.06),transparent 50%),var(--bg)}
.stage-bg::before{content:"";position:absolute;inset:0;background-image:radial-gradient(rgba(35,31,32,.05) 1.5px,transparent 1.6px);background-size:40px 40px;pointer-events:none}
.orb{position:absolute;border-radius:50%;pointer-events:none;filter:blur(2px);will-change:transform,opacity}
.orb-a{width:520px;height:520px;left:-80px;top:-60px;background:radial-gradient(circle,rgba(13,148,136,.18),transparent 68%)}
.orb-b{width:420px;height:420px;right:-40px;bottom:40px;background:radial-gradient(circle,rgba(20,184,166,.14),transparent 68%)}
.sec-label::after{background:linear-gradient(90deg,var(--ink),rgba(13,148,136,.35),transparent);border-radius:999px}
.sec-label .bar{border-radius:999px;background:linear-gradient(90deg,var(--ink),rgba(13,148,136,.35),transparent)}
.sec-label .num{color:#fff;background:linear-gradient(135deg,var(--accent),#14b8a6);border-radius:10px;padding:5px 11px;box-shadow:0 6px 16px rgba(13,148,136,.35)}
.statement strong{border-bottom:none;background:linear-gradient(transparent 58%,rgba(13,148,136,.26) 58%,rgba(13,148,136,.26) 96%,transparent 96%);border-radius:6px;padding:0 6px;-webkit-box-decoration-break:clone;box-decoration-break:clone}
.card{border:1px solid rgba(35,31,32,.09);border-radius:var(--radius-md);background:rgba(255,255,255,.95);box-shadow:var(--shadow-1)}
.card.hot{background:linear-gradient(135deg,var(--accent),#14b8a6);border-color:transparent;box-shadow:var(--shadow-teal);color:#fff}
.card.hot h4,.card.hot strong,.card.hot p,.card.hot span{color:#fff}
.card.hot .lab,.card.hot .k{color:rgba(255,255,255,.85)}
.tag{border-radius:999px;border:1px solid rgba(35,31,32,.09);background:rgba(255,255,255,.94);box-shadow:var(--shadow-1)}
.tag.hl,.tag.solid{background:linear-gradient(135deg,var(--accent),#14b8a6);color:#fff;border-color:transparent;box-shadow:var(--shadow-teal)}
.diagram-box,.diagram-wide{border:1px solid rgba(35,31,32,.09);border-radius:var(--radius-lg);box-shadow:var(--shadow-2)}
.dg-cap{align-self:flex-start;background:rgba(35,31,32,.05);border-radius:999px;padding:5px 13px}
.flow{border:none;box-shadow:none;gap:14px;background:transparent}
.flow-step{border:1px solid rgba(35,31,32,.09);border-right:1px solid rgba(35,31,32,.09);border-radius:var(--radius-md);box-shadow:var(--shadow-1);background:rgba(255,255,255,.95)}
.flow-step:last-child{border-right:1px solid rgba(35,31,32,.09)}
.flow-step.hot{background:linear-gradient(135deg,var(--accent),#14b8a6);border-color:transparent;box-shadow:var(--shadow-teal)}
.flow-step.hot b,.flow-step.hot strong{color:#fff}
.compare{border:none;box-shadow:none;gap:18px;background:transparent;overflow:visible}
.compare-col{border:1px solid rgba(35,31,32,.09);border-radius:var(--radius-md);box-shadow:var(--shadow-1);background:rgba(255,255,255,.95)}
.compare-col:first-child{border-right:1px solid rgba(35,31,32,.09)}
.compare-col h3{background:rgba(13,148,136,.10);border-radius:9px;padding:5px 12px;display:inline-block}
.checklist{border:1px solid rgba(35,31,32,.09);border-radius:var(--radius-md);box-shadow:var(--shadow-1);background:rgba(255,255,255,.95);overflow:hidden}
.layer{border:1px solid rgba(35,31,32,.09);border-radius:var(--radius-md);box-shadow:var(--shadow-1);background:rgba(255,255,255,.95)}
.layer .lv{background:rgba(13,148,136,.10);border-radius:10px;padding:8px 0;text-align:center}
.layer.hot{background:linear-gradient(135deg,var(--accent),#14b8a6);border-color:transparent;box-shadow:var(--shadow-teal)}
.layer.hot .lv{background:rgba(255,255,255,.2);color:#fff}
.rung{border:1px solid rgba(35,31,32,.09);border-radius:16px;box-shadow:var(--shadow-1)}
.step{border-radius:16px}
.avatar-frame{border:none;border-radius:24px;box-shadow:0 18px 44px rgba(13,148,136,.35),0 4px 10px rgba(35,31,32,.18),0 0 0 1px rgba(35,31,32,.10)}
.avatar-caption{border:none;border-radius:999px;margin-top:12px;align-self:center;padding:8px 18px;height:auto;line-height:1.2;box-shadow:0 8px 20px rgba(35,31,32,.25)}
.speak-ring{border-radius:32px}
.side-photo{border-left:none;border-radius:36px 0 0 36px;box-shadow:-20px 0 48px rgba(35,31,32,.18)}
.side-photo .veil{background:linear-gradient(90deg,rgba(242,245,240,.62),transparent 48%),linear-gradient(180deg,rgba(13,148,136,.12),transparent 34%,transparent 62%,rgba(35,31,32,.24))}
.photo-panel{border-radius:var(--radius-lg);box-shadow:var(--shadow-2)}
.here-pulse{border:none;border-radius:999px;background:linear-gradient(135deg,var(--accent),#14b8a6);box-shadow:var(--shadow-teal)}
</style>
"""

V2_SCRIPT = """
<script>
/* ===== v2 breath (auto-injected by scripts/upgrade_video_style.py) ===== */
(function () {
  var tl = window.__timelines && window.__timelines["main"];
  if (!tl || !window.gsap) return;
  function breath(sel, fv, tv, t0, tEnd, cycle, dx) {
    var nodes = gsap.utils.toArray(sel);
    if (!nodes.length) return;
    var start = t0 + 0.75 + (dx || 0);
    var avail = Math.max(cycle, tEnd - start - 0.55);
    var n = Math.max(1, Math.floor(avail / cycle));
    var vars = Object.assign({}, tv, {
      duration: cycle / 2, ease: "sine.inOut", repeat: n * 2 - 1, yoyo: true,
      immediateRender: false, stagger: nodes.length > 1 ? 0.1 : 0,
    });
    tl.fromTo(sel, Object.assign({}, fv), vars, start);
  }
  document.querySelectorAll("section.clip.slide").forEach(function (sec) {
    var t0 = parseFloat(sec.getAttribute("data-start") || "0");
    var tEnd = t0 + parseFloat(sec.getAttribute("data-duration") || "0");
    if (!(tEnd > t0)) return;
    var id = "#" + sec.id;
    breath(id + " .card", { y: 0 }, { y: -9 }, t0, tEnd, 4.6, 0);
    breath(id + " .card.hot", { scale: 1 }, { scale: 1.035 }, t0, tEnd, 2.6, 0.15);
    breath(id + " .compare-col", { y: 0 }, { y: -6 }, t0, tEnd, 4.8, 0.05);
    breath(id + " .flow-step", { y: 0 }, { y: -7 }, t0, tEnd, 4.2, 0);
    breath(id + " .flow-step.hot", { scale: 1 }, { scale: 1.03 }, t0, tEnd, 2.6, 0.1);
    breath(id + " .layer", { x: 0 }, { x: 7 }, t0, tEnd, 4.4, 0);
    breath(id + " .layer.hot", { scale: 1 }, { scale: 1.03 }, t0, tEnd, 2.6, 0.1);
    breath(id + " .rung", { y: 0 }, { y: -6 }, t0, tEnd, 4.6, 0);
    breath(id + " .checklist li", { x: 0 }, { x: 7 }, t0, tEnd, 5.0, 0);
    breath(id + " .tag", { y: 0, opacity: 0.9 }, { y: -4, opacity: 1 }, t0, tEnd, 3.6, 0);
    breath(id + " .tag.hl, " + id + " .tag.solid", { scale: 1 }, { scale: 1.05 }, t0, tEnd, 2.5, 0.12);
    breath(id + " .sec-label .bar", { scaleX: 0.82, opacity: 0.5 }, { scaleX: 1, opacity: 1 }, t0, tEnd, 3.8, 0);
    breath(id + " .side-photo img", { scale: 1, x: 0, y: 0 }, { scale: 1.12, x: -22, y: -14 }, t0, tEnd, 12, 0);
    breath(id + " .photo-panel img", { scale: 1 }, { scale: 1.08 }, t0, tEnd, 12, 0);
    breath(id + " .diagram-box img, " + id + " .diagram-wide img", { scale: 1 }, { scale: 1.035 }, t0, tEnd, 8.5, 0.3);
    breath(id + " .statement strong", { opacity: 0.8 }, { opacity: 1 }, t0, tEnd, 2.8, 0.2);
    breath(id + " .here-pulse", { scale: 1, opacity: 0.8 }, { scale: 1.1, opacity: 1 }, t0, tEnd, 2.2, 0);
  });
  var bg = document.querySelector(".stage-bg");
  if (bg && !bg.querySelector(".orb")) {
    var a = document.createElement("div"); a.className = "orb orb-a"; a.id = "orb-a";
    var b = document.createElement("div"); b.className = "orb orb-b"; b.id = "orb-b";
    bg.appendChild(a); bg.appendChild(b);
    var total = tl.duration() || 600;
    var oc = 11, on = Math.max(1, Math.floor(total / oc));
    tl.fromTo("#orb-a", { x: 0, y: 0, scale: 1, opacity: 0.8 },
      { x: 60, y: -36, scale: 1.16, opacity: 1, duration: oc / 2, ease: "sine.inOut", repeat: on * 2 - 1, yoyo: true, immediateRender: false }, 0);
    tl.fromTo("#orb-b", { x: 0, y: 0, scale: 1, opacity: 0.7 },
      { x: -48, y: 30, scale: 1.2, opacity: 1, duration: oc / 2, ease: "sine.inOut", repeat: on * 2 - 1, yoyo: true, immediateRender: false }, 0.8);
  }
})();
</script>
"""


def upgrade(path: Path, dry: bool) -> str:
    text = path.read_text(encoding="utf-8")
    if MARKER in text:
        return "skip(already-v2)"
    if SKIP_MARKER in text:
        return "skip(hand-redesigned)"
    if "</head>" not in text or "</body>" not in text:
        return "skip(no-head/body)"
    if not dry:
        text = text.replace("</head>", V2_STYLE + "</head>", 1)
        text = text.replace("</body>", V2_SCRIPT + "</body>", 1)
        path.write_text(text, encoding="utf-8")
    return "upgraded"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    counts: dict[str, int] = {}
    for html in sorted(BC.glob("day-*/section-*/video/index.html")):
        rel = html.relative_to(BC)
        result = upgrade(html, args.dry_run)
        counts[result] = counts.get(result, 0) + 1
        if result == "upgraded":
            print(f"{result:22s} {rel}")
    print("\n== summary ==")
    for k, v in sorted(counts.items()):
        print(f"{k:22s} {v}")


if __name__ == "__main__":
    main()
