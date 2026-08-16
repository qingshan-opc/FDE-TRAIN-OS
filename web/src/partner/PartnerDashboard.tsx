import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  Grid,
  Modal,
  QRCode,
  Row,
  Space,
  Statistic,
  Table,
  Typography,
  message,
} from "antd";
import { partnerApi, ApiError, type PartnerReceiverStatus } from "../lib/api";
import { profitShareStateLabel, SHARE_HOLD_COPY } from "../lib/billingLabels";
import { Skeleton } from "../components/Skeleton";
import { ErrorState } from "../components/ErrorState";
import { fenYuan, formatPartnerTime, partnerIdentity, shortenId } from "./format";

const { useBreakpoint } = Grid;

export function PartnerDashboard() {
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const [search, setSearch] = useSearchParams();
  const [data, setData] = useState<{
    org: Record<string, unknown>;
    stats: Record<string, unknown>;
    receiver?: PartnerReceiverStatus;
  } | null>(null);
  const [attributions, setAttributions] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bindOpen, setBindOpen] = useState(false);
  const [bindUrl, setBindUrl] = useState<string | null>(null);
  const [bindState, setBindState] = useState<string | null>(null);
  const [bindLoading, setBindLoading] = useState(false);
  const [bindWaiting, setBindWaiting] = useState(false);
  const pollRef = useRef<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [dash, attr] = await Promise.all([partnerApi.dashboard(), partnerApi.attributions()]);
      setData({ org: dash.org, stats: dash.stats, receiver: dash.receiver });
      setAttributions(attr.items || []);
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
    setBindWaiting(false);
  }, []);

  const openBind = useCallback(async () => {
    setBindLoading(true);
    setBindUrl(null);
    setBindState(null);
    stopPoll();
    try {
      const res = await partnerApi.wechatBindUrl();
      setBindUrl(res.authorize_url);
      setBindState(res.state);
      setBindOpen(true);
      setBindWaiting(true);
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : "无法生成绑定二维码");
    } finally {
      setBindLoading(false);
    }
  }, [stopPoll]);

  useEffect(() => {
    void load();
  }, [load]);

  // PC polls while QR modal is open — phone completes OAuth independently
  useEffect(() => {
    if (!bindOpen || !bindState || !bindWaiting) {
      stopPoll();
      return;
    }
    const tick = async () => {
      try {
        const st = await partnerApi.wechatBindStatus(bindState);
        if (st.done) {
          stopPoll();
          setData((prev) => (prev ? { ...prev, receiver: st.receiver } : prev));
          message.success("微信收款账号绑定成功");
          setBindOpen(false);
          setBindUrl(null);
          setBindState(null);
          void load();
          return;
        }
        if (st.expired) {
          stopPoll();
          message.warning("二维码已过期，请点击「刷新二维码」");
        }
      } catch {
        /* ignore transient poll errors */
      }
    };
    void tick();
    pollRef.current = window.setInterval(() => void tick(), 2000);
    return () => stopPoll();
  }, [bindOpen, bindState, bindWaiting, load, stopPoll]);

  useEffect(() => {
    const wx = search.get("wx_bind");
    if (wx === "1") {
      message.success("微信收款账号绑定成功");
      search.delete("wx_bind");
      search.delete("err");
      setSearch(search, { replace: true });
      void load();
    } else if (wx === "0") {
      message.error(search.get("err") || "微信绑定失败");
      search.delete("wx_bind");
      search.delete("err");
      setSearch(search, { replace: true });
    }
    if (search.get("bind") === "1") {
      search.delete("bind");
      setSearch(search, { replace: true });
      void openBind();
    }
  }, [search, setSearch, load, openBind]);

  if (loading) return <Skeleton rows={8} />;
  if (error) return <ErrorState message={error} onRetry={() => void load()} />;
  if (!data) return null;

  const s = data.stats;
  const receiver = data.receiver;
  const bound = Boolean(receiver?.bound);

  return (
    <div className="partner-dash">
      <div className="partner-dash__intro">
        <Typography.Title level={4} className="partner-dash__title">
          {String(data.org.name || "机构看板")}
        </Typography.Title>
        <Typography.Paragraph type="secondary" className="partner-dash__lead">
          分账比例由平台运营配置。学员通过本机构邀请链接注册并付费后计入渠道。
        </Typography.Paragraph>
      </div>

      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12 }}
        message={SHARE_HOLD_COPY.org.message}
        description={SHARE_HOLD_COPY.org.description}
      />

      <Card size="small" className="partner-dash__bind">
        <Space direction="vertical" style={{ width: "100%" }} size="middle">
          {!bound && (
            <Alert
              type="warning"
              showIcon
              message="尚未绑定微信收款账号"
              description="请使用个人微信扫码授权。学员通过本机构邀请链接注册并付费后，满 7 天分账到该微信。"
            />
          )}
          {bound && (
            <Alert
              type="success"
              showIcon
              message="已绑定收款微信"
              description={
                <span className="partner-dash__bind-meta">
                  {[receiver?.wx_receiver_type || "PERSONAL_OPENID", receiver?.wx_receiver_name, receiver?.wx_receiver_account_masked]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              }
            />
          )}
          <div className="partner-dash__bind-actions">
            <Button type="primary" block={isMobile} loading={bindLoading} onClick={() => void openBind()}>
              {bound ? "重新绑定收款微信" : "扫码绑定收款微信"}
            </Button>
            <Button block={isMobile} onClick={() => void load()}>
              刷新
            </Button>
          </div>
        </Space>
      </Card>

      <Row gutter={[12, 12]} className="partner-dash__stats">
        <Col xs={12} md={6}>
          <Card size="small" className="partner-dash__stat">
            <Statistic title="邀请人数" value={Number(s.invited_users || 0)} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card size="small" className="partner-dash__stat">
            <Statistic title="付费人数" value={Number(s.paid_users || 0)} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card size="small" className="partner-dash__stat">
            <Statistic title="当前比例" value={Number(s.current_rate_pct || 0)} suffix="%" precision={1} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card size="small" className="partner-dash__stat">
            <Statistic title="已到账" value={fenYuan(s.shared_fen)} prefix="¥" />
          </Card>
        </Col>
      </Row>

      <Card title="拉新明细" size="small" className="partner-dash__list-card">
        {attributions.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无拉新记录" />
        ) : isMobile ? (
          <div className="partner-mobile-list">
            {attributions.map((row) => {
              const id = String(row.user_id || row.email || Math.random());
              const ident = partnerIdentity(row);
              return (
                <article key={id} className="partner-mobile-item">
                  <div className="partner-mobile-item__head">
                    <div className="partner-mobile-item__title">{ident.title}</div>
                    <div className="partner-mobile-item__badge">付费 {Number(row.paid_orders || 0)}</div>
                  </div>
                  {ident.subtitle && (
                    <div className="partner-mobile-item__sub" title={String(row.email || "")}>
                      {ident.subtitle}
                    </div>
                  )}
                  <div className="partner-mobile-item__meta">
                    <span>邀请码 {String(row.invite_code || "—")}</span>
                    <span>{formatPartnerTime(row.bound_at)}</span>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <Table
            size="small"
            rowKey={(r) => String(r.user_id || r.email)}
            dataSource={attributions}
            pagination={{ pageSize: 10, hideOnSinglePage: true }}
            scroll={{ x: 720 }}
            columns={[
              {
                title: "学员",
                ellipsis: true,
                render: (_, r) => {
                  const ident = partnerIdentity(r);
                  return (
                    <div>
                      <div>{ident.title}</div>
                      {ident.subtitle && (
                        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                          {ident.subtitle}
                        </Typography.Text>
                      )}
                    </div>
                  );
                },
              },
              {
                title: "邮箱",
                dataIndex: "email",
                ellipsis: true,
                width: 200,
                render: (v) => <span title={String(v || "")}>{shortenId(String(v || ""), 28)}</span>,
              },
              { title: "邀请码", dataIndex: "invite_code", width: 140, ellipsis: true },
              {
                title: "绑定时间",
                dataIndex: "bound_at",
                width: 150,
                render: (v) => formatPartnerTime(v),
              },
              { title: "付费单", dataIndex: "paid_orders", width: 80, align: "right" },
            ]}
          />
        )}
      </Card>

      <Modal
        title="扫码绑定收款微信"
        open={bindOpen}
        onCancel={() => {
          stopPoll();
          setBindOpen(false);
          setBindUrl(null);
          setBindState(null);
        }}
        footer={[
          <Button key="refresh" onClick={() => void openBind()} loading={bindLoading}>
            刷新二维码
          </Button>,
          <Button
            key="close"
            type="primary"
            onClick={() => {
              stopPoll();
              setBindOpen(false);
              setBindUrl(null);
              setBindState(null);
            }}
          >
            关闭
          </Button>,
        ]}
        destroyOnClose
        width={isMobile ? "92%" : 520}
      >
        <Typography.Paragraph>
          请用<strong>手机微信</strong>扫描下方二维码完成授权。授权成功后手机端会提示「绑定成功」，电脑端将自动刷新。
        </Typography.Paragraph>
        {receiver && receiver.oauth_configured === false && (
          <Alert type="error" showIcon style={{ marginBottom: 12 }} message="服务端未配置 WECHAT_APP_SECRET，无法绑定" />
        )}
        <div style={{ display: "flex", justifyContent: "center", padding: 12 }}>
          {bindUrl ? <QRCode value={bindUrl} size={isMobile ? 180 : 220} /> : <Typography.Text type="secondary">生成中…</Typography.Text>}
        </div>
        {bindWaiting && bindUrl && (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 12 }}
            message="等待手机微信确认授权…"
            description="扫码后请在手机上点击允许；成功后本窗口会自动关闭。"
          />
        )}
        {bindUrl && (
          <Typography.Paragraph type="secondary" copyable={{ text: bindUrl }} style={{ wordBreak: "break-all", fontSize: 12 }}>
            或复制链接在微信中打开
          </Typography.Paragraph>
        )}
      </Modal>
    </div>
  );
}

