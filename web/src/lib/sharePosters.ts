/** 分享海报：FDE Academy 深蓝金四套（Hero / 路径 / 成果 / 报价）Canvas 合成 */

export type PosterStyleId = "hero" | "roadmap" | "outcomes" | "offer";

export type PosterAudience = "org" | "personal";

export type SharePosterInput = {
  style: PosterStyleId;
  audience: PosterAudience;
  title: string;
  priceLabel: string;
  /** 机构名或个人昵称 */
  issuerLabel: string;
  slogan?: string;
  /** @deprecated 卖课海报不再使用封面图 */
  coverSrc?: string | null;
  qrCanvas: HTMLCanvasElement | null;
  /** 扫码说明 */
  scanHint?: string;
};

export const POSTER_STYLES: Array<{
  id: PosterStyleId;
  name: string;
  blurb: string;
  swatch: [string, string, string];
}> = [
  {
    id: "hero",
    name: "主视觉 Hero",
    blurb: "21 天主标题 · 深蓝金 · 驾驶舱氛围",
    swatch: ["#0a1628", "#c9a227", "#3b82f6"],
  },
  {
    id: "roadmap",
    name: "实施路径",
    blurb: "三周 + 陪跑四阶 · 任务驱动闭环",
    swatch: ["#0b1c33", "#d4af37", "#60a5fa"],
  },
  {
    id: "outcomes",
    name: "结业带走",
    blurb: "四件交付物 · 证明企业 AI 实战",
    swatch: ["#0c2038", "#f0d78c", "#93c5fd"],
  },
  {
    id: "offer",
    name: "报价扫码",
    blurb: "¥1980 大字报 · 扫码进选购",
    swatch: ["#081526", "#e8c547", "#ffffff"],
  },
];

const FONT =
  '"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans SC",-apple-system,sans-serif';

const NAVY = "#0a1628";
const NAVY_2 = "#0f2138";
const GOLD = "#d4af37";
const GOLD_SOFT = "#f0d78c";
const TEXT = "#f8fafc";
const MUTED = "rgba(248,250,252,0.72)";

const HERO_LINE = "21天，跑通企业AI项目全流程";
const HERO_SUB = "工程能力让系统跑起来，组织推动让项目真正落地";
const DEFAULT_SLOGAN = "从系统构建，到组织落地";
const CHIPS = ["3周线上训练", "企业项目实战", "3个月入职教练陪跑"] as const;
const PATH_STEPS = [
  { no: "01", title: "第一周 · AI 增强型全栈原型" },
  { no: "02", title: "第二周 · 企业需求诊断与实操" },
  { no: "03", title: "第三周 · 组织推动与 AI 落地" },
  { no: "04", title: "第二阶段 · 3 个月入职教练陪跑" },
] as const;
const OUTCOME_ITEMS = [
  "1 套企业部门 AI 系统",
  "1 套老板 AI 经营驾驶舱",
  "1 个专业 Agent + 3 个岗位 Skill",
  "代码仓库 + 项目文档 + 数字作品集",
] as const;
const ACADEMY_REF = "/landing/fde-academy-ref.png";

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
  maxLines = 4,
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

