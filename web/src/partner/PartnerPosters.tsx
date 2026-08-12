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
import { POSTER_DEFAULT_SLOGAN, SHOP_HERO } from "../app/shopPitch";

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

function isMobileViewport() {
  return typeof window !== "undefined" && window.matchMedia("(max-width: 720px)").matches;
}

export function PartnerPosters() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offerings, setOfferings] = useState<Offering[]>([]);
  const [orgName, setOrgName] = useState("");
  const [enrollUrl, setEnrollUrl] = useState<string | null>(null);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [preview, setPreview] = useState<Offering | null>(null);
  const [posterStyle, setPosterStyle] = useState<PosterStyleId>("ink");
  const [posterUrl, setPosterUrl] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  const [mobileUi, setMobileUi] = useState(false);
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

  useEffect(() => {
    const sync = () => setMobileUi(isMobileViewport());
    sync();
    window.addEventListener("resize", sync);
    return () => window.removeEventListener("resize", sync);
  }, []);

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
          title: item.course_title || item.title || SHOP_HERO.title,
          priceLabel: `¥${yuan(item.price_fen)}`,
          issuerLabel: orgName ? `推荐机构 · ${orgName}` : "青山在 · 机构渠道",
          slogan: POSTER_DEFAULT_SLOGAN,
          qrCanvas: getQrCanvas(),
          scanHint: "微信扫码登录并选购",
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

  const copyEnrollLink = async () => {
    if (!enrollUrl) return;
    try {
      await navigator.clipboard.writeText(enrollUrl);
      message.success("报名链接已复制");
    } catch {
      message.error("复制失败，请手动复制");
    }
  };

  const savePoster = () => {
    if (!posterUrl || !preview) return;
    const name = (preview.course_title || preview.title || "course").replace(/\s+/g, "-");
    downloadDataUrl(posterUrl, `poster-${posterStyle}-${name}-${inviteCode || "code"}.png`);
    message.success(mobileUi ? "已开始保存，可转发到朋友圈" : "海报已下载");
  };

  if (loading) return <Skeleton rows={6} />;
  if (error) return <ErrorState message={error} onRetry={() => void load()} />;

  return (
    <div className="partner-posters">
      <Typography.Title level={3} style={{ marginTop: 0 }}>
        课程海报
      </Typography.Title>
      <Typography.Paragraph type="secondary">
        学员微信扫码自动登录并进入选购；支付计入本机构。默认青绿编辑风，与官网同母题。
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
                className="partner-poster-card"
                cover={
                  <div
                    className="partner-poster-card__cover"
                    style={{
                      backgroundImage: `linear-gradient(160deg, rgba(15,46,42,0.72), rgba(13,148,136,0.55)), url(${
                        item.cover_image || "/landing/hero.png"
                      })`,
                    }}
                  >
                    <div className="partner-poster-card__cover-meta">
                      <span>企业 AI 实战</span>
                      <strong>¥{yuan(item.price_fen)}</strong>
                    </div>
                  </div>
                }
                actions={[
                  <Button
                    key="preview"
                    type="link"
                    disabled={!hasInvite}
                    onClick={() => {
                      setPosterStyle("ink");
                      setPreview(item);
                    }}
                  >
                    生成海报
                  </Button>,
                  <Button key="copy" type="link" disabled={!hasInvite} onClick={() => void copyEnrollLink()}>
                    复制链接
                  </Button>,
                ]}
              >
                <Card.Meta
                  title={item.course_title || item.title || SHOP_HERO.title}
                  description={
                    <Space direction="vertical" size={4}>
                      <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                        {POSTER_DEFAULT_SLOGAN}
                      </Typography.Text>
                      <Typography.Paragraph
                        ellipsis={{ rows: 2 }}
                        type="secondary"
                        style={{ marginBottom: 0 }}
                      >
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
        title={null}
        onCancel={() => setPreview(null)}
        width={mobileUi ? "100%" : 560}
        style={mobileUi ? { top: 0, margin: 0, maxWidth: "100%", padding: 0 } : undefined}
        styles={{
          body: mobileUi
            ? { padding: "12px 16px calc(16px + env(safe-area-inset-bottom, 0px))", maxHeight: "100dvh", overflow: "auto" }
            : undefined,
          content: mobileUi ? { borderRadius: 0, minHeight: "100dvh" } : undefined,
        }}
        footer={null}
        destroyOnClose
        className={mobileUi ? "partner-poster-modal partner-poster-modal--mobile" : "partner-poster-modal"}
      >
        <div className="partner-poster-preview">
          <div className="partner-poster-preview__head">
            <div>
              <Typography.Title level={4} style={{ margin: 0 }}>
                {preview ? preview.course_title || preview.title : "海报预览"}
              </Typography.Title>
              <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                学员微信扫码自动登录并进入选购；支付计入本机构
              </Typography.Text>
            </div>
            {!mobileUi ? (
              <Button type="text" onClick={() => setPreview(null)}>
                关闭
              </Button>
            ) : null}
          </div>

          <Typography.Paragraph type="secondary" style={{ marginBottom: 8, marginTop: 16 }}>
            海报风格
          </Typography.Paragraph>
          <PosterStylePicker value={posterStyle} onChange={setPosterStyle} disabled={composing} />

          <div className="partner-poster-preview__canvas">
            {posterUrl ? (
              <img src={posterUrl} alt="poster" />
            ) : (
              <Typography.Text type="secondary">{composing ? "正在合成海报…" : "暂无预览"}</Typography.Text>
            )}
          </div>

          <div className="partner-poster-preview__actions">
            {mobileUi ? (
              <Button block onClick={() => setPreview(null)}>
                关闭
              </Button>
            ) : null}
            <Button block disabled={!enrollUrl} onClick={() => void copyEnrollLink()}>
              复制链接
            </Button>
            <Button
              block
              type="primary"
              loading={composing}
              disabled={!posterUrl}
              onClick={savePoster}
            >
              {mobileUi ? "保存图片" : "下载海报 PNG"}
            </Button>
          </div>
        </div>

        <div ref={qrHostRef} style={{ position: "absolute", left: -9999, top: 0, opacity: 0 }}>
          {enrollUrl ? <QRCode value={enrollUrl} size={180} type="canvas" /> : null}
        </div>
      </Modal>
    </div>
  );
}
