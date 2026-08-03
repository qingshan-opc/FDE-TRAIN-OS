import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  Modal,
  QRCode,
  Row,
  Space,
  Typography,
  message,
} from "antd";
import { partnerApi, ApiError } from "../lib/api";
import { Skeleton } from "../components/Skeleton";
import { ErrorState } from "../components/ErrorState";

type Offering = {
  id: string;
  title: string;
  course_title?: string | null;
  description?: string | null;
  price_fen: number;
  status: string;
  cover_image?: string | null;
  modules?: Array<{ day_index: number; title: string }>;
  module_count?: number;
};

function yuan(fen: number) {
  return (fen / 100).toFixed(fen % 100 === 0 ? 0 : 2);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`图片加载失败: ${src}`));
    img.src = src;
  });
}

function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

async function composePoster(opts: {
  coverSrc: string;
  title: string;
  priceLabel: string;
  orgName: string;
  enrollUrl: string;
  qrCanvas: HTMLCanvasElement | null;
}): Promise<string> {
  const W = 750;
  const H = 1200;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 不可用");

  // Background
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#0f172a");
  g.addColorStop(1, "#134e4a");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // Cover
  try {
    const cover = await loadImage(opts.coverSrc);
    const coverH = 520;
    const scale = Math.max(W / cover.width, coverH / cover.height);
    const dw = cover.width * scale;
    const dh = cover.height * scale;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(32, 32, W - 64, coverH, 24);
    ctx.clip();
    ctx.drawImage(cover, 32 - (dw - (W - 64)) / 2, 32 - (dh - coverH) / 2, dw, dh);
    ctx.restore();
  } catch {
    ctx.fillStyle = "#1e293b";
    ctx.beginPath();
    ctx.roundRect(32, 32, W - 64, 520, 24);
    ctx.fill();
  }

  // Title
  ctx.fillStyle = "#f8fafc";
  ctx.font = "bold 42px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
  const title = opts.title.length > 28 ? `${opts.title.slice(0, 28)}…` : opts.title;
  wrapText(ctx, title, 48, 620, W - 96, 52);

  // Price
  ctx.fillStyle = "#2dd4bf";
  ctx.font = "bold 48px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
  ctx.fillText(opts.priceLabel, 48, 760);

  // Org
  ctx.fillStyle = "#94a3b8";
  ctx.font = "28px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
  ctx.fillText(opts.orgName ? `推荐机构 · ${opts.orgName}` : "灵栖智能 · FDE 训练营", 48, 820);

  // QR panel
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.roundRect(W - 280, H - 340, 232, 280, 20);
  ctx.fill();

  const qrSize = 180;
  const qrX = W - 280 + 26;
  const qrY = H - 340 + 24;
  if (opts.qrCanvas) {
    ctx.drawImage(opts.qrCanvas, qrX, qrY, qrSize, qrSize);
  } else {
    // fallback: draw placeholder, caller should wait for QR
    ctx.fillStyle = "#e2e8f0";
    ctx.fillRect(qrX, qrY, qrSize, qrSize);
  }

  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 22px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("微信扫码报名", W - 164, H - 100);
  ctx.textAlign = "start";

  ctx.fillStyle = "#64748b";
  ctx.font = "22px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
  ctx.fillText("扫码后自动登录并进入选购", 48, H - 80);

  return canvas.toDataURL("image/png");
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
) {
  let line = "";
  let yy = y;
  for (const ch of text) {
    const test = line + ch;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, yy);
      line = ch;
      yy += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, yy);
}

