/** 分享海报：FDE Academy 深蓝金 · 四套完整长图（对齐营销页结构） */

export type PosterStyleId = "hero" | "roadmap" | "outcomes" | "offer";

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
    id: "hero",
    name: "完整长图 · 主视觉",
    blurb: "驾驶舱开场 · 全链路长图",
    swatch: ["#0a1628", "#d4af37", "#3b82f6"],
  },
  {
    id: "roadmap",
    name: "完整长图 · 路径加粗",
    blurb: "四阶路径放大 · 仍是完整长图",
    swatch: ["#0b1c33", "#e8c547", "#60a5fa"],
  },
  {
    id: "outcomes",
    name: "完整长图 · 成果加粗",
    blurb: "结业带走放大 · 仍是完整长图",
    swatch: ["#0c2038", "#f0d78c", "#93c5fd"],
  },
  {
    id: "offer",
    name: "完整长图 · 报价加粗",
    blurb: "价格扫码放大 · 仍是完整长图",
    swatch: ["#081526", "#f5d76e", "#ffffff"],
  },
];

const FONT =
  '"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans SC",-apple-system,sans-serif';

const NAVY = "#0a1628";
const GOLD = "#d4af37";
const GOLD_SOFT = "#f0d78c";
const TEXT = "#f8fafc";
const MUTED = "rgba(248,250,252,0.72)";
const ACADEMY_REF = "/landing/fde-academy-ref.png";

const HERO_LINE = "21天，跑通企业AI项目全流程";
const HERO_SUB = "工程能力让系统跑起来，组织推动让项目真正落地";
const PATH_HEAD = "从系统构建，到组织落地";
const PATH_SUB = "FDE企业AI项目实战实施路径";
const LOOP = "本周任务 → 案例&研发 → 教练评测 → 毕业结项";
const QUOTE = "能把系统做出来，是工程能力；能让组织真正用起来，才是FDE能力。";
const OUTCOME_HEAD = "结业带走";
const OUTCOME_SUB = "用完整项目成果，证明企业AI实战能力";

