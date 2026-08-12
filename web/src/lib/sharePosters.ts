/** 分享海报：1 套学院长图（对齐营销页）+ 3 套差异化风格 */

export type PosterStyleId = "academy" | "ink" | "brutal" | "clean";

export type PosterAudience = "org" | "personal";

export type SharePosterInput = {
  style: PosterStyleId;
  audience: PosterAudience;
  title: string;
  priceLabel: string;
  issuerLabel: string;
  slogan?: string;
  coverSrc?: string | null;
  qrCanvas: HTMLCanvasElement | null;
  scanHint?: string;
};

export const POSTER_STYLES: Array<{
  id: PosterStyleId;
  name: string;
  blurb: string;
  swatch: [string, string, string];
}> = [
  {
    id: "academy",
    name: "学院长图",
    blurb: "深蓝金 · 对齐你提供的营销长图",
    swatch: ["#0a1628", "#d4af37", "#3b82f6"],
  },
  {
    id: "ink",
    name: "青绿编辑",
    blurb: "纸白墨绿 · 杂志感短海报",
    swatch: ["#0f2e2a", "#0d9488", "#f6f1e8"],
  },
  {
    id: "brutal",
    name: "新粗野",
    blurb: "奶油底 · 大黑边 · 硬贴纸感",
    swatch: ["#fff8e7", "#ffde59", "#111111"],
  },
  {
    id: "clean",
    name: "极简白",
    blurb: "白底黑字 · 大价格 · 强转化",
    swatch: ["#ffffff", "#111111", "#ff4d2e"],
  },
];

const FONT =
  '"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans SC",-apple-system,sans-serif';

const ACADEMY_REF = "/landing/fde-academy-ref.png";
const HERO_LINE = "21天，跑通企业AI项目全流程";
const HERO_SUB = "工程能力让系统跑起来，组织推动让项目真正落地";
const CHIPS = ["3周线上训练", "企业项目实战", "3个月入职教练陪跑"] as const;
const PATH_STEPS = [
  {
    no: "01",
    phase: "第一周",
    title: "AI 增强型全栈原型",
    desc: "用 AI 做出可交互原型：数据录入、流程串联、部署上线与验收。",
  },
  {
    no: "02",
    phase: "第二周",
    title: "企业需求诊断与实操",
    desc: "痛点梳理、价值判断、方案选型与小步验证，把需求做成可交付项。",
  },
  {
    no: "03",
    phase: "第三周",
    title: "组织推动与 AI 落地",
    desc: "场景落地、跨部门协同、变更沟通与持续运营，让系统真正被用起来。",
    badge: "实战高潮",
  },
  {
    no: "04",
    phase: "第二阶段",
    title: "3 个月入职教练陪跑",
    desc: "作品集打磨、面试表达、入职后问题拆解与成果汇报。",
  },
] as const;
const LOOP_STEPS = ["本周任务", "案例研发", "教练评测", "毕业结项"] as const;
const OUTCOMES = [
  { title: "1 套企业部门 AI 系统", desc: "可见、可衡量、可管理" },
  { title: "1 套老板 AI 经营驾驶舱", desc: "盯经营结果与效率" },
  { title: "1 个专业 Agent + 3 个岗位 Skill", desc: "提升个人竞争力" },
  { title: "代码仓库 + 文档 + 作品集", desc: "求职可展示的硬资产" },
] as const;

export function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

/** Upload composed PNG so WeChat can long-press save (data: URLs cannot). */
export async function publishPosterDataUrl(dataUrl: string): Promise<string> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  const { shareApi } = await import("./api");
  const published = await shareApi.uploadPoster(blob, "poster.png");
  if (published.absolute_url && /^https?:\/\//i.test(published.absolute_url)) {
    return published.absolute_url;
  }
  if (typeof window !== "undefined" && published.url.startsWith("/")) {
    return `${window.location.origin}${published.url}`;
  }
  return published.url;
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines = 6,
) {
  let line = "";
  let yy = y;
  let lines = 0;
  for (const ch of text) {
    const test = line + ch;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, yy);
      line = ch;
      yy += lineHeight;
      lines += 1;
      if (lines >= maxLines - 1) break;
    } else {
      line = test;
    }
  }
  if (line) {
    if (lines >= maxLines - 1 && text.length > line.length) {
      while (line.length > 1 && ctx.measureText(`${line}…`).width > maxWidth) {
        line = line.slice(0, -1);
      }
      ctx.fillText(`${line}…`, x, yy);
    } else {
      ctx.fillText(line, x, yy);
    }
  }
  return yy;
}