export function PartnerPosters() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offerings, setOfferings] = useState<Offering[]>([]);
  const [orgName, setOrgName] = useState("");
  const [enrollUrl, setEnrollUrl] = useState<string | null>(null);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [preview, setPreview] = useState<Offering | null>(null);
  const [posterUrl, setPosterUrl] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  const qrHostRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [off, inv] = await Promise.all([partnerApi.offerings(), partnerApi.invites()]);
      setOfferings(off.items || []);
      setOrgName(String(off.org?.name || inv.org?.name || ""));
      const primary = inv.primary;
      if (primary?.enroll_url && primary.status === "active") {
        setEnrollUrl(primary.enroll_url);
        setInviteCode(primary.code);
      } else {
        setEnrollUrl(null);
        setInviteCode(null);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const getQrCanvas = useCallback((): HTMLCanvasElement | null => {
    const host = qrHostRef.current;
    if (!host) return null;
    return host.querySelector("canvas");
  }, []);

  const rebuildPoster = useCallback(
    async (item: Offering) => {
      if (!enrollUrl) return;
      setComposing(true);
      try {
        // wait a tick for QR canvas paint
        await new Promise((r) => setTimeout(r, 80));
        const url = await composePoster({
          coverSrc: item.cover_image || "/landing/hero.png",
          title: item.course_title || item.title,
          priceLabel: `¥${yuan(item.price_fen)}`,
          orgName,
          enrollUrl,
          qrCanvas: getQrCanvas(),
        });
        setPosterUrl(url);
      } catch (err) {
        message.error(err instanceof Error ? err.message : "海报生成失败");
      } finally {
        setComposing(false);
      }
    },
    [enrollUrl, getQrCanvas, orgName],
  );

  useEffect(() => {
    if (preview && enrollUrl) {
      void rebuildPoster(preview);
    } else {
      setPosterUrl(null);
    }
  }, [preview, enrollUrl, rebuildPoster]);

  const hasInvite = Boolean(enrollUrl && inviteCode);

  const primaryHint = useMemo(() => {
    if (hasInvite) return `当前邀请码：${inviteCode}`;
    return "尚未配置邀请码，请联系平台运营在渠道设置中创建后再生成海报。";
  }, [hasInvite, inviteCode]);

  if (loading) return <Skeleton rows={6} />;
  if (error) return <ErrorState message={error} onRetry={() => void load()} />;

  return (
    <div>
      <Typography.Title level={3} style={{ marginTop: 0 }}>
        课程海报
      </Typography.Title>
      <Typography.Paragraph type="secondary">
        下载带机构邀请二维码的课程海报。学员微信扫码后自动登录并进入选购页，支付后归属本机构。
      </Typography.Paragraph>

      {!hasInvite ? (
        <Alert type="warning" showIcon style={{ marginBottom: 16 }} message={primaryHint} />
      ) : (
        <Alert type="info" showIcon style={{ marginBottom: 16 }} message={primaryHint} />
      )}

      {offerings.length === 0 ? (
        <Empty description="暂无可售课程" />
      ) : (
        <Row gutter={[16, 16]}>
          {offerings.map((item) => (
            <Col xs={24} sm={12} key={item.id}>
              <Card
                cover={
                  <img
                    alt={item.title}
                    src={item.cover_image || "/landing/hero.png"}
                    style={{ height: 160, objectFit: "cover" }}
                  />
                }
                actions={[
                  <Button
                    key="preview"
                    type="link"
                    disabled={!hasInvite}
                    onClick={() => setPreview(item)}
                  >
                    预览海报
                  </Button>,
                  <Button
                    key="copy"
                    type="link"
                    disabled={!hasInvite}
                    onClick={async () => {
                      if (!enrollUrl) return;
                      try {
                        await navigator.clipboard.writeText(enrollUrl);
                        message.success("报名链接已复制");
                      } catch {
                        message.error("复制失败，请手动复制");
                      }
                    }}
                  >
                    复制链接
                  </Button>,
                ]}
              >
                <Card.Meta
                  title={item.course_title || item.title}
                  description={
                    <Space direction="vertical" size={4}>
                      <Typography.Text strong style={{ color: "#0f766e", fontSize: 18 }}>
                        ¥{yuan(item.price_fen)}
                      </Typography.Text>
                      <Typography.Paragraph ellipsis={{ rows: 2 }} type="secondary" style={{ marginBottom: 0 }}>
                        {item.description || "扫码报名 · 微信内一键登录选购"}
                      </Typography.Paragraph>
                    </Space>
                  }
                />
              </Card>
            </Col>
          ))}
        </Row>
      )}

      <Modal
        open={Boolean(preview)}
        title={preview ? `海报预览 · ${preview.course_title || preview.title}` : "海报预览"}
        onCancel={() => setPreview(null)}
        width={520}
        footer={
          <Space>
            <Button onClick={() => setPreview(null)}>关闭</Button>
            <Button
              disabled={!posterUrl || !enrollUrl}
              onClick={() => {
                const canvas = getQrCanvas();
                if (!canvas) {
                  message.error("二维码尚未就绪");
                  return;
                }
                downloadDataUrl(canvas.toDataURL("image/png"), `invite-qr-${inviteCode || "code"}.png`);
              }}
            >
              下载二维码
            </Button>
            <Button
              type="primary"
              loading={composing}
              disabled={!posterUrl}
              onClick={() => {
                if (!posterUrl || !preview) return;
                const name = (preview.course_title || preview.title || "course").replace(/\s+/g, "-");
                downloadDataUrl(posterUrl, `poster-${name}-${inviteCode || "code"}.png`);
              }}
            >
              下载海报 PNG
            </Button>
          </Space>
        }
      >
        {posterUrl ? (
          <img src={posterUrl} alt="poster" style={{ width: "100%", borderRadius: 12 }} />
        ) : (
          <Typography.Text type="secondary">{composing ? "正在合成海报…" : "暂无预览"}</Typography.Text>
        )}
        {/* Hidden QR used as source for canvas compose / download */}
        <div ref={qrHostRef} style={{ position: "absolute", left: -9999, top: 0, opacity: 0 }}>
          {enrollUrl ? <QRCode value={enrollUrl} size={180} type="canvas" /> : null}
        </div>
      </Modal>
    </div>
  );
}
