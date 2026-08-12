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
    blurb: "纸白墨绿 · 克制高端短海报",
    swatch: ["#0f2e2a", "#0d9488", "#f5f0e8"],
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
  { no: "01", title: "第一周｜AI增强型全栈原型", desc: "用 AI 做出可交互原型：录入、流程、部署与验收。" },
  { no: "02", title: "第二周｜企业需求诊断与实操", desc: "痛点梳理、价值判断、方案选型与小步验证。" },
  { no: "03", title: "第三周｜组织推动与AI落地", desc: "场景落地、跨部门协同、变更沟通与持续运营。", badge: "实战演练" },
  { no: "04", title: "第二阶段｜3个月入职教练陪跑", desc: "作品集打磨、面试表达、入职后问题拆解与成果汇报。" },
] as const;
const OUTCOMES = [
  { title: "1套企业部门AI系统", desc: "可见、可衡量、可管理" },
  { title: "1套老板AI经营驾驶舱", desc: "盯经营结果与效率" },
  { title: "1个专业Agent+3个岗位Skill", desc: "提升个人竞争力" },
  { title: "代码仓库+文档+作品集", desc: "求职可展示的硬资产" },
] as const;

export function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  a.click();
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

function drawQr(
  ctx: CanvasRenderingContext2D,
  qr: HTMLCanvasElement | null,
  x: number,
  y: number,
  size: number,
  label: string,
  labelColor: string,
  border = "#e5e7eb",
) {
  const boxH = size + 70;
  roundRect(ctx, x, y, size + 40, boxH, 16);
  ctx.fillStyle = "#fff";
  ctx.fill();
  ctx.strokeStyle = border;
  ctx.lineWidth = 2;
  roundRect(ctx, x, y, size + 40, boxH, 16);
  ctx.stroke();
  if (qr) ctx.drawImage(qr, x + 20, y + 18, size, size);
  else {
    ctx.fillStyle = "#e5e7eb";
    ctx.fillRect(x + 20, y + 18, size, size);
  }
  ctx.fillStyle = labelColor;
  ctx.font = `800 20px ${FONT}`;
  ctx.textAlign = "center";
  ctx.fillText(label, x + (size + 40) / 2, y + boxH - 22);
  ctx.textAlign = "start";
  return boxH;
}

function channelLabel(audience: PosterAudience) {
  return audience === "org" ? "机构渠道推荐" : "学员邀请通道";
}