export function PartnerShares() {
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await partnerApi.profitShares();
        setItems(res.items || []);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "加载失败");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <Skeleton rows={6} />;
  if (error) return <ErrorState message={error} onRetry={() => window.location.reload()} />;

  return (
    <Card
      title="分账明细"
      extra={<Typography.Text type="secondary">满 7 天到账</Typography.Text>}
      size="small"
      className="partner-dash__list-card"
    >
      {items.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无分账记录" />
      ) : isMobile ? (
        <div className="partner-mobile-list">
          {items.map((row) => (
            <article key={String(row.id)} className="partner-mobile-item">
              <div className="partner-mobile-item__head">
                <div className="partner-mobile-item__title">¥{fenYuan(row.share_fen)}</div>
                <div className="partner-mobile-item__badge">{profitShareStateLabel(String(row.wx_state || ""))}</div>
              </div>
              <div className="partner-mobile-item__sub" title={String(row.user_email || "")}>
                {shortenId(String(row.user_email || "—"), 28)}
              </div>
              <div className="partner-mobile-item__meta">
                <span>
                  订单 ¥{fenYuan(row.amount_fen)} · {(Number(row.rate_bps || 0) / 100).toFixed(1)}%
                </span>
                <span>{formatPartnerTime(row.created_at)}</span>
              </div>
              {row.out_trade_no ? (
                <div className="partner-mobile-item__sub" title={String(row.out_trade_no)}>
                  {shortenId(String(row.out_trade_no), 28)}
                </div>
              ) : null}
            </article>
          ))}
        </div>
      ) : (
        <Table
          size="small"
          rowKey="id"
          dataSource={items}
          scroll={{ x: 860 }}
          pagination={{ pageSize: 10, hideOnSinglePage: true }}
          columns={[
            {
              title: "订单号",
              dataIndex: "out_trade_no",
              ellipsis: true,
              width: 180,
              render: (v) => <span title={String(v || "")}>{shortenId(String(v || ""), 24)}</span>,
            },
            {
              title: "学员",
              dataIndex: "user_email",
              ellipsis: true,
              render: (v) => <span title={String(v || "")}>{shortenId(String(v || ""), 24)}</span>,
            },
            {
              title: "订单金额",
              width: 100,
              align: "right",
              render: (_, r) => `¥${fenYuan(r.amount_fen)}`,
            },
            {
              title: "比例",
              width: 80,
              align: "right",
              render: (_, r) => `${(Number(r.rate_bps || 0) / 100).toFixed(1)}%`,
            },
            {
              title: "分账",
              width: 100,
              align: "right",
              render: (_, r) => `¥${fenYuan(r.share_fen)}`,
            },
            { title: "状态", dataIndex: "wx_state", width: 160, render: (v: string) => profitShareStateLabel(v) },
            {
              title: "时间",
              dataIndex: "created_at",
              width: 150,
              render: (v) => formatPartnerTime(v),
            },
          ]}
        />
      )}
    </Card>
  );
}
