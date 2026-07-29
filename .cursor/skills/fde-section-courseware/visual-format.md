# 视觉 / HTML 格式（对齐 S01）

权威源码：`class/bootcamp/day-05/section-01-worldview-plain/video/index.html`  
结构参考：`section-03-how-software-built/video/index.html`

## 设计令牌

```css
:root {
  --bg: #f2f5f0;
  --ink: #231f20;
  --ink-60: rgba(35, 31, 32, 0.72);
  --ink-40: rgba(35, 31, 32, 0.55);
  --ink-08: rgba(35, 31, 32, 0.08);
  --ink-05: rgba(35, 31, 32, 0.05);
  --accent: #1400ff;
  --serif: "Noto Serif SC", serif;
  --sans: "Noto Sans SC", sans-serif;
  --mono: "JetBrains Mono", monospace;
}
```

- 浅底 + 电蓝强调 + 厚分割线（`sec-label::after` 6px）
- 标题宋体 `.display`；标签等宽 `.sec-label` / `.lab` / `.tag`
- 反色页：`.slide.invert`（深底浅字）

## 布局

| 元素 | 规格 |
|------|------|
| 画布 | 1920×1080 |
| slide padding | `72px 420px 72px 96px`（右侧给 PiP） |
| `#avatar-pip` | 右下 `right:40px; bottom:36px; width:248px; height:380px` |
| 头像框 | 2px ink 边 + `box-shadow: 8px 8px 0 var(--accent)` |
| `#brand-bar` | 左下等宽小字：`FDE·训练营 / Day NN · SS` |

## 常用组件类（沿用，勿改名）

- `.sec-label` + `.num`
- `.display` / `.display .thin` / `.statement` / `.lede`
- `.card` / `.duo` / `.trio` / `.tag-row` / `.tag.hot|.solid`
- `.ladder` / `.rung.on|.hot`（流程站）
- `.flow` / `.step` / `.vs-grid` / `.vs-card.hot`
- `.diagram-box` + `assets/diagrams/*.svg`
- `data-anim="k|t|s|lede|…"` 供 GSAP 分段入场

## Clip 契约

```html
<div id="root" data-composition-id="main" data-start="0" data-duration="TOTAL"
     data-width="1920" data-height="1080">
  <section id="slide-01-open" class="clip slide"
           data-start="0.000" data-duration="21.932" data-track-index="1">…</section>
  …
  <div id="brand-bar" class="brand-bar clip" data-start="0" data-duration="TOTAL" data-track-index="2">…</div>
  <div id="avatar-pip" class="clip" data-start="0" data-duration="TOTAL" data-track-index="5">
    <video id="avatar-lipsync" class="clip" src="assets/avatar-lipsync.mp4"
           muted playsinline preload="auto"
           data-start="0" data-duration="TOTAL" data-track-index="6"></video>
  </div>
  <audio id="narration" class="clip" src="audio/narration-full.wav"
         data-start="0" data-duration="TOTAL" data-track-index="10" data-volume="1"></audio>
</div>
```

- slide id = `slide-` + narration id（如 `01-open`）
- `data-duration` 必须是纯数字字符串；禁止损坏成 `0.000.932`

## GSAP

```js
window.__timelines = window.__timelines || {};
const tl = gsap.timeline({ paused: true });
function enter(id, t0, extras) {
  tl.from(`${id} .slide-body`, { opacity: 0, y: 28, duration: 0.55, ease: "power3.out" }, t0);
  // … data-anim 子元素
}
function exit(id, tEnd, tHard) {
  tl.to(`${id} .slide-body`, { opacity: 0, y: -18, duration: 0.4, ease: "power2.in" }, tEnd);
  tl.set(`${id} .slide-body`, { opacity: 0 }, tHard);
}
// enter 的 t0 = segment.start；exit soft ≈ start+dur-0.45，hard = start+dur
window.__timelines["main"] = tl;
```

**重要**：GSAP `.from({opacity:0})` 在 enter 之前会把正文压成透明。enter 秒数必须等于 TTS `timing.json` 的 `start`，否则成片空页。用 `patch_section_video_timing.py` 统一打点。

## 目录骨架

```
section-NN-slug/
  lesson.md
  practice.md
  video/
    BRIEF.md
    hyperframes.json
    package.json
    index.html
    scripts/narration/{manifest.json, NN-*.txt}
    audio/{narration-full.wav, timing.json, segments/}
    assets/{fonts/, diagrams/, avatar-lipsync.mp4, lecturer-portrait.jpg?}
    renders/dayXX-s0N-*.mp4
```

字体/肖像：从 S01 `video/assets/` 复制或 symlink，勿重新下载另一套。

## 信息密度（必达）

见 [diagram-density.md](diagram-density.md)。简述：分层图要有层内具体名词；演进网格要有 dim/live 单元格；Agent 页要有 Harness 中心 + 5 节点环；禁止大标题+长 lede 无图。
