import { useCallback, useEffect, useState } from "react";
import { Card, Col, Row, Statistic, Table, Typography } from "antd";
import { partnerApi, ApiError } from "../lib/api";
import { Skeleton } from "../components/Skeleton";
import { ErrorState } from "../components/ErrorState";

export function PartnerDashboard() {
  const [data, setData] = useState<{
    org: Record<string, unknown>;
    stats: Record<string, unknown>;
  } | null>(null);
  const [attributions, setAttributions] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [dash, attr] = await Promise.all([partnerApi.dashboard(), partnerApi.attributions()]);
      setData({ org: dash.org, stats: dash.stats });
      setAttributions(attr.items || []);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <Skeleton rows={8} />;
  if (error) return <ErrorState message={error} onRetry={() => void load()} />;
  if (!data) return null;

  const s = data.stats;
  return (
    <div>
      <Typography.Title level={4}>{String(data.org.name || "机构看板")}</Typography.Title>
      <Typography.Paragraph type="secondary">数据只读，分账比例由平台运营配置</Typography.Paragraph>
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
