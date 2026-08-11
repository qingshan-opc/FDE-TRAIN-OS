"""Inject a generic browser-preview boot into video pages that lack one.

Targets pages already upgraded by upgrade_video_style.py but missing a
`browser-preview` boot (currently the day-06 render-only pages).
Idempotent via the "v2 preview boot" marker.
"""
from __future__ import annotations

from pathlib import Path

BC = Path(__file__).resolve().parents[1] / "class" / "bootcamp"
MARKER = "v2 preview boot"
HAS_PREVIEW = 'classList.add("browser-preview")'

PREVIEW_CSS = """
<style id="v2-preview">
/* ===== v2 preview boot (auto-injected) ===== */
html.browser-preview{overflow:auto;height:100%;background:#1a1a1a}
html.browser-preview body{margin:24px auto;box-shadow:0 20px 80px rgba(0,0,0,.55)}
#preview-hint{position:fixed;left:12px;top:12px;z-index:9999;font:13px/1.4 var(--mono);color:#fff;background:rgba(0,0,0,.75);padding:10px 14px;border-radius:10px;display:none}
#preview-pager{position:fixed;right:12px;top:12px;z-index:9999;font:15px/1.4 var(--mono);color:#fff;background:rgba(13,148,136,.92);padding:10px 16px;border-radius:10px;display:none}
html.browser-preview #preview-hint,html.browser-preview #preview-pager{display:block}
</style>
"""

PREVIEW_JS = """
<script>
/* ===== v2 preview boot (auto-injected by scripts/add_preview_boot.py) ===== */
(function () {
  var tl = window.__timelines && window.__timelines["main"];
  if (!tl) return;
  var params = new URLSearchParams(location.search);
  var renderMode = params.get("render") === "1";
  var isDirect = !renderMode && (location.protocol === "file:" || params.has("preview")
    || ["127.0.0.1", "localhost", ""].indexOf(location.hostname) >= 0);
  var slidesEls = Array.prototype.slice.call(document.querySelectorAll("section.clip.slide"));
  if (!slidesEls.length) return;
  var SLIDES = slidesEls.map(function (el) {
    var t0 = parseFloat(el.getAttribute("data-start") || "0");
    return ["#" + el.id, t0, t0 + parseFloat(el.getAttribute("data-duration") || "0")];
  });
  window.__slideTimes = window.__slideTimes || SLIDES;
  if (!isDirect) { tl.seek(1.2); return; }
  document.documentElement.classList.add("browser-preview");
  var idx = 0;
  var pager = document.createElement("div");
  pager.id = "preview-pager";
  document.body.appendChild(pager);
  var hint = document.createElement("div");
  hint.id = "preview-hint";
  hint.textContent = "预览 · ← → 翻页 · ↑↓ 页内扫呼吸";
  document.body.appendChild(hint);
  function show(i) {
    var s = SLIDES[i], t0 = s[1], tEnd = s[2];
    tl.seek(Math.min(t0 + 2.2, (t0 + tEnd) / 2), false);
    slidesEls.forEach(function (el, j) { el.style.visibility = j === i ? "visible" : "hidden"; });
    pager.textContent = (i + 1) + " / " + slidesEls.length;
  }
  show(0);
  var video = document.querySelector("#avatar-pip video");
  if (video) { video.muted = true; video.playsInline = true; video.play().catch(function () {}); }
  window.addEventListener("keydown", function (e) {
    var s = SLIDES[idx];
    if (e.key === "ArrowRight" || e.key === " ") { idx = Math.min(idx + 1, slidesEls.length - 1); show(idx); e.preventDefault(); }
    if (e.key === "ArrowLeft") { idx = Math.max(idx - 1, 0); show(idx); e.preventDefault(); }
    if (e.key === "ArrowDown") {
      var cur = Math.min(Math.max(tl.time(), s[1]), s[2]);
      tl.seek(Math.min(cur + 2.5, s[2] - 0.6), false); e.preventDefault();
    }
    if (e.key === "ArrowUp") {
      var cur2 = Math.min(Math.max(tl.time(), s[1]), s[2]);
      tl.seek(Math.max(cur2 - 2.5, s[1] + 0.8), false); e.preventDefault();
    }
  });
})();
</script>
"""


def main() -> None:
    for html in sorted(BC.glob("day-*/section-*/video/index.html")):
        text = html.read_text(encoding="utf-8")
        if MARKER in text or HAS_PREVIEW in text:
            continue
        text = text.replace("</head>", PREVIEW_CSS + "</head>", 1)
        text = text.replace("</body>", PREVIEW_JS + "</body>", 1)
        html.write_text(text, encoding="utf-8")
        print("preview-boot:", html.relative_to(BC))


if __name__ == "__main__":
    main()
