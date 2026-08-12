/** 分享海报：ink / 新粗野 / Y2K / 高转化 Canvas 合成 —— 卖课文案版，无封面图 */

export type PosterStyleId = "ink" | "brutal" | "y2k" | "conversion";

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
    id: "ink",
    name: "青绿编辑",
    blurb: "墨绿纸白 · 细金线 · 与官网同母题",
    swatch: ["#0f2e2a", "#0d9488", "#f5f0e8"],
  },
  {
    id: "brutal",
    name: "新粗野",
    blurb: "奶油底 · 大黑边 · 硬阴影贴纸感",
    swatch: ["#fff8e7", "#ffde59", "#ff90e8"],
  },
  {
    id: "y2k",
    name: "Y2K 复古",
    blurb: "霓虹深空 · 闪亮土酷 · Win98 面板",
    swatch: ["#2d2a4a", "#ff71ce", "#01cdfe"],
  },
  {
    id: "conversion",
    name: "高转化",
    blurb: "纸感直销 · 转化红 · 荧光笔重点",
    swatch: ["#fdfcf9", "#ff4d2e", "#ffe14d"],
  },
];

const FONT =
  '"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans SC",-apple-system,sans-serif';
const FONT_MONO = '"Courier New",ui-monospace,Menlo,monospace';

/** Keep in sync with web/src/app/shopPitch.ts POSTER_* */
const SELL_POINTS = ["21 天结构化训练", "产品 · Agent · 沟通递进", "结业可核验"] as const;
const DEFAULT_SLOGAN = "从系统构建到组织落地。";

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

function drawQrPanel(
  ctx: CanvasRenderingContext2D,
  qr: HTMLCanvasElement | null,
  box: { x: number; y: number; w: number; h: number; r: number },
  fill: string,
  label: string,
  labelColor: string,
  border?: { color: string; width: number },
  shadow?: { dx: number; dy: number; color: string },
) {
  if (shadow) {
    ctx.fillStyle = shadow.color;
    roundRect(ctx, box.x + shadow.dx, box.y + shadow.dy, box.w, box.h, box.r);
    ctx.fill();
  }
  ctx.fillStyle = fill;
  roundRect(ctx, box.x, box.y, box.w, box.h, box.r);
  ctx.fill();
  if (border) {
    ctx.strokeStyle = border.color;
    ctx.lineWidth = border.width;
    roundRect(ctx, box.x, box.y, box.w, box.h, box.r);
    ctx.stroke();
  }
  const qrSize = Math.min(180, box.w - 40);
  const qrX = box.x + (box.w - qrSize) / 2;
  const qrY = box.y + 22;
  if (qr) {
    ctx.drawImage(qr, qrX, qrY, qrSize, qrSize);
  } else {
    ctx.fillStyle = "#e2e8f0";
    ctx.fillRect(qrX, qrY, qrSize, qrSize);
  }
  ctx.fillStyle = labelColor;
  ctx.font = `bold 22px ${FONT}`;
  ctx.textAlign = "center";
  ctx.fillText(label, box.x + box.w / 2, box.y + box.h - 28);
  ctx.textAlign = "start";
}