function fillAcademyBg(ctx: CanvasRenderingContext2D, W: number, H: number) {
  const g = ctx.createLinearGradient(0, 0, W * 0.2, H);
  g.addColorStop(0, "#07111f");
  g.addColorStop(0.45, NAVY);
  g.addColorStop(1, "#102844");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  const glow = ctx.createRadialGradient(W * 0.8, 80, 20, W * 0.75, 120, 380);
  glow.addColorStop(0, "rgba(59,130,246,0.28)");
  glow.addColorStop(1, "rgba(59,130,246,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  const goldGlow = ctx.createRadialGradient(80, H * 0.7, 10, 120, H * 0.75, 280);
  goldGlow.addColorStop(0, "rgba(212,175,55,0.16)");
  goldGlow.addColorStop(1, "rgba(212,175,55,0)");
  ctx.fillStyle = goldGlow;
  ctx.fillRect(0, 0, W, H);
}

function drawBrandBar(
  ctx: CanvasRenderingContext2D,
  W: number,
  audience: PosterAudience,
  issuerLabel: string,
) {
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fillRect(0, 0, W, 92);
  ctx.fillStyle = GOLD;
  ctx.fillRect(0, 0, 6, 92);
  ctx.fillStyle = GOLD_SOFT;
  ctx.font = `700 20px ${FONT}`;
  ctx.fillText("青山在 OPC · FDE ACADEMY", 28, 38);
  ctx.fillStyle = MUTED;
  ctx.font = `600 16px ${FONT}`;
  ctx.fillText(audience === "org" ? "机构渠道推荐" : "学员邀请通道", 28, 68);
  ctx.textAlign = "right";
  ctx.fillStyle = MUTED;
  ctx.font = `600 15px ${FONT}`;
  const trimmed = issuerLabel.length > 18 ? `${issuerLabel.slice(0, 17)}…` : issuerLabel;
  ctx.fillText(trimmed, W - 28, 56);
  ctx.textAlign = "start";
}

function drawQrBlock(
  ctx: CanvasRenderingContext2D,
  qr: HTMLCanvasElement | null,
  box: { x: number; y: number; w: number; h: number },
  label: string,
) {
  roundRect(ctx, box.x, box.y, box.w, box.h, 18);
  ctx.fillStyle = "#fff";
  ctx.fill();
  ctx.strokeStyle = "rgba(212,175,55,0.55)";
  ctx.lineWidth = 2;
  roundRect(ctx, box.x, box.y, box.w, box.h, 18);
  ctx.stroke();

  const pad = 22;
  const qrSize = Math.min(box.w - pad * 2, box.h - 70);
  const qx = box.x + (box.w - qrSize) / 2;
  const qy = box.y + 22;
  if (qr) {
    ctx.drawImage(qr, qx, qy, qrSize, qrSize);
  } else {
    ctx.fillStyle = "#e2e8f0";
    ctx.fillRect(qx, qy, qrSize, qrSize);
  }
  ctx.fillStyle = NAVY;
  ctx.font = `800 20px ${FONT}`;
  ctx.textAlign = "center";
  ctx.fillText(label, box.x + box.w / 2, box.y + box.h - 22);
  ctx.textAlign = "start";
}

function drawFooterHint(ctx: CanvasRenderingContext2D, W: number, H: number, hint: string) {
  ctx.fillStyle = MUTED;
  ctx.font = `600 16px ${FONT}`;
  ctx.textAlign = "center";
  ctx.fillText(hint, W / 2, H - 28);
  ctx.textAlign = "start";
}

async function composeHero(opts: SharePosterInput): Promise<string> {
  const W = 750;
  const H = 1334;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 不可用");

  fillAcademyBg(ctx, W, H);

  const ref = await loadImage(ACADEMY_REF);
  if (ref) {
    const srcH = Math.min(ref.height * 0.28, ref.width * 1.1);
    ctx.drawImage(ref, 0, 0, ref.width, srcH, 0, 0, W, 520);
    const fade = ctx.createLinearGradient(0, 280, 0, 560);
    fade.addColorStop(0, "rgba(10,22,40,0.15)");
    fade.addColorStop(0.55, "rgba(10,22,40,0.72)");
    fade.addColorStop(1, NAVY);
    ctx.fillStyle = fade;
    ctx.fillRect(0, 0, W, 560);
  }

  drawBrandBar(ctx, W, opts.audience, opts.issuerLabel);

  ctx.fillStyle = GOLD;
  ctx.font = `800 18px ${FONT}`;
  ctx.fillText("ENTERPRISE AI PROJECT CAMP", 40, 140);

  ctx.fillStyle = TEXT;
  ctx.font = `900 46px ${FONT}`;
  const titleEnd = wrapText(ctx, HERO_LINE, 40, 200, W - 80, 56, 2);

  ctx.fillStyle = MUTED;
  ctx.font = `600 22px ${FONT}`;
  wrapText(ctx, opts.slogan || HERO_SUB, 40, titleEnd + 48, W - 80, 32, 2);

  let chipX = 40;
  let chipY = 420;
  for (const chip of CHIPS) {
    ctx.font = `700 16px ${FONT}`;
    const tw = ctx.measureText(chip).width + 28;
    if (chipX + tw > W - 40) {
      chipX = 40;
      chipY += 52;
    }
    roundRect(ctx, chipX, chipY, tw, 40, 10);
    ctx.fillStyle = "rgba(15,33,56,0.88)";
    ctx.fill();
    ctx.strokeStyle = "rgba(212,175,55,0.45)";
    ctx.lineWidth = 1.5;
    roundRect(ctx, chipX, chipY, tw, 40, 10);
    ctx.stroke();
    ctx.fillStyle = GOLD_SOFT;
    ctx.fillText(chip, chipX + 14, chipY + 26);
    chipX += tw + 10;
  }

  const priceY = chipY + 80;
  roundRect(ctx, 40, priceY, W - 80, 150, 18);
  ctx.fillStyle = "rgba(8,21,38,0.92)";
  ctx.fill();
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 2;
  roundRect(ctx, 40, priceY, W - 80, 150, 18);
  ctx.stroke();
  ctx.fillStyle = MUTED;
  ctx.font = `700 18px ${FONT}`;
  ctx.fillText("标准 FDE 学员班", 64, priceY + 45);
  ctx.fillStyle = GOLD;
  ctx.font = `900 64px ${FONT}`;
  ctx.fillText(opts.priceLabel || "¥1,980", 64, priceY + 115);

  drawQrBlock(ctx, opts.qrCanvas, { x: (W - 280) / 2, y: priceY + 200, w: 280, h: 320 }, "扫码登录并选购");
  drawFooterHint(ctx, W, H, opts.scanHint || "微信扫码自动登录 · 支付后立即开通");
  return canvas.toDataURL("image/png");
}

function composeRoadmap(opts: SharePosterInput): string {
  const W = 750;
  const H = 1334;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 不可用");

  fillAcademyBg(ctx, W, H);
  drawBrandBar(ctx, W, opts.audience, opts.issuerLabel);

  ctx.fillStyle = TEXT;
  ctx.font = `900 40px ${FONT}`;
  wrapText(ctx, DEFAULT_SLOGAN, 40, 150, W - 80, 50, 2);
  ctx.fillStyle = MUTED;
  ctx.font = `600 20px ${FONT}`;
  ctx.fillText("FDE 企业 AI 项目实战实施路径", 40, 250);

  let y = 290;
  PATH_STEPS.forEach((step, i) => {
    roundRect(ctx, 40, y, W - 80, 88, 14);
    ctx.fillStyle = i === 2 ? "rgba(212,175,55,0.16)" : "rgba(15,33,56,0.9)";
    ctx.fill();
    ctx.strokeStyle = i === 2 ? GOLD : "rgba(96,165,250,0.28)";
    ctx.lineWidth = i === 2 ? 2 : 1.5;
    roundRect(ctx, 40, y, W - 80, 88, 14);
    ctx.stroke();

    ctx.fillStyle = GOLD;
    ctx.font = `900 28px ${FONT}`;
    ctx.fillText(step.no, 60, y + 54);
    ctx.fillStyle = TEXT;
    ctx.font = `800 24px ${FONT}`;
    ctx.fillText(step.title, 130, y + 54);
    y += 104;
  });

  roundRect(ctx, 40, y + 8, W - 80, 72, 14);
  ctx.fillStyle = "rgba(59,130,246,0.16)";
  ctx.fill();
  ctx.fillStyle = GOLD_SOFT;
  ctx.font = `700 18px ${FONT}`;
  ctx.textAlign = "center";
  ctx.fillText("本周任务 → 案例研发 → 教练评测 → 毕业结项", W / 2, y + 52);
  ctx.textAlign = "start";

  ctx.fillStyle = GOLD;
  ctx.font = `900 42px ${FONT}`;
  ctx.fillText(opts.priceLabel || "¥1,980", 40, y + 140);

  drawQrBlock(ctx, opts.qrCanvas, { x: W - 300, y: H - 380, w: 260, h: 300 }, "扫码报名");
  drawFooterHint(ctx, W, H, opts.scanHint || "扫码进入选购 · 支付计入推荐渠道");
  return canvas.toDataURL("image/png");
}

function composeOutcomes(opts: SharePosterInput): string {
  const W = 750;
  const H = 1334;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 不可用");

  fillAcademyBg(ctx, W, H);
  drawBrandBar(ctx, W, opts.audience, opts.issuerLabel);

  ctx.fillStyle = TEXT;
  ctx.font = `900 42px ${FONT}`;
  ctx.fillText("结业带走", 40, 160);
  ctx.fillStyle = MUTED;
  ctx.font = `600 22px ${FONT}`;
  wrapText(ctx, "用完整项目成果，证明企业 AI 实战能力", 40, 210, W - 80, 30, 2);

  const cardW = (W - 80 - 16) / 2;
  const cardH = 160;
  OUTCOME_ITEMS.forEach((item, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = 40 + col * (cardW + 16);
    const y = 280 + row * (cardH + 16);
    roundRect(ctx, x, y, cardW, cardH, 16);
    ctx.fillStyle = "rgba(15,33,56,0.92)";
    ctx.fill();
    ctx.strokeStyle = "rgba(212,175,55,0.35)";
    ctx.lineWidth = 1.5;
    roundRect(ctx, x, y, cardW, cardH, 16);
    ctx.stroke();
    ctx.fillStyle = GOLD;
    ctx.font = `900 28px ${FONT}`;
    ctx.fillText(String(i + 1).padStart(2, "0"), x + 18, y + 44);
    ctx.fillStyle = TEXT;
    ctx.font = `800 22px ${FONT}`;
    wrapText(ctx, item, x + 18, y + 88, cardW - 36, 28, 3);
  });

  roundRect(ctx, 40, 660, W - 80, 120, 16);
  ctx.fillStyle = "rgba(8,21,38,0.95)";
  ctx.fill();
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 2;
  roundRect(ctx, 40, 660, W - 80, 120, 16);
  ctx.stroke();
  ctx.fillStyle = MUTED;
  ctx.font = `700 18px ${FONT}`;
  ctx.fillText("标准 FDE 学员班", 64, 705);
  ctx.fillStyle = GOLD;
  ctx.font = `900 52px ${FONT}`;
  ctx.fillText(opts.priceLabel || "¥1,980", 64, 760);

  drawQrBlock(ctx, opts.qrCanvas, { x: (W - 280) / 2, y: 820, w: 280, h: 320 }, "扫码领取名额");
  drawFooterHint(ctx, W, H, opts.scanHint || "微信扫码登录并选购");
  return canvas.toDataURL("image/png");
}

function composeOffer(opts: SharePosterInput): string {
  const W = 750;
  const H = 1334;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 不可用");

  fillAcademyBg(ctx, W, H);
  drawBrandBar(ctx, W, opts.audience, opts.issuerLabel);

  ctx.fillStyle = GOLD_SOFT;
  ctx.font = `800 18px ${FONT}`;
  ctx.fillText("标准 FDE 学员班", 40, 150);

  ctx.fillStyle = TEXT;
  ctx.font = `900 40px ${FONT}`;
  wrapText(ctx, opts.title || HERO_LINE, 40, 210, W - 80, 50, 2);

  roundRect(ctx, 40, 340, W - 80, 220, 22);
  ctx.fillStyle = NAVY_2;
  ctx.fill();
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 3;
  roundRect(ctx, 40, 340, W - 80, 220, 22);
  ctx.stroke();

  ctx.fillStyle = MUTED;
  ctx.font = `700 20px ${FONT}`;
  ctx.fillText("限时招生价", 70, 395);
  ctx.fillStyle = GOLD;
  ctx.font = `900 92px ${FONT}`;
  ctx.fillText(opts.priceLabel || "¥1,980", 70, 500);
  ctx.fillStyle = MUTED;
  ctx.font = `600 18px ${FONT}`;
  ctx.fillText("3 周线上训练 + 3 个月入职教练陪跑", 70, 540);

  const fit = ["大学生 / 应届毕业生", "初级转型者", "企业种子员工"];
  let fx = 40;
  fit.forEach((t) => {
    ctx.font = `700 16px ${FONT}`;
    const tw = ctx.measureText(t).width + 24;
    roundRect(ctx, fx, 600, tw, 40, 20);
    ctx.fillStyle = "rgba(59,130,246,0.18)";
    ctx.fill();
    ctx.fillStyle = "#93c5fd";
    ctx.fillText(t, fx + 12, 626);
    fx += tw + 10;
  });

  ctx.fillStyle = MUTED;
  ctx.font = `600 20px ${FONT}`;
  wrapText(ctx, opts.slogan || HERO_SUB, 40, 690, W - 80, 30, 2);

  drawQrBlock(ctx, opts.qrCanvas, { x: (W - 300) / 2, y: 800, w: 300, h: 340 }, "扫码咨询 / 选购");
  drawFooterHint(ctx, W, H, opts.scanHint || "青山在 OPC｜企业 AI 人才训练与项目交付平台");
  return canvas.toDataURL("image/png");
}

export async function composeSharePoster(opts: SharePosterInput): Promise<string> {
  if (opts.style === "hero") return composeHero(opts);
  if (opts.style === "roadmap") return composeRoadmap(opts);
  if (opts.style === "outcomes") return composeOutcomes(opts);
  return composeOffer(opts);
}
