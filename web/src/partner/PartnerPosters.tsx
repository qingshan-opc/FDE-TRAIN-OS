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
import { PosterStylePicker } from "../components/PosterStylePicker";
import {
  composeSharePoster,
  downloadDataUrl,
  type PosterStyleId,
} from "../lib/sharePosters";

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

export function PartnerPosters() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offerings, setOfferings] = useState<Offering[]>([]);
  const [orgName, setOrgName] = useState("");
  const [enrollUrl, setEnrollUrl] = useState<string | null>(null);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [preview, setPreview] = useState<Offering | null>(null);
  const [posterStyle, setPosterStyle] = useState<PosterStyleId>("brutal");
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
    async (item: Offering, style: PosterStyleId) => {
      if (!enrollUrl) return;
      setComposing(true);
      try {
        await new Promise((r) => setTimeout(r, 80));
        const url = await composeSharePoster({
          style,
          audience: "org",
          coverSrc: item.cover_image || "/landing/hero.png",
          title: item.course_title || item.title,
          priceLabel: `¥${yuan(item.price_fen)}`,
          issuerLabel: orgName ? `推荐机构 · ${orgName}` : "灵栖智能 · FDE 训练营",
          slogan: "成为前沿部署工程师，打通AI与业务的最后一公里",
          qrCanvas: getQrCanvas(),
          scanHint: "扫码后自动登录并进入选购",
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
      void rebuildPoster(preview, posterStyle);
    } else {
      setPosterUrl(null);
    }
  }, [preview, enrollUrl, posterStyle, rebuildPoster]);

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
        选择海报风格后预览下载。学员微信扫码后自动登录并进入选购页，支付后归属本机构。
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
        width={560}
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
                downloadDataUrl(posterUrl, `poster-${posterStyle}-${name}-${inviteCode || "code"}.png`);
              }}
            >
              下载海报 PNG
            </Button>
          </Space>
        }
      >
        <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }}>
          海报风格
        </Typography.Paragraph>
        <PosterStylePicker value={posterStyle} onChange={setPosterStyle} disabled={composing} />
        {posterUrl ? (
          <img src={posterUrl} alt="poster" style={{ width: "100%", borderRadius: 12 }} />
        ) : (
          <Typography.Text type="secondary">{composing ? "正在合成海报…" : "暂无预览"}</Typography.Text>
        )}
        <div ref={qrHostRef} style={{ position: "absolute", left: -9999, top: 0, opacity: 0 }}>
          {enrollUrl ? <QRCode value={enrollUrl} size={180} type="canvas" /> : null}
        </div>
      </Modal>
    </div>
  );
}