/** Style 1: academy long page — sequential layout, no overlaps */
async function composeAcademy(opts: SharePosterInput): Promise<string> {
  const W = 1080;
  const pad = 48;
  const cw = W - pad * 2;
  const NAVY = "#0a1628";
  const GOLD = "#d4af37";
  const GOLD_SOFT = "#f0d78c";
  const TEXT = "#f8fafc";
  const MUTED = "rgba(248,250,252,0.72)";

  // Estimate height then draw (single pass with generous H, trim not needed for PNG share)
  const H = 3200;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 不可用");

  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#07111f");
  bg.addColorStop(0.4, NAVY);
  bg.addColorStop(1, "#0c1f36");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  let y = 0;

  // Hero band
  const heroH = 560;
  const ref = await loadImage(ACADEMY_REF);
  if (ref) {
    const srcH = Math.max(1, Math.floor(ref.height * 0.32));
    ctx.drawImage(ref, 0, 0, ref.width, srcH, 0, 0, W, heroH);
  }
  const fade = ctx.createLinearGradient(0, heroH * 0.25, 0, heroH);
  fade.addColorStop(0, "rgba(7,17,31,0.2)");
  fade.addColorStop(0.6, "rgba(7,17,31,0.78)");
  fade.addColorStop(1, NAVY);
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, W, heroH);

  // Brand row
  y = 40;
  ctx.fillStyle = GOLD;
  ctx.fillRect(pad, y, 6, 44);
  ctx.fillStyle = GOLD_SOFT;
  ctx.font = `700 24px ${FONT}`;
  ctx.fillText("青山在 OPC · FDE ACADEMY", pad + 18, y + 30);
  ctx.fillStyle = MUTED;
  ctx.font = `600 18px ${FONT}`;
  ctx.fillText(channelLabel(opts.audience), pad + 18, y + 58);
  ctx.textAlign = "right";
  ctx.fillText((opts.issuerLabel || "").slice(0, 20), W - pad, y + 40);
  ctx.textAlign = "start";

  // Title block — flow down, never absolute bottom chips overlapping title
  y = 150;
  ctx.fillStyle = TEXT;
  ctx.font = `900 54px ${FONT}`;
  y = wrapText(ctx, HERO_LINE, pad, y, cw, 66, 2) + 36;
  ctx.fillStyle = MUTED;
  ctx.font = `600 26px ${FONT}`;
  y = wrapText(ctx, opts.slogan || HERO_SUB, pad, y, cw, 36, 2) + 28;

  // Chips under subtitle
  let chipX = pad;
  let chipY = y;
  const chipH = 44;
  for (const chip of CHIPS) {
    ctx.font = `700 20px ${FONT}`;
    const tw = ctx.measureText(chip).width + 36;
    if (chipX + tw > W - pad) {
      chipX = pad;
      chipY += chipH + 12;
    }
    roundRect(ctx, chipX, chipY, tw, chipH, 12);
    ctx.fillStyle = "rgba(10,22,40,0.9)";
    ctx.fill();
    ctx.strokeStyle = "rgba(212,175,55,0.55)";
    ctx.lineWidth = 1.5;
    roundRect(ctx, chipX, chipY, tw, chipH, 12);
    ctx.stroke();
    ctx.fillStyle = GOLD_SOFT;
    ctx.fillText(chip, chipX + 18, chipY + 29);
    chipX += tw + 12;
  }
  y = Math.max(chipY + chipH + 36, heroH + 36);

  // Path section
  ctx.fillStyle = TEXT;
  ctx.font = `900 42px ${FONT}`;
  ctx.fillText("从系统构建，到组织落地", pad, y);
  y += 44;
  ctx.fillStyle = MUTED;
  ctx.font = `600 22px ${FONT}`;
  ctx.fillText("FDE企业AI项目实战实施路径", pad, y);
  y += 32;

  for (const step of PATH_STEPS) {
    const hasBadge = "badge" in step && Boolean(step.badge);
    ctx.font = `800 26px ${FONT}`;
    const titleH = measureWrap(ctx, step.title, cw - 160, 32, 2);
    ctx.font = `600 20px ${FONT}`;
    const descH = measureWrap(ctx, step.desc, cw - 160, 28, 2);
    const cardH = Math.max(120, 28 + (hasBadge ? 36 : 0) + titleH + 12 + descH + 24);

    roundRect(ctx, pad, y, cw, cardH, 16);
    ctx.fillStyle = step.no === "03" ? "rgba(212,175,55,0.12)" : "rgba(15,33,56,0.92)";
    ctx.fill();
    ctx.strokeStyle = step.no === "03" ? GOLD : "rgba(96,165,250,0.25)";
    ctx.lineWidth = step.no === "03" ? 2 : 1.4;
    roundRect(ctx, pad, y, cw, cardH, 16);
    ctx.stroke();

    let iy = y + 36;
    ctx.fillStyle = GOLD;
    ctx.font = `900 32px ${FONT}`;
    ctx.fillText(step.no, pad + 24, iy);

    if (hasBadge && step.badge) {
      ctx.font = `800 16px ${FONT}`;
      const bw = ctx.measureText(step.badge).width + 22;
      roundRect(ctx, W - pad - bw - 20, y + 18, bw, 30, 8);
      ctx.fillStyle = GOLD;
      ctx.fill();
      ctx.fillStyle = NAVY;
      ctx.fillText(step.badge, W - pad - bw - 9, y + 39);
    }

    iy += 8;
    ctx.fillStyle = TEXT;
    ctx.font = `800 26px ${FONT}`;
    iy = wrapText(ctx, step.title, pad + 100, iy, cw - 160, 32, 2) + 14;
    ctx.fillStyle = MUTED;
    ctx.font = `600 20px ${FONT}`;
    wrapText(ctx, step.desc, pad + 100, iy, cw - 160, 28, 2);
    y += cardH + 16;
  }

  // Loop bar
  roundRect(ctx, pad, y, cw, 64, 14);
  ctx.fillStyle = "rgba(59,130,246,0.16)";
  ctx.fill();
  ctx.fillStyle = GOLD_SOFT;
  ctx.font = `700 20px ${FONT}`;
  ctx.textAlign = "center";
  ctx.fillText("任务驱动训练闭环｜本周任务 → 案例研发 → 教练评测 → 毕业结项", W / 2, y + 40);
  ctx.textAlign = "start";
  y += 88;

  ctx.fillStyle = MUTED;
  ctx.font = `600 22px ${FONT}`;
  y = wrapText(ctx, "能把系统做出来，是工程能力；能让组织真正用起来，才是FDE能力。", pad, y, cw, 32, 3) + 48;

  // Outcomes
  ctx.fillStyle = TEXT;
  ctx.font = `900 42px ${FONT}`;
  ctx.fillText("结业带走", pad, y);
  y += 42;
  ctx.fillStyle = MUTED;
  ctx.font = `600 22px ${FONT}`;
  ctx.fillText("用完整项目成果，证明企业AI实战能力", pad, y);
  y += 28;

  const gap = 16;
  const cardW = (cw - gap) / 2;
  const cardH = 168;
  OUTCOMES.forEach((item, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = pad + col * (cardW + gap);
    const cy = y + row * (cardH + gap);
    roundRect(ctx, x, cy, cardW, cardH, 16);
    ctx.fillStyle = "rgba(15,33,56,0.92)";
    ctx.fill();
    ctx.strokeStyle = "rgba(212,175,55,0.3)";
    ctx.lineWidth = 1.4;
    roundRect(ctx, x, cy, cardW, cardH, 16);
    ctx.stroke();
    ctx.fillStyle = GOLD;
    ctx.font = `900 26px ${FONT}`;
    ctx.fillText(String(i + 1).padStart(2, "0"), x + 20, cy + 40);
    ctx.fillStyle = TEXT;
    ctx.font = `800 22px ${FONT}`;
    const ty = wrapText(ctx, item.title, x + 20, cy + 78, cardW - 40, 28, 2);
    ctx.fillStyle = MUTED;
    ctx.font = `600 18px ${FONT}`;
    ctx.fillText(item.desc, x + 20, Math.min(ty + 28, cy + cardH - 22));
  });
  y += 2 * (cardH + gap) + 28;

  // Price card
  const priceH = 210;
  roundRect(ctx, pad, y, cw, priceH, 20);
  ctx.fillStyle = "rgba(8,21,38,0.96)";
  ctx.fill();
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 2;
  roundRect(ctx, pad, y, cw, priceH, 20);
  ctx.stroke();
  ctx.fillStyle = MUTED;
  ctx.font = `700 22px ${FONT}`;
  ctx.fillText("标准FDE学员班", pad + 32, y + 46);
  ctx.fillStyle = GOLD;
  ctx.font = `900 72px ${FONT}`;
  ctx.fillText(opts.priceLabel || "¥1,980", pad + 32, y + 120);
  let mx = pad + 32;
  const my = y + priceH - 48;
  for (const t of ["3周线上训练", "3个月入职教练陪跑"] as const) {
    ctx.font = `700 18px ${FONT}`;
    const tw = ctx.measureText(t).width + 28;
    roundRect(ctx, mx, my, tw, 34, 10);
    ctx.fillStyle = "rgba(59,130,246,0.18)";
    ctx.fill();
    ctx.fillStyle = "#93c5fd";
    ctx.fillText(t, mx + 14, my + 23);
    mx += tw + 12;
  }
  y += priceH + 36;

  // QR
  const qrSize = 260;
  const qrBoxW = qrSize + 40;
  const qx = (W - qrBoxW) / 2;
  const qh = drawQr(ctx, opts.qrCanvas, qx, y, qrSize, "扫码咨询课程 / 登录选购", NAVY, "rgba(212,175,55,0.65)");
  y += qh + 36;

  ctx.fillStyle = MUTED;
  ctx.font = `600 20px ${FONT}`;
  ctx.textAlign = "center";
  ctx.fillText("适合：大学生、应届毕业生、初级转型者、企业种子员工", W / 2, y);
  y += 34;
  ctx.fillStyle = GOLD_SOFT;
  ctx.font = `700 20px ${FONT}`;
  ctx.fillText(opts.scanHint || "青山在OPC | 企业AI人才训练与项目交付平台", W / 2, y);
  ctx.textAlign = "start";

  // Crop unused bottom canvas for cleaner share image
  const usedH = Math.min(H, y + 48);
  const out = document.createElement("canvas");
  out.width = W;
  out.height = usedH;
  const octx = out.getContext("2d");
  if (!octx) return canvas.toDataURL("image/png");
  octx.drawImage(canvas, 0, 0, W, usedH, 0, 0, W, usedH);
  return out.toDataURL("image/png");
}