const CHIPS = ["3周线上训练", "企业项目实战", "3个月入职教练陪跑"] as const;
const PATH_STEPS = [
  {
    no: "01",
    title: "第一周 | AI增强型全栈原型",
    desc: "用 AI 做出可交互原型：录入、流程、部署与验收。",
  },
  {
    no: "02",
    title: "第二周 | 企业需求诊断与AI项目实操",
    desc: "痛点梳理、价值判断、方案选型与小步验证。",
  },
  {
    no: "03",
    title: "第三周 | 组织推动与AI落地",
    desc: "场景落地、跨部门协同、变更沟通与持续运营。",
    badge: "实战演练训练营",
  },
  {
    no: "04",
    title: "第二阶段 | 3个月入职教练陪跑",
    desc: "作品集打磨、面试表达、入职后问题拆解与成果汇报。",
  },
] as const;
const OUTCOME_ITEMS = [
  { title: "1套企业部门AI系统", desc: "可见、可衡量、可管理" },
  { title: "1套老板AI经营驾驶舱", desc: "盯经营结果与效率" },
  { title: "1个专业Agent + 3个岗位Skill", desc: "提升个人竞争力" },
  { title: "代码仓库+项目文档+数字作品集", desc: "求职可展示的硬资产" },
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

function fillBg(ctx: CanvasRenderingContext2D, W: number, H: number) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#07111f");
  g.addColorStop(0.35, NAVY);
  g.addColorStop(1, "#0c1f36");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

type Variant = PosterStyleId;

type Layout = {
  heroH: number;
  pathCardH: number;
  outcomeCardH: number;
  priceBlockH: number;
  qrSize: number;
};

function layoutFor(variant: Variant): Layout {
  if (variant === "roadmap") {
    return { heroH: 520, pathCardH: 150, outcomeCardH: 150, priceBlockH: 180, qrSize: 260 };
  }
  if (variant === "outcomes") {
    return { heroH: 500, pathCardH: 118, outcomeCardH: 190, priceBlockH: 180, qrSize: 260 };
  }
  if (variant === "offer") {
    return { heroH: 480, pathCardH: 118, outcomeCardH: 150, priceBlockH: 240, qrSize: 300 };
  }
  return { heroH: 620, pathCardH: 126, outcomeCardH: 160, priceBlockH: 190, qrSize: 280 };
}

async function composeLongPoster(opts: SharePosterInput): Promise<string> {
  const variant = opts.style;
  const L = layoutFor(variant);
  const W = 1080;
  // Dynamic height: keep WeChat-friendly tall long image.
  const padX = 48;
  const contentW = W - padX * 2;
  const pathGap = 18;
  const pathBlock =
    120 + PATH_STEPS.length * (L.pathCardH + pathGap) + 90 + 100; // head + cards + loop + quote
  const outcomeBlock = 120 + 2 * (L.outcomeCardH + 16) + 24;
  const ctaBlock = L.priceBlockH + 40 + L.qrSize + 90 + 120;
  const H = Math.ceil(L.heroH + 40 + pathBlock + outcomeBlock + ctaBlock + 80);

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 不可用");

  fillBg(ctx, W, H);

  // ---- Hero ----
  const ref = await loadImage(ACADEMY_REF);
  if (ref) {
    // Stretch top portion of marketing long image into hero band.
    const srcH = Math.max(1, Math.floor(ref.height * 0.34));
    ctx.drawImage(ref, 0, 0, ref.width, srcH, 0, 0, W, L.heroH);
  } else {
    const glow = ctx.createRadialGradient(W * 0.7, 120, 40, W * 0.65, 180, 520);
    glow.addColorStop(0, "rgba(59,130,246,0.35)");
    glow.addColorStop(1, "rgba(59,130,246,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, L.heroH);
  }
  const fade = ctx.createLinearGradient(0, L.heroH * 0.35, 0, L.heroH);
  fade.addColorStop(0, "rgba(7,17,31,0.15)");
  fade.addColorStop(0.55, "rgba(7,17,31,0.72)");
  fade.addColorStop(1, NAVY);
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, W, L.heroH);

  // brand
  ctx.fillStyle = GOLD;
  ctx.fillRect(padX, 36, 6, 42);
  ctx.fillStyle = GOLD_SOFT;
  ctx.font = `700 24px ${FONT}`;
  ctx.fillText("青山在 OPC · FDE ACADEMY", padX + 18, 64);
  ctx.fillStyle = MUTED;
  ctx.font = `600 18px ${FONT}`;
  ctx.fillText(opts.audience === "org" ? "机构渠道推荐" : "学员邀请通道", padX + 18, 94);
  ctx.textAlign = "right";
  ctx.fillText(opts.issuerLabel.slice(0, 22), W - padX, 70);
  ctx.textAlign = "start";

  ctx.fillStyle = TEXT;
  ctx.font = `900 58px ${FONT}`;
  const titleEnd = wrapText(ctx, HERO_LINE, padX, 180, contentW, 70, 2);
  ctx.fillStyle = MUTED;
  ctx.font = `600 26px ${FONT}`;
  wrapText(ctx, opts.slogan || HERO_SUB, padX, titleEnd + 48, contentW, 36, 2);

  // chips
  let chipX = padX;
  let chipY = L.heroH - 90;
  for (const chip of CHIPS) {
    ctx.font = `700 20px ${FONT}`;
    const tw = ctx.measureText(chip).width + 36;
    if (chipX + tw > W - padX) {
      chipX = padX;
      chipY -= 54;
    }
    roundRect(ctx, chipX, chipY, tw, 44, 12);
    ctx.fillStyle = "rgba(10,22,40,0.88)";
    ctx.fill();
    ctx.strokeStyle = "rgba(212,175,55,0.55)";
    ctx.lineWidth = 1.5;
    roundRect(ctx, chipX, chipY, tw, 44, 12);
    ctx.stroke();
    ctx.fillStyle = GOLD_SOFT;
    ctx.fillText(chip, chipX + 18, chipY + 29);
    chipX += tw + 12;
  }

  let y = L.heroH + 48;

  // ---- Path ----
  ctx.fillStyle = TEXT;
  ctx.font = `900 44px ${FONT}`;
  ctx.fillText(PATH_HEAD, padX, y);
  y += 42;
  ctx.fillStyle = MUTED;
  ctx.font = `600 24px ${FONT}`;
  ctx.fillText(PATH_SUB, padX, y);
  y += 36;

  PATH_STEPS.forEach((step, i) => {
    const emphasize = variant === "roadmap" || i === 2;
    roundRect(ctx, padX, y, contentW, L.pathCardH, 18);
    ctx.fillStyle = emphasize ? "rgba(212,175,55,0.14)" : "rgba(15,33,56,0.92)";
    ctx.fill();
    ctx.strokeStyle = emphasize ? GOLD : "rgba(96,165,250,0.25)";
    ctx.lineWidth = emphasize ? 2.5 : 1.5;
    roundRect(ctx, padX, y, contentW, L.pathCardH, 18);
    ctx.stroke();

    ctx.fillStyle = GOLD;
    ctx.font = `900 34px ${FONT}`;
    ctx.fillText(step.no, padX + 28, y + 52);
    ctx.fillStyle = TEXT;
    ctx.font = `800 28px ${FONT}`;
    ctx.fillText(step.title, padX + 100, y + 48);
    ctx.fillStyle = MUTED;
    ctx.font = `600 22px ${FONT}`;
    wrapText(ctx, step.desc, padX + 100, y + 88, contentW - 140, 30, 2);
    if ("badge" in step && step.badge) {
      const bw = ctx.measureText(step.badge).width + 24;
      roundRect(ctx, W - padX - bw - 20, y + 18, bw, 34, 8);
      ctx.fillStyle = GOLD;
      ctx.fill();
      ctx.fillStyle = NAVY;
      ctx.font = `800 16px ${FONT}`;
      ctx.fillText(step.badge, W - padX - bw - 8, y + 41);
    }
    y += L.pathCardH + pathGap;
  });

  roundRect(ctx, padX, y, contentW, 70, 14);
  ctx.fillStyle = "rgba(59,130,246,0.16)";
  ctx.fill();
  ctx.fillStyle = GOLD_SOFT;
  ctx.font = `700 22px ${FONT}`;
  ctx.textAlign = "center";
  ctx.fillText(`任务驱动训练闭环｜${LOOP}`, W / 2, y + 44);
  ctx.textAlign = "start";
  y += 100;

  ctx.fillStyle = MUTED;
  ctx.font = `600 24px ${FONT}`;
  y = wrapText(ctx, QUOTE, padX, y, contentW, 34, 3) + 56;

  // ---- Outcomes ----
  ctx.fillStyle = TEXT;
  ctx.font = `900 44px ${FONT}`;
  ctx.fillText(OUTCOME_HEAD, padX, y);
  y += 42;
  ctx.fillStyle = MUTED;
  ctx.font = `600 24px ${FONT}`;
  ctx.fillText(OUTCOME_SUB, padX, y);
  y += 36;

  const cardW = (contentW - 16) / 2;
  OUTCOME_ITEMS.forEach((item, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = padX + col * (cardW + 16);
    const cy = y + row * (L.outcomeCardH + 16);
    const emphasize = variant === "outcomes";
    roundRect(ctx, x, cy, cardW, L.outcomeCardH, 18);
    ctx.fillStyle = emphasize ? "rgba(212,175,55,0.12)" : "rgba(15,33,56,0.92)";
    ctx.fill();
    ctx.strokeStyle = emphasize ? GOLD : "rgba(212,175,55,0.28)";
    ctx.lineWidth = emphasize ? 2.2 : 1.4;
    roundRect(ctx, x, cy, cardW, L.outcomeCardH, 18);
    ctx.stroke();
    ctx.fillStyle = GOLD;
    ctx.font = `900 28px ${FONT}`;
    ctx.fillText(String(i + 1).padStart(2, "0"), x + 22, cy + 44);
    ctx.fillStyle = TEXT;
    ctx.font = `800 24px ${FONT}`;
    wrapText(ctx, item.title, x + 22, cy + 86, cardW - 44, 30, 2);
    ctx.fillStyle = MUTED;
    ctx.font = `600 20px ${FONT}`;
    ctx.fillText(item.desc, x + 22, cy + L.outcomeCardH - 28);
  });
  y += 2 * (L.outcomeCardH + 16) + 36;

  // ---- Price + QR ----
  const priceH = L.priceBlockH;
  roundRect(ctx, padX, y, contentW, priceH, 22);
  ctx.fillStyle = variant === "offer" ? "rgba(212,175,55,0.16)" : "rgba(8,21,38,0.96)";
  ctx.fill();
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = variant === "offer" ? 3 : 2;
  roundRect(ctx, padX, y, contentW, priceH, 22);
  ctx.stroke();

  ctx.fillStyle = MUTED;
  ctx.font = `700 22px ${FONT}`;
  ctx.fillText("标准FDE学员班", padX + 36, y + 48);
  ctx.fillStyle = GOLD;
  ctx.font = variant === "offer" ? `900 96px ${FONT}` : `900 78px ${FONT}`;
  ctx.fillText(opts.priceLabel || "¥1,980", padX + 36, y + (variant === "offer" ? 140 : 125));

  // mini chips in price card
  let mx = padX + 36;
  const my = y + priceH - 42;
  for (const t of ["3周线上训练", "3个月入职教练陪跑"] as const) {
    ctx.font = `700 18px ${FONT}`;
    const tw = ctx.measureText(t).width + 28;
    roundRect(ctx, mx, my - 24, tw, 36, 10);
    ctx.fillStyle = "rgba(59,130,246,0.18)";
    ctx.fill();
    ctx.fillStyle = "#93c5fd";
    ctx.fillText(t, mx + 14, my);
    mx += tw + 12;
  }
  y += priceH + 36;

  // QR panel centered
  const qrBox = L.qrSize + 80;
  const qx = (W - qrBox) / 2;
  roundRect(ctx, qx, y, qrBox, qrBox, 22);
  ctx.fillStyle = "#fff";
  ctx.fill();
  ctx.strokeStyle = "rgba(212,175,55,0.65)";
  ctx.lineWidth = 2;
  roundRect(ctx, qx, y, qrBox, qrBox, 22);
  ctx.stroke();

  const qrPad = 28;
  const qrDraw = qrBox - qrPad * 2 - 46;
  if (opts.qrCanvas) {
    ctx.drawImage(opts.qrCanvas, qx + (qrBox - qrDraw) / 2, y + qrPad, qrDraw, qrDraw);
  } else {
    ctx.fillStyle = "#e2e8f0";
    ctx.fillRect(qx + (qrBox - qrDraw) / 2, y + qrPad, qrDraw, qrDraw);
  }
  ctx.fillStyle = NAVY;
  ctx.font = `800 24px ${FONT}`;
  ctx.textAlign = "center";
  ctx.fillText("扫码咨询课程 / 登录选购", W / 2, y + qrBox - 22);
  ctx.textAlign = "start";
  y += qrBox + 36;

  ctx.fillStyle = MUTED;
  ctx.font = `600 20px ${FONT}`;
  ctx.textAlign = "center";
  ctx.fillText("适合：大学生、应届毕业生、初级转型者、企业种子员工", W / 2, y);
  y += 36;
  ctx.fillStyle = GOLD_SOFT;
  ctx.font = `700 20px ${FONT}`;
  ctx.fillText(opts.scanHint || "青山在OPC | 企业AI人才训练与项目交付平台", W / 2, y);
  ctx.textAlign = "start";

  return canvas.toDataURL("image/png");
}

export async function composeSharePoster(opts: SharePosterInput): Promise<string> {
  return composeLongPoster(opts);
}