/** Measure wrapped height without drawing. */
function measureWrap(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  lineHeight: number,
  maxLines = 6,
) {
  let line = "";
  let lines = 1;
  for (const ch of text) {
    const test = line + ch;
    if (ctx.measureText(test).width > maxWidth && line) {
      line = ch;
      lines += 1;
      if (lines >= maxLines) break;
    } else {
      line = test;
    }
  }
  return lines * lineHeight;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function channelLabel(audience: PosterAudience) {
  return audience === "org" ? "机构渠道推荐" : "学员邀请通道";
}

/** Style 1: academy long page — sequential layout aligned to marketing ref */
async function composeAcademy(opts: SharePosterInput): Promise<string> {
  const W = 1080;
  const pad = 56;
  const cw = W - pad * 2;
  const NAVY = "#0a1628";
  const GOLD = "#d4af37";
  const GOLD_SOFT = "#f0d78c";
  const CYAN = "#5eead4";
  const TEXT = "#f8fafc";
  const MUTED = "rgba(248,250,252,0.70)";
  const CARD = "rgba(12,28,48,0.94)";

  const H = 3800;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 不可用");
  ctx.textBaseline = "top";

  const paintBg = () => {
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#07111f");
    bg.addColorStop(0.45, NAVY);
    bg.addColorStop(1, "#0b1c31");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
  };
  paintBg();

  /** Soft divider — brand label only once at top */
  const brandRule = (yy: number) => {
    const grad = ctx.createLinearGradient(pad, 0, W - pad, 0);
    grad.addColorStop(0, "rgba(94,234,212,0)");
    grad.addColorStop(0.2, "rgba(94,234,212,0.55)");
    grad.addColorStop(0.5, GOLD);
    grad.addColorStop(0.8, "rgba(94,234,212,0.55)");
    grad.addColorStop(1, "rgba(94,234,212,0)");
    ctx.strokeStyle = grad;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(pad, yy);
    ctx.lineTo(W - pad, yy);
    ctx.stroke();
    ctx.fillStyle = GOLD_SOFT;
    ctx.font = `700 16px ${FONT}`;
    ctx.textAlign = "center";
    ctx.fillText("青山在 OPC  ·  FDE ACADEMY", W / 2, yy + 14);
    ctx.textAlign = "start";
    return yy + 44;
  };

  const softRule = (yy: number) => {
    const grad = ctx.createLinearGradient(pad, 0, W - pad, 0);
    grad.addColorStop(0, "rgba(212,175,55,0)");
    grad.addColorStop(0.5, "rgba(212,175,55,0.45)");
    grad.addColorStop(1, "rgba(212,175,55,0)");
    ctx.strokeStyle = grad;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(pad + 80, yy);
    ctx.lineTo(W - pad - 80, yy);
    ctx.stroke();
    return yy + 28;
  };

  const afterWrap = (top: number, lh: number, gap = 0) => top + lh + gap;

  let y = 0;

  // ——— Hero: photo atmosphere without baked marketing copy ———
  const heroH = 640;
  const heroImg = (await loadImage("/landing/hero.png")) || (await loadImage(ACADEMY_REF));
  if (heroImg) {
    // Prefer right half of hero photo; if falling back to academy-ref, crop bottom-right to avoid title glyphs
    const isRef = heroImg.src.includes("fde-academy-ref");
    const srcX = Math.floor(heroImg.width * (isRef ? 0.35 : 0.28));
    const srcY = isRef ? Math.floor(heroImg.height * 0.02) : 0;
    const srcW = heroImg.width - srcX;
    const srcH = isRef ? Math.floor(heroImg.height * 0.2) : Math.floor(heroImg.height * 0.55);
    ctx.save();
    ctx.beginPath();
    ctx.rect(W * 0.42, 0, W * 0.58, heroH);
    ctx.clip();
    ctx.drawImage(heroImg, srcX, srcY, srcW, srcH, W * 0.32, 0, W * 0.68, heroH);
    ctx.restore();
  }
  // Decorative right glow even without image
  const glow = ctx.createRadialGradient(W * 0.82, heroH * 0.42, 40, W * 0.75, heroH * 0.45, 420);
  glow.addColorStop(0, "rgba(59,130,246,0.22)");
  glow.addColorStop(1, "rgba(7,17,31,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, heroH);

  const leftWash = ctx.createLinearGradient(0, 0, W * 0.72, 0);
  leftWash.addColorStop(0, "rgba(7,17,31,1)");
  leftWash.addColorStop(0.62, "rgba(7,17,31,0.92)");
  leftWash.addColorStop(0.85, "rgba(7,17,31,0.45)");
  leftWash.addColorStop(1, "rgba(7,17,31,0.05)");
  ctx.fillStyle = leftWash;
  ctx.fillRect(0, 0, W, heroH);
  const bottomWash = ctx.createLinearGradient(0, heroH * 0.62, 0, heroH);
  bottomWash.addColorStop(0, "rgba(7,17,31,0)");
  bottomWash.addColorStop(1, NAVY);
  ctx.fillStyle = bottomWash;
  ctx.fillRect(0, 0, W, heroH);

  y = brandRule(28);

  ctx.fillStyle = MUTED;
  ctx.font = `600 18px ${FONT}`;
  ctx.fillText(channelLabel(opts.audience), pad, y);
  ctx.textAlign = "right";
  ctx.fillText((opts.issuerLabel || "").slice(0, 22), W - pad, y);
  ctx.textAlign = "start";
  y += 48;

  // Intentional 2-line headline — never truncate mid-phrase
  const titleLines = ["21天，跑通企业AI项目", "全流程"];
  ctx.fillStyle = TEXT;
  ctx.font = `900 58px ${FONT}`;
  for (const line of titleLines) {
    ctx.fillText(line, pad, y);
    y += 70;
  }
  y += 8;
  ctx.fillStyle = MUTED;
  ctx.font = `600 24px ${FONT}`;
  {
    const lh = 36;
    const top = wrapText(ctx, opts.slogan || HERO_SUB, pad, y, Math.floor(cw * 0.78), lh, 3);
    y = afterWrap(top, lh, 28);
  }

  // Feature chips — full width wrap
  let chipX = pad;
  let chipY = y;
  const chipH = 48;
  for (const chip of CHIPS) {
    ctx.font = `700 20px ${FONT}`;
    const tw = ctx.measureText(chip).width + 40;
    if (chipX + tw > W - pad) {
      chipX = pad;
      chipY += chipH + 12;
    }
    roundRect(ctx, chipX, chipY, tw, chipH, 12);
    ctx.fillStyle = "rgba(8,20,36,0.92)";
    ctx.fill();
    ctx.strokeStyle = "rgba(212,175,55,0.65)";
    ctx.lineWidth = 1.6;
    roundRect(ctx, chipX, chipY, tw, chipH, 12);
    ctx.stroke();
    ctx.fillStyle = GOLD_SOFT;
    ctx.fillText(chip, chipX + 20, chipY + 14);
    chipX += tw + 12;
  }
  y = Math.max(chipY + chipH + 52, heroH + 20);

  // ——— Path ———
  y = softRule(y);
  ctx.fillStyle = TEXT;
  ctx.font = `900 44px ${FONT}`;
  ctx.fillText("从系统构建，到组织落地", pad, y);
  y += 56;
  ctx.fillStyle = MUTED;
  ctx.font = `600 22px ${FONT}`;
  ctx.fillText("FDE 企业 AI 项目实战实施路径", pad, y);
  y += 40;

  const railX = pad + 34;
  const cardLeft = pad + 96;
  const cardW = W - pad - cardLeft;
  const stepHeights: number[] = [];

  // First pass measure
  for (const step of PATH_STEPS) {
    const titleLh = 36;
    const descLh = 30;
    ctx.font = `800 28px ${FONT}`;
    const titleH = measureWrap(ctx, step.title, cardW - 48, titleLh, 2);
    ctx.font = `600 20px ${FONT}`;
    const descH = measureWrap(ctx, step.desc, cardW - 48, descLh, 3);
    const h = 32 + 28 + 16 + titleH + 14 + descH + 32;
    stepHeights.push(Math.max(156, h));
  }

  // Draw rail + cards
  const firstCenter = y + stepHeights[0]! / 2;
  const lastCenter = y + stepHeights.slice(0, -1).reduce((a, b) => a + b + 18, 0) + stepHeights.at(-1)! / 2;
  ctx.strokeStyle = "rgba(212,175,55,0.35)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(railX, firstCenter);
  ctx.lineTo(railX, lastCenter);
  ctx.stroke();

  PATH_STEPS.forEach((step, idx) => {
    const cardH = stepHeights[idx]!;
    const highlight = step.no === "03";

    // Node
    ctx.beginPath();
    ctx.arc(railX, y + cardH / 2, 22, 0, Math.PI * 2);
    ctx.fillStyle = highlight ? GOLD : NAVY;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = GOLD;
    ctx.stroke();
    ctx.fillStyle = highlight ? NAVY : GOLD_SOFT;
    ctx.font = `900 18px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(step.no, railX, y + cardH / 2 + 1);
    ctx.textAlign = "start";
    ctx.textBaseline = "top";

    // Card
    roundRect(ctx, cardLeft, y, cardW, cardH, 18);
    ctx.fillStyle = highlight ? "rgba(212,175,55,0.10)" : CARD;
    ctx.fill();
    ctx.strokeStyle = highlight ? GOLD : "rgba(148,163,184,0.22)";
    ctx.lineWidth = highlight ? 2.2 : 1.4;
    roundRect(ctx, cardLeft, y, cardW, cardH, 18);
    ctx.stroke();

    let iy = y + 32;
    ctx.fillStyle = CYAN;
    ctx.font = `700 20px ${FONT}`;
    ctx.fillText(step.phase, cardLeft + 28, iy);

    if ("badge" in step && step.badge) {
      ctx.font = `800 15px ${FONT}`;
      const bw = ctx.measureText(step.badge).width + 24;
      roundRect(ctx, cardLeft + cardW - bw - 24, y + 26, bw, 28, 8);
      ctx.fillStyle = GOLD;
      ctx.fill();
      ctx.fillStyle = NAVY;
      ctx.fillText(step.badge, cardLeft + cardW - bw - 12, y + 32);
    }

    iy += 34;
    ctx.fillStyle = TEXT;
    ctx.font = `800 28px ${FONT}`;
    const titleLh = 36;
    const titleTop = wrapText(ctx, step.title, cardLeft + 28, iy, cardW - 48, titleLh, 2);
    iy = afterWrap(titleTop, titleLh, 14);
    ctx.fillStyle = MUTED;
    ctx.font = `600 20px ${FONT}`;
    wrapText(ctx, step.desc, cardLeft + 28, iy, cardW - 48, 30, 3);

    y += cardH + 18;
  });

  // Loop pills
  y += 8;
  roundRect(ctx, pad, y, cw, 108, 18);
  ctx.fillStyle = "rgba(37,99,235,0.14)";
  ctx.fill();
  ctx.strokeStyle = "rgba(96,165,250,0.28)";
  ctx.lineWidth = 1.2;
  roundRect(ctx, pad, y, cw, 108, 18);
  ctx.stroke();

  ctx.fillStyle = GOLD_SOFT;
  ctx.font = `800 20px ${FONT}`;
  ctx.fillText("任务驱动训练闭环", pad + 28, y + 18);

  const arrowW = 22;
  const pillGap = 12;
  const pillW = (cw - 56 - arrowW * 3 - pillGap * 6) / 4;
  const pillY = y + 52;
  LOOP_STEPS.forEach((label, i) => {
    const px = pad + 28 + i * (pillW + pillGap * 2 + arrowW);
    roundRect(ctx, px, pillY, pillW, 38, 10);
    ctx.fillStyle = "rgba(8,20,36,0.75)";
    ctx.fill();
    ctx.strokeStyle = "rgba(212,175,55,0.45)";
    ctx.lineWidth = 1.2;
    roundRect(ctx, px, pillY, pillW, 38, 10);
    ctx.stroke();
    ctx.fillStyle = TEXT;
    ctx.font = `700 18px ${FONT}`;
    ctx.textAlign = "center";
    ctx.fillText(label, px + pillW / 2, pillY + 10);
    if (i < LOOP_STEPS.length - 1) {
      ctx.fillStyle = GOLD;
      ctx.font = `700 18px ${FONT}`;
      ctx.fillText("→", px + pillW + pillGap + arrowW / 2, pillY + 10);
    }
    ctx.textAlign = "start";
  });
  y += 108 + 28;

  // Quote
  ctx.fillStyle = MUTED;
  ctx.font = `600 22px ${FONT}`;
  {
    const lh = 36;
    const top = wrapText(
      ctx,
      "能把系统做出来，是工程能力；能让组织真正用起来，才是 FDE 能力。",
      pad,
      y,
      cw,
      lh,
      3,
    );
    y = afterWrap(top, lh, 44);
  }

  // ——— Outcomes ———
  y = softRule(y);
  ctx.fillStyle = TEXT;
  ctx.font = `900 44px ${FONT}`;
  ctx.fillText("结业带走", pad, y);
  y += 56;
  ctx.fillStyle = MUTED;
  ctx.font = `600 22px ${FONT}`;
  ctx.fillText("用完整项目成果，证明企业 AI 实战能力", pad, y);
  y += 36;

  const gGap = 18;
  const gW = (cw - gGap) / 2;
  const gH = 138;
  OUTCOMES.forEach((item, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = pad + col * (gW + gGap);
    const cy = y + row * (gH + gGap);
    roundRect(ctx, x, cy, gW, gH, 18);
    ctx.fillStyle = CARD;
    ctx.fill();
    ctx.strokeStyle = "rgba(212,175,55,0.28)";
    ctx.lineWidth = 1.4;
    roundRect(ctx, x, cy, gW, gH, 18);
    ctx.stroke();

    ctx.fillStyle = GOLD;
    ctx.font = `900 22px ${FONT}`;
    ctx.fillText(String(i + 1).padStart(2, "0"), x + 22, cy + 20);
    ctx.fillStyle = TEXT;
    ctx.font = `800 22px ${FONT}`;
    const titleLh = 30;
    const titleTop = wrapText(ctx, item.title, x + 22, cy + 52, gW - 44, titleLh, 2);
    ctx.fillStyle = MUTED;
    ctx.font = `600 17px ${FONT}`;
    ctx.fillText(item.desc, x + 22, Math.min(afterWrap(titleTop, titleLh, 8), cy + gH - 26));
  });
  y += 2 * (gH + gGap) + 32;

  // ——— Price + QR (matched height, dark QR frame) ———
  y = softRule(y);
  const blockH = 280;
  const qrPanelW = 248;
  const priceW = cw - qrPanelW - 20;

  roundRect(ctx, pad, y, priceW, blockH, 20);
  ctx.fillStyle = "rgba(8,21,38,0.96)";
  ctx.fill();
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 2;
  roundRect(ctx, pad, y, priceW, blockH, 20);
  ctx.stroke();

  ctx.fillStyle = MUTED;
  ctx.font = `700 22px ${FONT}`;
  ctx.fillText("标准 FDE 学员班", pad + 36, y + 36);
  ctx.fillStyle = GOLD;
  ctx.font = `900 72px ${FONT}`;
  ctx.fillText(opts.priceLabel || "¥1,980", pad + 36, y + 92);

  let mx = pad + 36;
  const my = y + blockH - 70;
  for (const t of ["3 周线上训练", "3 个月入职教练陪跑"] as const) {
    ctx.font = `700 18px ${FONT}`;
    const tw = ctx.measureText(t).width + 28;
    if (mx + tw > pad + priceW - 24) break;
    roundRect(ctx, mx, my, tw, 36, 10);
    ctx.fillStyle = "rgba(59,130,246,0.18)";
    ctx.fill();
    ctx.fillStyle = "#93c5fd";
    ctx.fillText(t, mx + 14, my + 9);
    mx += tw + 12;
  }

  const qx = pad + priceW + 20;
  roundRect(ctx, qx, y, qrPanelW, blockH, 20);
  ctx.fillStyle = CARD;
  ctx.fill();
  ctx.strokeStyle = "rgba(212,175,55,0.55)";
  ctx.lineWidth = 1.6;
  roundRect(ctx, qx, y, qrPanelW, blockH, 20);
  ctx.stroke();

  const qrSize = 168;
  const qInnerX = qx + (qrPanelW - qrSize) / 2;
  const qInnerY = y + 36;
  roundRect(ctx, qInnerX - 10, qInnerY - 10, qrSize + 20, qrSize + 20, 12);
  ctx.fillStyle = "#fff";
  ctx.fill();
  if (opts.qrCanvas) ctx.drawImage(opts.qrCanvas, qInnerX, qInnerY, qrSize, qrSize);
  else {
    ctx.fillStyle = "#e5e7eb";
    ctx.fillRect(qInnerX, qInnerY, qrSize, qrSize);
  }
  ctx.fillStyle = GOLD_SOFT;
  ctx.font = `800 18px ${FONT}`;
  ctx.textAlign = "center";
  ctx.fillText("扫码咨询 / 选购", qx + qrPanelW / 2, y + blockH - 42);
  ctx.textAlign = "start";
  y += blockH + 36;

  // Footer
  roundRect(ctx, pad, y, cw, 72, 14);
  ctx.fillStyle = "rgba(37,99,235,0.16)";
  ctx.fill();
  ctx.fillStyle = TEXT;
  ctx.font = `600 20px ${FONT}`;
  ctx.textAlign = "center";
  ctx.fillText("适合：大学生 · 应届毕业生 · 初级转型者 · 企业种子员工", W / 2, y + 26);
  ctx.textAlign = "start";
  y += 96;

  ctx.fillStyle = GOLD_SOFT;
  ctx.font = `700 20px ${FONT}`;
  ctx.textAlign = "center";
  ctx.fillText(opts.scanHint || "青山在 OPC | 企业 AI 人才训练与项目交付平台", W / 2, y);
  ctx.textAlign = "start";
  ctx.textBaseline = "alphabetic";

  const usedH = Math.min(H, y + 56);
  const out = document.createElement("canvas");
  out.width = W;
  out.height = usedH;
  const octx = out.getContext("2d");
  if (!octx) return canvas.toDataURL("image/png");
  octx.drawImage(canvas, 0, 0, W, usedH, 0, 0, W, usedH);
  return out.toDataURL("image/png");
}

/** Style 2: ink — paper / ink-green editorial short poster */
function composeInk(opts: SharePosterInput): string {
  const W = 750;
  const H = 1280;
  const pad = 44;
  const cw = W - pad * 2;
  const INK = "#0f2e2a";
  const TEAL = "#0d9488";
  const PAPER = "#f6f1e8";
  const MUTED = "#3f5e5a";
  const GOLD = "#b45309";

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 不可用");
  ctx.textBaseline = "top";

  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, W, H);

  // subtle paper grain bands
  ctx.fillStyle = "rgba(15,46,42,0.035)";
  ctx.fillRect(0, 0, W, 160);
  ctx.fillRect(0, H - 320, W, 320);

  // Top brand strip
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, W, 96);
  ctx.fillStyle = GOLD;
  ctx.fillRect(0, 96, W, 3);
  ctx.fillStyle = "#f8fafc";
  ctx.font = `700 22px ${FONT}`;
  ctx.fillText("青山在 · FDE ACADEMY", pad, 28);
  ctx.fillStyle = "rgba(248,250,252,0.72)";
  ctx.font = `600 16px ${FONT}`;
  ctx.textAlign = "right";
  ctx.fillText(channelLabel(opts.audience), W - pad, 32);
  ctx.textAlign = "start";

  let y = 140;
  ctx.fillStyle = TEAL;
  ctx.font = `800 15px ${FONT}`;
  ctx.fillText("ENTERPRISE AI  ·  21-DAY CAMP", pad, y);
  y += 36;

  ctx.fillStyle = INK;
  ctx.font = `900 46px ${FONT}`;
  {
    const lh = 58;
    const top = wrapText(ctx, opts.title || HERO_LINE, pad, y, cw, lh, 3);
    y = top + lh + 22;
  }

  ctx.fillStyle = TEAL;
  ctx.fillRect(pad, y, 64, 5);
  y += 28;

  ctx.fillStyle = MUTED;
  ctx.font = `600 22px ${FONT}`;
  {
    const lh = 34;
    const top = wrapText(ctx, opts.slogan || HERO_SUB, pad, y, cw, lh, 3);
    y = top + lh + 36;
  }

  // Three editorial cards
  const points = [
    { k: "01", t: "结构化训练", d: "21 天任务驱动，每周可验收" },
    { k: "02", t: "能力递进", d: "产品 · Agent · 组织推动" },
    { k: "03", t: "成果留痕", d: "结业证书公开可核验" },
  ] as const;
  const cardH = 108;
  for (const p of points) {
    roundRect(ctx, pad, y, cw, cardH, 14);
    ctx.fillStyle = "#fff";
    ctx.fill();
    ctx.strokeStyle = "rgba(15,46,42,0.12)";
    ctx.lineWidth = 1.4;
    roundRect(ctx, pad, y, cw, cardH, 14);
    ctx.stroke();
    ctx.fillStyle = TEAL;
    ctx.font = `900 28px ${FONT}`;
    ctx.fillText(p.k, pad + 24, y + 28);
    ctx.fillStyle = INK;
    ctx.font = `800 26px ${FONT}`;
    ctx.fillText(p.t, pad + 100, y + 26);
    ctx.fillStyle = MUTED;
    ctx.font = `600 20px ${FONT}`;
    ctx.fillText(p.d, pad + 100, y + 64);
    y += cardH + 14;
  }

  y += 10;
  // Price band
  roundRect(ctx, pad, y, cw, 132, 16);
  ctx.fillStyle = INK;
  ctx.fill();
  ctx.fillStyle = GOLD;
  ctx.fillRect(pad, y, 7, 132);
  ctx.fillStyle = "rgba(248,250,252,0.7)";
  ctx.font = `700 18px ${FONT}`;
  ctx.fillText("标准 FDE 学员班", pad + 28, y + 28);
  ctx.fillStyle = "#f8fafc";
  ctx.font = `900 56px ${FONT}`;
  ctx.fillText(opts.priceLabel || "¥1,980", pad + 28, y + 58);
  y += 152;

  // Footer: issuer + QR
  const qrSize = 168;
  const qrBox = qrSize + 36;
  const qx = W - pad - qrBox;
  roundRect(ctx, qx, y, qrBox, qrBox + 36, 14);
  ctx.fillStyle = "#fff";
  ctx.fill();
  ctx.strokeStyle = "rgba(15,46,42,0.14)";
  ctx.lineWidth = 1.4;
  roundRect(ctx, qx, y, qrBox, qrBox + 36, 14);
  ctx.stroke();
  if (opts.qrCanvas) ctx.drawImage(opts.qrCanvas, qx + 18, y + 18, qrSize, qrSize);
  else {
    ctx.fillStyle = "#e7e5e4";
    ctx.fillRect(qx + 18, y + 18, qrSize, qrSize);
  }
  ctx.fillStyle = TEAL;
  ctx.font = `800 16px ${FONT}`;
  ctx.textAlign = "center";
  ctx.fillText("微信扫码选购", qx + qrBox / 2, y + qrBox + 8);
  ctx.textAlign = "start";

  ctx.fillStyle = INK;
  ctx.font = `800 22px ${FONT}`;
  wrapText(ctx, opts.issuerLabel || "青山在 · 学员邀请", pad, y + 8, qx - pad - 20, 30, 2);
  ctx.fillStyle = MUTED;
  ctx.font = `600 18px ${FONT}`;
  wrapText(ctx, opts.scanHint || "扫码登录后进入选购", pad, y + 78, qx - pad - 20, 28, 2);
  ctx.fillStyle = TEAL;
  ctx.font = `700 16px ${FONT}`;
  ctx.fillText("青山在 OPC", pad, H - 42);

  return canvas.toDataURL("image/png");
}

/** Style 3: brutal neo — cream, hard borders, sticker collage */
function composeBrutal(opts: SharePosterInput): string {
  const W = 750;
  const H = 1280;
  const pad = 36;
  const cw = W - pad * 2;
  const INK = "#111111";
  const CREAM = "#fff8e7";
  const YELLOW = "#ffde59";
  const PINK = "#ff90e8";
  const TEAL = "#23a094";
  const BLUE = "#90b5ff";

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 不可用");
  ctx.textBaseline = "top";

  ctx.fillStyle = CREAM;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = YELLOW;
  ctx.fillRect(0, 0, W, 22);
  ctx.fillStyle = INK;
  ctx.fillRect(0, H - 22, W, 22);

  const sticker = (x: number, y: number, w: number, h: number, fill: string, r = 0) => {
    ctx.fillStyle = INK;
    if (r > 0) {
      roundRect(ctx, x + 6, y + 6, w, h, r);
      ctx.fill();
      roundRect(ctx, x, y, w, h, r);
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 5;
      roundRect(ctx, x, y, w, h, r);
      ctx.stroke();
    } else {
      ctx.fillRect(x + 6, y + 6, w, h);
      ctx.fillStyle = fill;
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 5;
      ctx.strokeRect(x, y, w, h);
    }
  };

  let y = 48;
  sticker(pad, y, cw, 78, "#fff");
  ctx.fillStyle = INK;
  ctx.font = `900 28px ${FONT}`;
  ctx.fillText("青山在 · FDE 训练营", pad + 22, y + 24);
  y += 100;

  sticker(pad, y, 220, 48, BLUE);
  ctx.fillStyle = INK;
  ctx.font = `900 18px ${FONT}`;
  ctx.fillText(channelLabel(opts.audience), pad + 16, y + 14);
  y += 70;

  // Title sticker
  const titleBoxH = 210;
  sticker(pad, y, cw, titleBoxH, YELLOW);
  ctx.fillStyle = INK;
  ctx.font = `900 42px ${FONT}`;
  {
    const lh = 54;
    const top = wrapText(ctx, opts.title || HERO_LINE, pad + 24, y + 28, cw - 48, lh, 3);
    void top;
  }
  y += titleBoxH + 18;

  sticker(pad, y, cw, 96, "#fff");
  ctx.fillStyle = INK;
  ctx.font = `800 22px ${FONT}`;
  wrapText(ctx, opts.slogan || HERO_SUB, pad + 22, y + 22, cw - 44, 30, 2);
  y += 116;

  // Chip stickers
  for (const [i, chip] of CHIPS.entries()) {
    const fills = [PINK, YELLOW, BLUE] as const;
    sticker(pad, y, 36, 36, fills[i % 3]!);
    ctx.fillStyle = INK;
    ctx.font = `900 24px ${FONT}`;
    ctx.fillText(chip, pad + 56, y + 6);
    y += 56;
  }
  y += 8;

  // Price + QR row
  const qrSize = 156;
  const qrPanel = qrSize + 44;
  const priceW = cw - qrPanel - 16;
  const rowH = 230;
  sticker(pad, y, priceW, rowH, TEAL);
  ctx.fillStyle = "#fff";
  ctx.font = `900 20px ${FONT}`;
  ctx.fillText("标准学员班", pad + 22, y + 32);
  ctx.font = `900 58px ${FONT}`;
  ctx.fillText(opts.priceLabel || "¥1,980", pad + 22, y + 78);
  ctx.font = `800 18px ${FONT}`;
  ctx.fillText("支付成功立即开通", pad + 22, y + 168);

  const qx = pad + priceW + 16;
  sticker(qx, y, qrPanel, rowH, "#fff", 0);
  const qInner = qx + (qrPanel - qrSize) / 2;
  if (opts.qrCanvas) ctx.drawImage(opts.qrCanvas, qInner, y + 20, qrSize, qrSize);
  else {
    ctx.fillStyle = "#ddd";
    ctx.fillRect(qInner, y + 20, qrSize, qrSize);
  }
  ctx.fillStyle = INK;
  ctx.font = `900 18px ${FONT}`;
  ctx.textAlign = "center";
  ctx.fillText("扫码报名", qx + qrPanel / 2, y + rowH - 36);
  ctx.textAlign = "start";
  y += rowH + 24;

  sticker(pad, y, cw, 88, PINK);
  ctx.fillStyle = INK;
  ctx.font = `900 22px ${FONT}`;
  ctx.fillText(opts.issuerLabel || "学员邀请", pad + 22, y + 18);
  ctx.font = `800 18px ${FONT}`;
  ctx.fillText(opts.scanHint || "微信扫码登录并选购", pad + 22, y + 52);

  return canvas.toDataURL("image/png");
}

/** Style 4: clean — white conversion poster, price-first */
function composeClean(opts: SharePosterInput): string {
  const W = 750;
  const H = 1280;
  const pad = 40;
  const cw = W - pad * 2;
  const INK = "#111111";
  const RED = "#ff4d2e";
  const YELLOW = "#ffe14d";
  const MUTED = "#6b7280";
  const LINE = "#e5e7eb";

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 不可用");
  ctx.textBaseline = "top";

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);

  // Top bar
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, W, 72);
  roundRect(ctx, pad, 18, 64, 36, 8);
  ctx.fillStyle = RED;
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.font = `800 18px ${FONT}`;
  ctx.fillText("招生", pad + 14, 26);
  ctx.font = `700 18px ${FONT}`;
  ctx.fillText(channelLabel(opts.audience), pad + 84, 28);

  let y = 104;
  ctx.fillStyle = MUTED;
  ctx.font = `700 18px ${FONT}`;
  ctx.fillText("青山在 · FDE ACADEMY", pad, y);
  y += 40;

  // Title with red rail
  ctx.fillStyle = RED;
  ctx.fillRect(pad, y, 8, 120);
  ctx.fillStyle = INK;
  ctx.font = `900 44px ${FONT}`;
  {
    const lh = 56;
    const top = wrapText(ctx, opts.title || HERO_LINE, pad + 24, y + 8, cw - 24, lh, 3);
    y = Math.max(y + 128, top + lh + 24);
  }

  // Slogan highlight
  ctx.font = `800 20px ${FONT}`;
  const slogan = opts.slogan || HERO_SUB;
  const sLines = slogan.length > 18 ? 2 : 1;
  const sH = sLines === 1 ? 48 : 78;
  roundRect(ctx, pad, y, cw, sH, 10);
  ctx.fillStyle = YELLOW;
  ctx.fill();
  ctx.fillStyle = INK;
  wrapText(ctx, slogan, pad + 18, y + 14, cw - 36, 28, 2);
  y += sH + 28;

  // Giant price
  ctx.fillStyle = RED;
  ctx.font = `900 92px ${FONT}`;
  ctx.fillText(opts.priceLabel || "¥1,980", pad, y);
  y += 100;
  ctx.fillStyle = MUTED;
  ctx.font = `600 20px ${FONT}`;
  ctx.fillText("标准 FDE 学员班 · 支付后立即开通", pad, y);
  y += 40;

  ctx.strokeStyle = LINE;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(pad, y);
  ctx.lineTo(W - pad, y);
  ctx.stroke();
  y += 28;

  // Benefits full-width
  for (const p of CHIPS) {
    roundRect(ctx, pad, y, cw, 56, 12);
    ctx.fillStyle = "#f3f4f6";
    ctx.fill();
    ctx.fillStyle = RED;
    ctx.font = `900 24px ${FONT}`;
    ctx.fillText("✓", pad + 20, y + 14);
    ctx.fillStyle = INK;
    ctx.font = `800 24px ${FONT}`;
    ctx.fillText(p, pad + 56, y + 16);
    y += 68;
  }

  y += 8;
  ctx.fillStyle = INK;
  ctx.font = `800 22px ${FONT}`;
  ctx.fillText(opts.issuerLabel || "学员邀请", pad, y);
  y += 44;

  // Bottom CTA panel
  const panelH = H - y - 36;
  roundRect(ctx, pad, y, cw, Math.max(260, panelH), 18);
  ctx.fillStyle = INK;
  ctx.fill();

  const qrSize = 168;
  const qPad = 28;
  if (opts.qrCanvas) {
    roundRect(ctx, pad + qPad, y + qPad, qrSize + 20, qrSize + 20, 12);
    ctx.fillStyle = "#fff";
    ctx.fill();
    ctx.drawImage(opts.qrCanvas, pad + qPad + 10, y + qPad + 10, qrSize, qrSize);
  } else {
    ctx.fillStyle = "#333";
    ctx.fillRect(pad + qPad, y + qPad, qrSize + 20, qrSize + 20);
  }

  const tx = pad + qPad + qrSize + 48;
  ctx.fillStyle = "#fff";
  ctx.font = `900 28px ${FONT}`;
  wrapText(ctx, "立即扫码报名", tx, y + 48, cw - qrSize - 90, 36, 2);
  ctx.fillStyle = "rgba(255,255,255,0.72)";
  ctx.font = `600 18px ${FONT}`;
  wrapText(ctx, opts.scanHint || "微信扫码 · 一键登录选购", tx, y + 120, cw - qrSize - 90, 28, 3);

  roundRect(ctx, tx, y + 190, Math.min(220, W - tx - pad - 28), 52, 12);
  ctx.fillStyle = RED;
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.font = `900 20px ${FONT}`;
  ctx.fillText("扫码开通课程", tx + 28, y + 204);

  return canvas.toDataURL("image/png");
}

export async function composeSharePoster(opts: SharePosterInput): Promise<string> {
  if (opts.style === "academy") return composeAcademy(opts);
  if (opts.style === "ink") return composeInk(opts);
  if (opts.style === "brutal") return composeBrutal(opts);
  return composeClean(opts);
}
