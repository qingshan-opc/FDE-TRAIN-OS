import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Alert,
  Card,
  Col,
  Modal,
  QRCode,
  Row,
  Space,
  Statistic,
  Table,
  Typography,
  message,
} from "antd";
import { ApiError, authApi, referralApi, type ReferralDashboard } from "../lib/api";
import { LearnerAccountLayout } from "../components/LearnerAccountLayout";
import { Skeleton } from "../components/Skeleton";
import { ErrorState } from "../components/ErrorState";
import { PosterStylePicker } from "../components/PosterStylePicker";
import {
  composeSharePoster,
  downloadDataUrl,
  type PosterStyleId,
} from "../lib/sharePosters";
import { prefersLongPressSavePoster } from "../lib/wechat";
import { POSTER_DEFAULT_SLOGAN, SHOP_HERO } from "./shopPitch";

const TIER_HINTS = [
  { min: 0, pct: 20, label: "默认" },
  { min: 5, pct: 25, label: "邀请 5 人" },
  { min: 10, pct: 30, label: "邀请 10 人" },
];

function fenYuan(fen: unknown): string {
  return (Number(fen || 0) / 100).toFixed(2);
}

export function LearnerReferral() {
  const [data, setData] = useState<ReferralDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bindLoading, setBindLoading] = useState(false);
  const [bindQr, setBindQr] = useState<string | null>(null);
  const [bindTicket, setBindTicket] = useState<string | null>(null);
  const [posterOpen, setPosterOpen] = useState(false);
  const [posterStyle, setPosterStyle] = useState<PosterStyleId>("academy");
  const [posterUrl, setPosterUrl] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  const pollRef = useRef<number | null>(null);
  const posterQrRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const dash = await referralApi.dashboard();
      setData(dash);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  const stopPoll = useCallback(() => {
    if (pollRef.current != null) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => {
    void load();
    return () => stopPoll();
  }, [load, stopPoll]);

  const copyLink = async () => {
    if (!data?.register_url) return;
    try {
      await navigator.clipboard.writeText(data.register_url);
      message.success("邀请链接已复制");
    } catch {
      message.error("复制失败，请手动选择链接");
    }
  };

  const rebuildPersonalPoster = useCallback(async (style: PosterStyleId) => {
    setComposing(true);
    try {
      await new Promise((r) => setTimeout(r, 80));
      const qrCanvas = posterQrRef.current?.querySelector("canvas") || null;
      const url = await composeSharePoster({
        style,
        audience: "personal",
        coverSrc: "/landing/hero.png",
        title: SHOP_HERO.title,
        priceLabel: "¥1,980",
        issuerLabel: "个人邀请 · 扫码注册即记为好友邀请",
        slogan: POSTER_DEFAULT_SLOGAN,
        qrCanvas,
        scanHint: "好友扫码注册后计入你的邀请人数",
      });
      setPosterUrl(url);
    } catch (err) {
      message.error(err instanceof Error ? err.message : "海报生成失败");
    } finally {
      setComposing(false);
    }
  }, []);

  useEffect(() => {
    if (posterOpen && data?.register_url) {
      void rebuildPersonalPoster(posterStyle);
    } else if (!posterOpen) {
      setPosterUrl(null);
    }
  }, [posterOpen, posterStyle, data?.register_url, rebuildPersonalPoster]);

  const startWechatBind = async () => {
    setBindLoading(true);
    stopPoll();
    try {
      const res = await authApi.wechatBindStart();
      if (res.already_bound || res.wx_bound) {
        message.success("微信已绑定，可用于收款分账");
        setBindQr(null);
        setBindTicket(null);
        void load();
        return;
      }
      const qr = res.qr_url || res.qr_content || null;
      const ticket = res.ticket || res.state || null;
      if (!qr || !ticket) {
        message.error("无法生成绑定二维码，请稍后重试");
        return;
      }
      setBindQr(qr);
      setBindTicket(ticket);
      pollRef.current = window.setInterval(async () => {
        try {
          const st = await authApi.wechatBindStatus(ticket);
          if (st.done || st.wx_bound) {
            stopPoll();
            message.success("微信绑定成功");
            setBindQr(null);
            setBindTicket(null);
            void load();
          } else if (st.expired) {
            stopPoll();
            message.warning("二维码已过期，请重新生成");
          }
        } catch {
          /* ignore poll errors */
        }
      }, 2000);
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : "绑定失败");
    } finally {
      setBindLoading(false);
    }
  };

  return (
    <LearnerAccountLayout title="邀请分佣" subtitle="邀请好友报名，按阶梯享受佣金">
      {loading ? (
        <Skeleton rows={10} />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : !data ? null : (
        <div className="stack" style={{ gap: 16 }}>
          <Alert
            type="info"
            showIcon
            message="邀请分佣"
            description="好友通过你的专属链接注册后计入邀请人数。佣金默认 20%；满 5 人升至 25%；满 10 人升至 30%。好友付费后按当前比例分账到你绑定的微信。教研老师同样可发起个人邀请分佣。"
          />

          <Row gutter={[16, 16]}>
            <Col xs={12} md={6}>
              <Card size="small">
                <Statistic title="邀请人数" value={data.invite_count} />
              </Card>
            </Col>
            <Col xs={12} md={6}>
              <Card size="small">
                <Statistic title="当前佣金" value={data.rate_percent} suffix="%" precision={0} />
              </Card>
            </Col>
            <Col xs={12} md={6}>
              <Card size="small">
                <Statistic
                  title="下一档"
                  value={
                    data.next_tier
                      ? `再邀 ${data.next_tier.invites_needed} 人 → ${data.next_tier.rate_percent}%`
                      : "已满档 30%"
                  }
                  valueStyle={{ fontSize: 16 }}
                />
              </Card>
            </Col>
            <Col xs={12} md={6}>
              <Card size="small">
                <Statistic
                  title="累计分账"
                  prefix="¥"
                  value={fenYuan(
                    (data.profit_shares || []).reduce((s, r) => s + Number(r.share_fen || 0), 0),
                  )}
                />
              </Card>
            </Col>
          </Row>

          <Card size="small" title="佣金阶梯">
            <Space wrap size="middle">
              {TIER_HINTS.map((t) => {
                const active = data.rate_percent >= t.pct && (t.min === 0 || data.invite_count >= t.min);
                const current =
                  data.rate_percent === t.pct &&
                  (t.min === 10
                    ? data.invite_count >= 10
                    : t.min === 5
                      ? data.invite_count >= 5 && data.invite_count < 10
                      : data.invite_count < 5);
                return (
                  <Alert
                    key={t.min}
                    type={current ? "success" : active ? "info" : "warning"}
                    showIcon
                    style={{ margin: 0 }}
                    message={`${t.label} · ${t.pct}%`}
                  />
                );
              })}
            </Space>
          </Card>

          <Card size="small" title="我的邀请链接">
            <Space direction="vertical" style={{ width: "100%" }} size="middle">
              <Typography.Paragraph copyable={{ text: data.register_url }} style={{ marginBottom: 0 }}>
                {data.register_url}
              </Typography.Paragraph>
              <Typography.Text type="secondary">邀请码：{data.code}</Typography.Text>
              <Space wrap>
                <button type="button" className="app-btn app-btn--primary app-btn--sm" onClick={() => void copyLink()}>
                  复制链接
                </button>
                <button
                  type="button"
                  className="app-btn app-btn--primary app-btn--sm"
                  onClick={() => setPosterOpen(true)}
                >
                  生成分享海报
                </button>
                <button type="button" className="app-btn app-btn--ghost app-btn--sm" onClick={() => void load()}>
                  刷新
                </button>
              </Space>
              <div style={{ display: "flex", justifyContent: "center", padding: 8 }}>
                <QRCode value={data.register_url} size={180} />
              </div>
              <Typography.Paragraph type="secondary" style={{ marginBottom: 0, textAlign: "center" }}>
                好友用微信扫码或打开链接完成注册，即记为你的邀请。也可生成三套风格海报转发。
              </Typography.Paragraph>
            </Space>
          </Card>

          <Modal
            open={posterOpen}
            title="分享海报 · 个人邀请"
            onCancel={() => setPosterOpen(false)}
            width={560}
            footer={
              <Space>
                <button type="button" className="app-btn app-btn--ghost app-btn--sm" onClick={() => setPosterOpen(false)}>
                  关闭
                </button>
                {!prefersLongPressSavePoster() ? (
                  <button
                    type="button"
                    className="app-btn app-btn--primary app-btn--sm"
                    disabled={!posterUrl || composing}
                    onClick={() => {
                      if (!posterUrl || !data) return;
                      downloadDataUrl(posterUrl, `poster-${posterStyle}-personal-${data.code}.png`);
                    }}
                  >
                    {composing ? "合成中…" : "下载海报 PNG"}
                  </button>
                ) : null}
              </Space>
            }
          >
            <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }}>
              选择海报风格
            </Typography.Paragraph>
            <PosterStylePicker value={posterStyle} onChange={setPosterStyle} disabled={composing} />
            {posterUrl ? (
              <img
                src={posterUrl}
                alt="个人邀请海报，长按可保存"
                className="partner-poster-preview__img"
                style={{ width: "100%", borderRadius: 12, marginTop: 8 }}
                draggable={false}
              />
            ) : (
              <Typography.Text type="secondary">{composing ? "正在合成海报…" : "暂无预览"}</Typography.Text>
            )}
            {prefersLongPressSavePoster() && posterUrl ? (
              <Alert
                type="success"
                showIcon
                style={{ marginTop: 12 }}
                message="长按上方海报，选择「保存图片」到相册"
                description="微信内无需再点下载；保存后可转发朋友圈或发给好友。"
              />
            ) : null}
            <div ref={posterQrRef} style={{ position: "absolute", left: -9999, top: 0, opacity: 0 }}>
              {data.register_url ? <QRCode value={data.register_url} size={180} type="canvas" /> : null}
            </div>
          </Modal>

          <Card size="small" title="微信收款账号">
            <Space direction="vertical" style={{ width: "100%" }} size="middle">
              {data.receiver?.bound ? (
                <Alert
                  type="success"
                  showIcon
                  message="已绑定微信，可用于分账收款"
                  description={data.receiver.wx_mp_openid ? `OpenID ${data.receiver.wx_mp_openid}` : undefined}
                />
              ) : (
                <Alert
                  type="warning"
                  showIcon
                  message="尚未绑定微信"
                  description="未绑定前，好友付费后的分账会记为待处理。请扫码绑定微信后再收款。"
                />
              )}
              <Space wrap>
                <button
                  type="button"
                  className="app-btn app-btn--primary app-btn--sm"
                  disabled={bindLoading}
                  onClick={() => void startWechatBind()}
                >
                  {bindLoading ? "生成中…" : data.receiver?.bound ? "重新绑定微信" : "扫码绑定微信"}
                </button>
                <Link to="/app/profile" className="app-btn app-btn--ghost app-btn--sm">
                  返回个人中心
                </Link>
              </Space>
              {bindQr && (
                <div>
                  <div style={{ display: "flex", justifyContent: "center", padding: 12 }}>
                    <QRCode value={bindQr} size={200} />
                  </div>
                  <Alert type="info" showIcon message="请用手机微信扫码确认授权，成功后本页会自动刷新" />
                  {bindTicket && (
                    <Typography.Paragraph type="secondary" style={{ fontSize: 12, wordBreak: "break-all" }}>
                      绑定凭证：{bindTicket}
                    </Typography.Paragraph>
                  )}
                </div>
              )}
            </Space>
          </Card>

          <Card size="small" title="邀请明细">
            <Table
              size="small"
              rowKey="user_id"
              dataSource={data.attributions || []}
              pagination={{ pageSize: 8 }}
              locale={{ emptyText: "还没有好友通过你的链接注册" }}
              columns={[
                { title: "昵称", dataIndex: "display_name", render: (v, r) => v || r.email || "—" },
                { title: "邮箱", dataIndex: "email" },
                { title: "绑定时间", dataIndex: "bound_at" },
                { title: "付费单", dataIndex: "paid_orders" },
              ]}
            />
          </Card>

          <Card size="small" title="分账明细">
            <Table
              size="small"
              rowKey="id"
              dataSource={data.profit_shares || []}
              pagination={{ pageSize: 8 }}
              locale={{ emptyText: "暂无分账记录" }}
              columns={[
                { title: "订单号", dataIndex: "out_trade_no" },
                {
                  title: "学员",
                  render: (_, r) => String(r.buyer_name || r.buyer_email || "—"),
                },
                {
                  title: "订单金额",
                  render: (_, r) => `¥${fenYuan(r.amount_fen)}`,
                },
                {
                  title: "比例",
                  render: (_, r) => `${(Number(r.rate_bps || 0) / 100).toFixed(0)}%`,
                },
                {
                  title: "分账",
                  render: (_, r) => `¥${fenYuan(r.share_fen)}`,
                },
                { title: "状态", dataIndex: "wx_state" },
                { title: "时间", dataIndex: "created_at" },
              ]}
            />
          </Card>
        </div>
      )}
    </LearnerAccountLayout>
  );
}
