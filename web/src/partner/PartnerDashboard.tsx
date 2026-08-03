import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Alert, Button, Card, Col, Modal, QRCode, Row, Space, Statistic, Table, Typography, message } from "antd";
import { partnerApi, ApiError, type PartnerReceiverStatus } from "../lib/api";
import { Skeleton } from "../components/Skeleton";
import { ErrorState } from "../components/ErrorState";

export function PartnerDashboard() {
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
    <div>
      <Typography.Title level={4}>{String(data.org.name || "机构看板")}</Typography.Title>
      <Typography.Paragraph type="secondary">
        分账比例由平台运营配置。归因学员付费后，将分账至本机构绑定的个人微信。
      </Typography.Paragraph>

      <Card size="small" style={{ marginBottom: 16 }}>
        <Space direction="vertical" style={{ width: "100%" }} size="middle">
          {!bound && (
            <Alert
              type="warning"
              showIcon
              message="尚未绑定微信收款账号"
              description="请使用个人微信扫码授权。仅当学员通过本机构邀请链接注册并付费时，才会向该微信分账。"
            />
          )}
          {bound && (
            <Alert
              type="success"
              showIcon
              message="已绑定收款微信"
              description={`类型 ${receiver?.wx_receiver_type || "PERSONAL_OPENID"} · ${receiver?.wx_receiver_name || ""} · ${receiver?.wx_receiver_account_masked || ""}`}
            />
          )}
          <Space wrap>
            <Button type="primary" loading={bindLoading} onClick={() => void openBind()}>
              {bound ? "重新绑定收款微信" : "扫码绑定收款微信"}
            </Button>
            <Button onClick={() => void load()}>刷新</Button>
          </Space>
        </Space>
      </Card>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} md={6}>
          <Card><Statistic title="邀请人数" value={Number(s.invited_users || 0)} /></Card>
        </Col>
        <Col xs={12} md={6}>
          <Card><Statistic title="付费人数" value={Number(s.paid_users || 0)} /></Card>
        </Col>
        <Col xs={12} md={6}>
          <Card><Statistic title="当前比例" value={Number(s.current_rate_pct || 0)} suffix="%" precision={1} /></Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="已分账" value={(Number(s.shared_fen || 0) / 100).toFixed(2)} prefix="¥" />
          </Card>
        </Col>
      </Row>
      <Card title="拉新明细" size="small">
        <Table
          size="small"
          rowKey="user_id"
          dataSource={attributions}
          pagination={{ pageSize: 10 }}
          columns={[
            { title: "邮箱", dataIndex: "email" },
            { title: "显示名", dataIndex: "display_name" },
            { title: "邀请码", dataIndex: "invite_code" },
            { title: "绑定时间", dataIndex: "bound_at" },
            { title: "付费单", dataIndex: "paid_orders" },
          ]}
        />
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
      >
        <Typography.Paragraph>
          请用<strong>手机微信</strong>扫描下方二维码完成授权。授权成功后手机端会提示「绑定成功」，电脑端将自动刷新。
        </Typography.Paragraph>
        {receiver && receiver.oauth_configured === false && (
          <Alert type="error" showIcon style={{ marginBottom: 12 }} message="服务端未配置 WECHAT_APP_SECRET，无法绑定" />
        )}
        <div style={{ display: "flex", justifyContent: "center", padding: 12 }}>
          {bindUrl ? <QRCode value={bindUrl} size={220} /> : <Typography.Text type="secondary">生成中…</Typography.Text>}
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
    <Card title="分账明细" size="small">
      <Table
        size="small"
        rowKey="id"
        dataSource={items}
        columns={[
          { title: "订单号", dataIndex: "out_trade_no" },
          { title: "学员", dataIndex: "user_email" },
          { title: "订单金额", render: (_, r) => `¥${(Number(r.amount_fen || 0) / 100).toFixed(2)}` },
          { title: "比例", render: (_, r) => `${(Number(r.rate_bps || 0) / 100).toFixed(1)}%` },
          { title: "分账", render: (_, r) => `¥${(Number(r.share_fen || 0) / 100).toFixed(2)}` },
          { title: "状态", dataIndex: "wx_state" },
          { title: "时间", dataIndex: "created_at" },
        ]}
      />
    </Card>
  );
}