function composeInk(opts: SharePosterInput): string {
  const W = 750;
  const H = 1200;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 不可用");

  // paper + ink wash
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#f7f4ee");
  bg.addColorStop(0.55, "#eef7f5");
  bg.addColorStop(1, "#e7f0ee");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // soft teal wash
  const wash = ctx.createRadialGradient(W * 0.15, 80, 20, W * 0.2, 120, 420);
  wash.addColorStop(0, "rgba(13,148,136,0.22)");
  wash.addColorStop(1, "rgba(13,148,136,0)");
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, W, H);

  // top brand bar
  ctx.fillStyle = "#0f2e2a";
  ctx.fillRect(0, 0, W, 88);
  ctx.fillStyle = "#c9a227";
  ctx.fillRect(0, 88, W, 3);

  ctx.fillStyle = "#f8fafc";
  ctx.font = `700 22px ${FONT}`;
  ctx.fillText("青山在 · 学习平台", 40, 54);
  ctx.font = `600 16px ${FONT}`;
  ctx.fillStyle = "rgba(248,250,252,0.78)";
  ctx.fillText(opts.audience === "org" ? "机构渠道" : "学员邀请", W - 160, 54);

  // channel chip
  roundRect(ctx, 40, 118, opts.audience === "org" ? 148 : 148, 36, 18);
  ctx.fillStyle = "rgba(13,148,136,0.12)";
  ctx.fill();
  ctx.strokeStyle = "rgba(13,148,136,0.35)";
  ctx.lineWidth = 1.5;
  roundRect(ctx, 40, 118, 148, 36, 18);
  ctx.stroke();
  ctx.fillStyle = "#0f766e";
  ctx.font = `700 16px ${FONT}`;
  ctx.fillText(opts.audience === "org" ? "机构推荐" : "好友邀请", 62, 142);

  // title
  ctx.fillStyle = "#0f2e2a";
  ctx.font = `900 52px ${FONT}`;
  const titleEnd = wrapText(ctx, opts.title, 40, 220, W - 80, 62, 3);

  // gold accent line
  ctx.fillStyle = "#c9a227";
  ctx.fillRect(40, titleEnd + 28, 64, 3);

  ctx.fillStyle = "#134e4a";
  ctx.font = `600 26px ${FONT}`;
  wrapText(ctx, opts.slogan || DEFAULT_SLOGAN, 40, titleEnd + 68, W - 80, 36, 2);

  // three week tags
  const tags = ["系统构建", "Agent 大脑", "组织落地"];
  const tagW = 200;
  const tagGap = 16;
  const tagStart = (W - (tagW * 3 + tagGap * 2)) / 2;
  tags.forEach((t, i) => {
    const x = tagStart + i * (tagW + tagGap);
    const y = 470;
    roundRect(ctx, x, y, tagW, 72, 14);
    ctx.fillStyle = i === 1 ? "#0d9488" : "#fff";
    ctx.fill();
    ctx.strokeStyle = i === 1 ? "#0d9488" : "rgba(15,46,42,0.14)";
    ctx.lineWidth = 1.5;
    roundRect(ctx, x, y, tagW, 72, 14);
    ctx.stroke();
    ctx.fillStyle = i === 1 ? "#fff" : "#0f2e2a";
    ctx.font = `800 22px ${FONT}`;
    ctx.textAlign = "center";
    ctx.fillText(t, x + tagW / 2, y + 44);
    ctx.textAlign = "start";
  });

  // price block
  roundRect(ctx, 40, 580, W - 80, 130, 18);
  ctx.fillStyle = "#0f2e2a";
  ctx.fill();
  ctx.fillStyle = "#c9a227";
  ctx.fillRect(40, 580, 6, 130);
  ctx.fillStyle = "#f8fafc";
  ctx.font = `900 56px ${FONT}`;
  ctx.fillText(opts.priceLabel, 64, 655);
  ctx.fillStyle = "rgba(248,250,252,0.75)";
  ctx.font = `600 20px ${FONT}`;
  ctx.fillText("21 天 · 可核验证书 · 支付后立即开通", 64, 690);

  // sell points
  let py = 750;
  for (const p of SELL_POINTS) {
    ctx.fillStyle = "#0d9488";
    ctx.beginPath();
    ctx.arc(56, py - 6, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#134e4a";
    ctx.font = `700 24px ${FONT}`;
    ctx.fillText(p, 80, py);
    py += 44;
  }

  ctx.fillStyle = "#0f2e2a";
  ctx.font = `700 22px ${FONT}`;
  ctx.fillText(opts.issuerLabel, 40, 920);

  drawQrPanel(
    ctx,
    opts.qrCanvas,
    { x: W - 286, y: H - 340, w: 250, h: 290, r: 16 },
    "#fff",
    "微信扫码选购",
    "#0f766e",
    { color: "rgba(15,46,42,0.12)", width: 2 },
    { dx: 0, dy: 10, color: "rgba(15,46,42,0.1)" },
  );

  ctx.fillStyle = "#64748b";
  ctx.font = `600 18px ${FONT}`;
  ctx.fillText(opts.scanHint || "微信扫码登录并选购", 40, H - 40);

  return canvas.toDataURL("image/png");
}

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
  ctx.fillRect(0, 0, W, 22);
  ctx.fillStyle = "#ff90e8";
  ctx.fillRect(0, H - 22, W, 22);

  // brand plate
  ctx.fillStyle = "#fff";
  ctx.strokeStyle = "#000";
  ctx.lineWidth = 4;
  ctx.fillRect(36, 48, W - 72, 86);
  ctx.strokeRect(36, 48, W - 72, 86);
  ctx.fillStyle = "#000";
  ctx.fillRect(44, 142, W - 72, 8);
  ctx.fillRect(36 + (W - 72), 56, 8, 86);
  ctx.font = `900 28px ${FONT}`;
  ctx.fillText("青山在 · FDE 训练营", 56, 104);

  // audience badge
  ctx.fillStyle = "#90b5ff";
  ctx.fillRect(36, 168, 168, 44);
  ctx.strokeRect(36, 168, 168, 44);
  ctx.fillStyle = "#000";
  ctx.font = `900 20px ${FONT}`;
  ctx.fillText(opts.audience === "org" ? "机构推荐" : "个人邀请", 52, 198);

  // hero title card
  ctx.fillStyle = "#ffde59";
  ctx.fillRect(36, 236, W - 72, 220);
  ctx.strokeRect(36, 236, W - 72, 220);
  ctx.fillStyle = "#000";
  ctx.fillRect(44, 464, W - 72, 8);
  ctx.fillRect(36 + (W - 72), 244, 8, 220);
  ctx.font = `900 48px ${FONT}`;
  wrapText(ctx, opts.title, 56, 310, W - 120, 58, 2);

  // slogan
  ctx.fillStyle = "#fff";
  ctx.fillRect(36, 490, W - 72, 78);
  ctx.strokeRect(36, 490, W - 72, 78);
  ctx.fillStyle = "#000";
  ctx.font = `800 24px ${FONT}`;
  wrapText(ctx, opts.slogan || DEFAULT_SLOGAN, 52, 540, W - 110, 32, 2);

  // sell points
  let py = 610;
  for (const p of SELL_POINTS) {
    ctx.fillStyle = "#ff90e8";
    ctx.fillRect(36, py, 28, 28);
    ctx.strokeRect(36, py, 28, 28);
    ctx.fillStyle = "#000";
    ctx.font = `800 24px ${FONT}`;
    ctx.fillText(p, 80, py + 22);
    py += 48;
  }

  // price sticker
  ctx.save();
  ctx.translate(56, 780);
  ctx.rotate((-3 * Math.PI) / 180);
  ctx.fillStyle = "#23a094";
  ctx.fillRect(0, 0, 240, 78);
  ctx.strokeStyle = "#000";
  ctx.lineWidth = 3;
  ctx.strokeRect(0, 0, 240, 78);
  ctx.fillStyle = "#fff";
  ctx.font = `900 42px ${FONT}`;
  ctx.fillText(opts.priceLabel, 18, 54);
  ctx.restore();

  ctx.fillStyle = "#000";
  ctx.font = `800 24px ${FONT}`;
  ctx.fillText(opts.issuerLabel, 56, 900);

  drawQrPanel(
    ctx,
    opts.qrCanvas,
    { x: W - 286, y: H - 360, w: 250, h: 300, r: 0 },
    "#fff",
    "微信扫码报名",
    "#000",
    { color: "#000", width: 4 },
    { dx: 8, dy: 8, color: "#000" },
  );

  ctx.fillStyle = "#000";
  ctx.font = `700 20px ${FONT}`;
  ctx.fillText(opts.scanHint || "扫码后自动登录并进入选购", 56, H - 48);

  return canvas.toDataURL("image/png");
}