/** Style 2: ink — short teal editorial */
function composeInk(opts: SharePosterInput): string {
  const W = 750;
  const H = 1200;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 不可用");

  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#f7f4ee");
  bg.addColorStop(1, "#e7f0ee");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = "#0f2e2a";
  ctx.fillRect(0, 0, W, 88);
  ctx.fillStyle = "#c9a227";
  ctx.fillRect(0, 88, W, 3);
  ctx.fillStyle = "#f8fafc";
  ctx.font = `700 22px ${FONT}`;
  ctx.fillText("青山在 · FDE ACADEMY", 36, 52);
  ctx.fillStyle = "rgba(248,250,252,0.75)";
  ctx.font = `600 15px ${FONT}`;
  ctx.fillText(channelLabel(opts.audience), W - 150, 52);

  let y = 140;
  ctx.fillStyle = "#0f2e2a";
  ctx.font = `900 44px ${FONT}`;
  y = wrapText(ctx, opts.title || HERO_LINE, 40, y, W - 80, 54, 3) + 28;
  ctx.fillStyle = "#0d9488";
  ctx.fillRect(40, y, 56, 4);
  y += 36;
  ctx.fillStyle = "#134e4a";
  ctx.font = `600 24px ${FONT}`;
  y = wrapText(ctx, opts.slogan || HERO_SUB, 40, y, W - 80, 34, 3) + 36;

  for (const p of ["21天结构化训练", "产品·Agent·组织递进", "结业可核验"] as const) {
    ctx.fillStyle = "#0d9488";
    ctx.beginPath();
    ctx.arc(52, y - 6, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#134e4a";
    ctx.font = `700 24px ${FONT}`;
    ctx.fillText(p, 72, y);
    y += 44;
  }

  y += 12;
  roundRect(ctx, 40, y, W - 80, 120, 16);
  ctx.fillStyle = "#0f2e2a";
  ctx.fill();
  ctx.fillStyle = "#c9a227";
  ctx.fillRect(40, y, 6, 120);
  ctx.fillStyle = "#f8fafc";
  ctx.font = `900 52px ${FONT}`;
  ctx.fillText(opts.priceLabel || "¥1,980", 64, y + 72);
  ctx.fillStyle = "rgba(248,250,252,0.7)";
  ctx.font = `600 18px ${FONT}`;
  ctx.fillText("支付成功立即开通", 64, y + 100);
  y += 150;

  ctx.fillStyle = "#0f2e2a";
  ctx.font = `700 20px ${FONT}`;
  ctx.fillText(opts.issuerLabel, 40, y);
  drawQr(ctx, opts.qrCanvas, W - 300, H - 360, 220, "微信扫码选购", "#0f766e", "rgba(15,46,42,0.15)");
  ctx.fillStyle = "#64748b";
  ctx.font = `600 16px ${FONT}`;
  ctx.fillText(opts.scanHint || "微信扫码登录并选购", 40, H - 40);
  return canvas.toDataURL("image/png");
}

/** Style 3: brutal neo */
function composeBrutal(opts: SharePosterInput): string {
  const W = 750;
  const H = 1200;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 不可用");

  ctx.fillStyle = "#fff8e7";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#ffde59";
  ctx.fillRect(0, 0, W, 18);
  ctx.fillStyle = "#111";
  ctx.fillRect(0, H - 18, W, 18);

  ctx.fillStyle = "#fff";
  ctx.strokeStyle = "#111";
  ctx.lineWidth = 4;
  ctx.fillRect(32, 40, W - 64, 78);
  ctx.strokeRect(32, 40, W - 64, 78);
  ctx.fillStyle = "#111";
  ctx.font = `900 26px ${FONT}`;
  ctx.fillText("青山在 · FDE 训练营", 48, 88);

  ctx.fillStyle = "#90b5ff";
  ctx.fillRect(32, 140, 170, 40);
  ctx.strokeRect(32, 140, 170, 40);
  ctx.fillStyle = "#111";
  ctx.font = `900 18px ${FONT}`;
  ctx.fillText(channelLabel(opts.audience), 48, 167);

  ctx.fillStyle = "#ffde59";
  ctx.fillRect(32, 204, W - 64, 200);
  ctx.strokeRect(32, 204, W - 64, 200);
  ctx.fillStyle = "#111";
  ctx.font = `900 42px ${FONT}`;
  wrapText(ctx, opts.title || HERO_LINE, 52, 270, W - 104, 52, 2);

  ctx.fillStyle = "#fff";
  ctx.fillRect(32, 430, W - 64, 72);
  ctx.strokeRect(32, 430, W - 64, 72);
  ctx.fillStyle = "#111";
  ctx.font = `800 22px ${FONT}`;
  wrapText(ctx, opts.slogan || HERO_SUB, 48, 474, W - 96, 28, 2);

  let py = 540;
  for (const p of CHIPS) {
    ctx.fillStyle = "#ff90e8";
    ctx.fillRect(32, py, 24, 24);
    ctx.strokeRect(32, py, 24, 24);
    ctx.fillStyle = "#111";
    ctx.font = `800 22px ${FONT}`;
    ctx.fillText(p, 70, py + 20);
    py += 44;
  }

  ctx.fillStyle = "#23a094";
  ctx.fillRect(32, 700, 250, 78);
  ctx.strokeRect(32, 700, 250, 78);
  ctx.fillStyle = "#fff";
  ctx.font = `900 40px ${FONT}`;
  ctx.fillText(opts.priceLabel || "¥1,980", 48, 752);

  ctx.fillStyle = "#111";
  ctx.font = `800 22px ${FONT}`;
  ctx.fillText(opts.issuerLabel, 32, 820);
  drawQr(ctx, opts.qrCanvas, W - 300, H - 360, 220, "扫码报名", "#111", "#111");
  ctx.fillStyle = "#111";
  ctx.font = `700 18px ${FONT}`;
  ctx.fillText(opts.scanHint || "扫码后自动登录并进入选购", 32, H - 40);
  return canvas.toDataURL("image/png");
}

/** Style 4: clean white conversion */
function composeClean(opts: SharePosterInput): string {
  const W = 750;
  const H = 1200;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 不可用");

  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#111";
  ctx.fillRect(0, 0, W, 64);
  ctx.fillStyle = "#ff4d2e";
  roundRect(ctx, 24, 16, 64, 32, 6);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.font = `800 16px ${FONT}`;
  ctx.fillText("招生", 38, 38);
  ctx.font = `600 18px ${FONT}`;
  ctx.fillText(channelLabel(opts.audience), 104, 38);

  let y = 110;
  ctx.fillStyle = "#111";
  ctx.font = `800 20px ${FONT}`;
  ctx.fillText("青山在 · FDE ACADEMY", 40, y);
  y += 48;
  ctx.fillStyle = "#ff4d2e";
  ctx.fillRect(40, y, 8, 110);
  ctx.fillStyle = "#111";
  ctx.font = `900 44px ${FONT}`;
  y = wrapText(ctx, opts.title || HERO_LINE, 64, y + 36, W - 110, 54, 2) + 40;

  const slogan = opts.slogan || HERO_SUB;
  ctx.font = `800 22px ${FONT}`;
  const sw = Math.min(ctx.measureText(slogan).width + 28, W - 80);
  ctx.fillStyle = "#ffe14d";
  ctx.fillRect(40, y, sw, 40);
  ctx.fillStyle = "#111";
  ctx.fillText(slogan.length > 22 ? `${slogan.slice(0, 21)}…` : slogan, 54, y + 28);
  y += 80;

  ctx.fillStyle = "#ff4d2e";
  ctx.font = `900 72px ${FONT}`;
  ctx.fillText(opts.priceLabel || "¥1,980", 40, y + 20);
  y += 56;
  ctx.fillStyle = "#6b7280";
  ctx.font = `600 20px ${FONT}`;
  ctx.fillText("标准FDE学员班 · 支付后立即开通", 40, y);
  y += 40;

  for (const p of ["3周线上训练", "企业项目实战", "3个月入职教练陪跑"] as const) {
    roundRect(ctx, 40, y, W - 320, 44, 10);
    ctx.fillStyle = "#f3f4f6";
    ctx.fill();
    ctx.fillStyle = "#111";
    ctx.font = `700 20px ${FONT}`;
    ctx.fillText(`✓  ${p}`, 56, y + 29);
    y += 56;
  }

  ctx.fillStyle = "#111";
  ctx.font = `700 22px ${FONT}`;
  ctx.fillText(opts.issuerLabel, 40, y + 12);
  drawQr(ctx, opts.qrCanvas, W - 300, H - 360, 220, "立即扫码报名", "#ff4d2e", "#e5e7eb");
  ctx.fillStyle = "#6b7280";
  ctx.font = `600 16px ${FONT}`;
  ctx.fillText(opts.scanHint || "微信扫码 · 一键报名开营", 40, H - 40);
  return canvas.toDataURL("image/png");
}

export async function composeSharePoster(opts: SharePosterInput): Promise<string> {
  if (opts.style === "academy") return composeAcademy(opts);
  if (opts.style === "ink") return composeInk(opts);
  if (opts.style === "brutal") return composeBrutal(opts);
  return composeClean(opts);
}