function composeY2k(opts: SharePosterInput): string {
  const W = 750;
  const H = 1200;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 不可用");

  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, "#2d2a4a");
  g.addColorStop(0.5, "#1d1b33");
  g.addColorStop(1, "#14122a");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  for (let i = 0; i < 70; i++) {
    const x = (i * 97) % W;
    const y = (i * 53) % H;
    ctx.fillStyle = i % 3 === 0 ? "#ff71ce" : i % 3 === 1 ? "#01cdfe" : "#05ffa1";
    ctx.globalAlpha = 0.2 + (i % 5) * 0.08;
    ctx.beginPath();
    ctx.arc(x, y, 1.2 + (i % 3), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // brand window
  ctx.fillStyle = "#c3c7cb";
  roundRect(ctx, 36, 40, W - 72, 88, 4);
  ctx.fill();
  const bar = ctx.createLinearGradient(36, 40, W - 36, 40);
  bar.addColorStop(0, "#b967ff");
  bar.addColorStop(1, "#01cdfe");
  ctx.fillStyle = bar;
  ctx.fillRect(39, 43, W - 78, 30);
  ctx.fillStyle = "#fff";
  ctx.font = `bold 16px ${FONT}`;
  ctx.fillText("青山在_FDE_CAMP.exe", 52, 64);
  ctx.fillStyle = "#111";
  ctx.font = `800 26px ${FONT}`;
  ctx.fillText(opts.audience === "org" ? "机构推荐通道" : "个人邀请通道", 52, 108);

  ctx.fillStyle = "rgba(255,113,206,0.16)";
  roundRect(ctx, 36, 150, 210, 40, 8);
  ctx.fill();
  ctx.strokeStyle = "#ff71ce";
  ctx.lineWidth = 2;
  roundRect(ctx, 36, 150, 210, 40, 8);
  ctx.stroke();
  ctx.fillStyle = "#ff71ce";
  ctx.font = `bold 18px ${FONT_MONO}`;
  ctx.fillText(opts.audience === "org" ? "ORG INVITE" : "PERSONAL INVITE", 52, 176);

  ctx.font = `900 48px ${FONT}`;
  const titleGrad = ctx.createLinearGradient(48, 220, 48, 360);
  titleGrad.addColorStop(0, "#fff");
  titleGrad.addColorStop(0.55, "#01cdfe");
  titleGrad.addColorStop(1, "#ff71ce");
  ctx.fillStyle = titleGrad;
  ctx.shadowColor = "rgba(1,205,254,0.45)";
  ctx.shadowBlur = 14;
  const titleEnd = wrapText(ctx, opts.title, 48, 250, W - 96, 58, 2);
  ctx.shadowBlur = 0;

  ctx.fillStyle = "#05ffa1";
  ctx.font = `800 26px ${FONT}`;
  wrapText(ctx, opts.slogan || DEFAULT_SLOGAN, 48, titleEnd + 56, W - 96, 34, 2);

  ctx.fillStyle = "#ff71ce";
  ctx.font = `900 56px ${FONT}`;
  ctx.fillText(opts.priceLabel, 48, 520);

  let py = 580;
  for (const p of SELL_POINTS) {
    ctx.fillStyle = "#01cdfe";
    ctx.font = `900 22px ${FONT_MONO}`;
    ctx.fillText(">>", 48, py);
    ctx.fillStyle = "#eef";
    ctx.font = `700 24px ${FONT}`;
    ctx.fillText(p, 96, py);
    py += 48;
  }

  ctx.fillStyle = "#b967ff";
  ctx.font = `700 24px ${FONT}`;
  ctx.fillText(opts.issuerLabel, 48, 760);

  const qx = W - 286;
  const qy = H - 360;
  ctx.fillStyle = "#c3c7cb";
  roundRect(ctx, qx, qy, 250, 300, 4);
  ctx.fill();
  const bar2 = ctx.createLinearGradient(qx, qy, qx + 250, qy);
  bar2.addColorStop(0, "#b967ff");
  bar2.addColorStop(1, "#01cdfe");
  ctx.fillStyle = bar2;
  ctx.fillRect(qx + 3, qy + 3, 244, 28);
  ctx.fillStyle = "#fff";
  ctx.font = `bold 14px ${FONT}`;
  ctx.fillText("扫码报名.exe", qx + 12, qy + 23);
  ctx.fillStyle = "#fff";
  ctx.fillRect(qx + 20, qy + 48, 210, 210);
  if (opts.qrCanvas) {
    ctx.drawImage(opts.qrCanvas, qx + 35, qy + 63, 180, 180);
  }
  ctx.fillStyle = "#111";
  ctx.font = `bold 18px ${FONT}`;
  ctx.textAlign = "center";
  ctx.fillText("微信扫码报名", qx + 125, qy + 282);
  ctx.textAlign = "start";

  ctx.fillStyle = "#01cdfe";
  ctx.font = `700 18px ${FONT_MONO}`;
  ctx.fillText(opts.scanHint || ">> scan to enroll <<", 48, H - 48);

  return canvas.toDataURL("image/png");
}

function composeConversion(opts: SharePosterInput): string {
  const W = 750;
  const H = 1200;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 不可用");

  ctx.fillStyle = "#fdfcf9";
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = "#1a1a1a";
  ctx.fillRect(0, 0, W, 56);
  ctx.fillStyle = "#ff4d2e";
  roundRect(ctx, 20, 14, 72, 28, 4);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.font = `800 16px ${FONT}`;
  ctx.fillText("卖课", 36, 34);
  ctx.font = `600 18px ${FONT}`;
  ctx.fillText(
    opts.audience === "org" ? "机构专属报名通道 · 扫码即学" : "好友专属邀请 · 扫码注册报名",
    106,
    36,
  );

  // course brand strip
  ctx.fillStyle = "#f6f2ea";
  ctx.fillRect(0, 56, W, 120);
  ctx.fillStyle = "#1a1a1a";
  ctx.font = `800 22px ${FONT}`;
  ctx.fillText("青山在 · FDE 训练营", 40, 110);
  ctx.fillStyle = "#ff4d2e";
  ctx.font = `700 18px ${FONT}`;
  ctx.fillText(opts.audience === "org" ? "机构推荐" : "个人邀请", 40, 148);

  ctx.fillStyle = "#ff4d2e";
  ctx.fillRect(40, 210, 8, 130);

  ctx.fillStyle = "#1a1a1a";
  ctx.font = `900 48px ${FONT}`;
  const titleEnd = wrapText(ctx, opts.title, 64, 255, W - 120, 58, 2);

  const slogan = opts.slogan || DEFAULT_SLOGAN;
  ctx.font = `800 26px ${FONT}`;
  const sw = Math.min(ctx.measureText(slogan).width + 28, W - 100);
  const sy = titleEnd + 40;
  ctx.fillStyle = "#ffe14d";
  ctx.fillRect(64, sy, sw, 40);
  ctx.fillStyle = "#1a1a1a";
  ctx.fillText(slogan, 78, sy + 28);

  ctx.fillStyle = "#ff4d2e";
  ctx.font = `900 64px ${FONT}`;
  ctx.fillText(opts.priceLabel, 64, sy + 120);
  ctx.fillStyle = "#6b675e";
  ctx.font = `600 22px ${FONT}`;
  ctx.fillText("训练营早鸟价 · 可核验结业证书", 64, sy + 164);

  let py = sy + 220;
  for (const p of SELL_POINTS) {
    ctx.fillStyle = "#e7f2ec";
    roundRect(ctx, 64, py - 26, W - 360, 44, 10);
    ctx.fill();
    ctx.fillStyle = "#1d5c3f";
    ctx.font = `700 22px ${FONT}`;
    ctx.fillText(`✓  ${p}`, 84, py);
    py += 58;
  }

  ctx.fillStyle = "#1d5c3f";
  ctx.font = `700 24px ${FONT}`;
  ctx.fillText(opts.issuerLabel, 64, py + 20);

  ctx.fillStyle = "#e7f2ec";
  roundRect(ctx, 64, py + 50, 340, 52, 10);
  ctx.fill();
  ctx.fillStyle = "#1d5c3f";
  ctx.font = `700 20px ${FONT}`;
  ctx.fillText("✓ 扫码后进入选购 / 注册", 84, py + 84);

  drawQrPanel(
    ctx,
    opts.qrCanvas,
    { x: W - 286, y: H - 340, w: 250, h: 290, r: 14 },
    "#fff",
    "立即扫码报名",
    "#ff4d2e",
    { color: "#e8e2d5", width: 2 },
    { dx: 0, dy: 8, color: "rgba(26,26,26,0.08)" },
  );

  ctx.fillStyle = "#6b675e";
  ctx.font = `600 18px ${FONT}`;
  ctx.fillText(opts.scanHint || "微信扫码 · 一键报名开营", 52, H - 40);

  return canvas.toDataURL("image/png");
}

export async function composeSharePoster(opts: SharePosterInput): Promise<string> {
  if (opts.style === "ink") return composeInk(opts);
  if (opts.style === "brutal") return composeBrutal(opts);
  if (opts.style === "y2k") return composeY2k(opts);
  return composeConversion(opts);
}
