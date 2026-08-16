import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Card, Col, Row, Statistic, Table, Tag, Typography, Button, Space, Modal } from "antd";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
} from "recharts";
import { ReloadOutlined } from "@ant-design/icons";
import { authorApi, ApiError } from "../lib/api";
import { PageHeader, useErrorModal } from "../components/crud";
import { Skeleton } from "../components/Skeleton";
import { PROFIT_SHARE_STATE } from "../lib/billingLabels";

type FinanceDash = {
  paid_orders: number;
  paid_users: number;
  gross_fen: number;
  shared_fen: number;
  pending_share_fen: number;
  failed_share_fen: number;
  finished_share_count: number;
  pending_share_count: number;
  failed_share_count: number;
  gross_trend_7d?: Array<{ date: string; gross_fen?: number; orders?: number }>;
  shared_trend_7d?: Array<{ date: string; shared_fen?: number; shares?: number }>;
  orgs?: Array<{
    id: string;
    name: string;
    paid_orders: number;
    gross_fen: number;
    shared_fen: number;
    pending_share_fen: number;
  }>;
  recent_orders?: Array<{
    id: string;
    out_trade_no?: string;
    amount_fen: number;
    paid_at?: string;
    org_id?: string | null;
    org_name?: string | null;
    user_email?: string | null;
    share_fen?: number | null;
    rate_bps?: number | null;
    wx_state?: string | null;
    error_message?: string | null;
    refundable?: boolean;
    status?: string;
  }>;
};

function yuanNum(fen: number | null | undefined) {
  return Number(fen || 0) / 100;
}

function yuanText(fen: number | null | undefined) {
  return yuanNum(fen).toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function shortDate(iso: string) {
  return iso.length >= 10 ? iso.slice(5) : iso;
}

const STATE_TAG: Record<string, { color: string; label: string }> = {
  ...PROFIT_SHARE_STATE,
  refunded: { color: "default", label: "已退款" },
  refunding: { color: "processing", label: "退款中" },
};

export function FinanceDashboard() {
  const [data, setData] = useState<FinanceDash | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string>("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authorApi.financeDashboard();
      setData(res);
      setUpdatedAt(new Date().toLocaleTimeString("zh-CN"));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "财务数据加载失败");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const t = window.setInterval(() => void load(), 15000);
    return () => window.clearInterval(t);
  }, [load]);

  useErrorModal(error, { title: "财务大屏加载失败", onRetry: () => void load() });

  const onRefund = (orderId: string) => {
    Modal.confirm({
      title: "确认退款？",
      content: "7 天账期内退款从冻结资金原路退回，课程权限将关闭，待分账会取消。",
      okText: "退款",
      okButtonProps: { danger: true },
      cancelText: "取消",
      onOk: async () => {
        try {
          await authorApi.refundOrder(orderId);
          await load();
        } catch (err) {
          setError(err instanceof ApiError ? err.message : "退款失败");
          throw err;
        }
      },
    });
  };

  const chartRows = useMemo(() => {
    if (!data) return [];
    const g = data.gross_trend_7d || [];
    const s = data.shared_trend_7d || [];
    const n = Math.max(g.length, s.length, 7);
    const rows = [];
    for (let i = 0; i < n; i++) {
      const date = g[i]?.date || s[i]?.date || "";
      rows.push({
        label: shortDate(date),
        gross: Number(g[i]?.gross_fen || 0) / 100,
        shared: Number(s[i]?.shared_fen || 0) / 100,
      });
    }
    return rows;
  }, [data]);

  if (loading && !data) return <Skeleton rows={8} />;

  return (
    <div className="author-finance-dash">
      <PageHeader
        title="财务大屏"
        description="支付后资金冻结 7 天再分账；7 天内可退款。退款订单不计入营收。"
        extra={
          <Space>
            {updatedAt ? <Typography.Text type="secondary">更新于 {updatedAt}</Typography.Text> : null}
            <Button icon={<ReloadOutlined />} onClick={() => void load()} loading={loading}>
              刷新
            </Button>
          </Space>
        }
      />

      {!data ? (
        <Alert type="warning" showIcon message="暂无财务数据" />
      ) : (
        <>
          <Row gutter={[12, 12]}>
            <Col xs={12} md={6}>
              <Card size="small">
                <Statistic title="已收款（出账）" prefix="¥" precision={2} value={yuanNum(data.gross_fen)} />
                <Typography.Text type="secondary">{data.paid_orders} 笔 · {data.paid_users} 人</Typography.Text>
              </Card>
            </Col>
            <Col xs={12} md={6}>
              <Card size="small">
                <Statistic title="已分账" prefix="¥" precision={2} value={yuanNum(data.shared_fen)} valueStyle={{ color: "#0f766e" }} />
                <Typography.Text type="secondary">{data.finished_share_count} 笔完成</Typography.Text>
              </Card>
            </Col>
            <Col xs={12} md={6}>
              <Card size="small">
                <Statistic title="冻结 / 待分" prefix="¥" precision={2} value={yuanNum(data.pending_share_fen)} valueStyle={{ color: "#d97706" }} />
                <Typography.Text type="secondary">{data.pending_share_count} 笔处理中</Typography.Text>
              </Card>
            </Col>
            <Col xs={12} md={6}>
              <Card size="small">
                <Statistic title="分账失败金额" prefix="¥" precision={2} value={yuanNum(data.failed_share_fen)} valueStyle={{ color: "#dc2626" }} />
                <Typography.Text type="secondary">{data.failed_share_count} 笔失败</Typography.Text>
              </Card>
            </Col>
          </Row>

          <Card size="small" style={{ marginTop: 16 }} title="近 7 日 · 收款 vs 分账（元）">
            <div style={{ width: "100%", height: 260 }}>
              <ResponsiveContainer>
                <AreaChart data={chartRows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gGross" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0d9488" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#0d9488" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gShared" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2563eb" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#2563eb" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" />
                  <YAxis />
                  <RechartsTooltip />
                  <Legend />
                  <Area type="monotone" dataKey="gross" name="收款" stroke="#0d9488" fill="url(#gGross)" />
                  <Area type="monotone" dataKey="shared" name="已分账" stroke="#2563eb" fill="url(#gShared)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Row gutter={[12, 12]} style={{ marginTop: 16 }}>
            <Col xs={24} lg={10}>
              <Card size="small" title="渠道分账">
                <Table
                  rowKey="id"
                  size="small"
                  pagination={false}
                  dataSource={data.orgs || []}
                  columns={[
                    { title: "机构", dataIndex: "name" },
                    {
                      title: "收款",
                      dataIndex: "gross_fen",
                      render: (v: number) => `¥${yuanText(v)}`,
                    },
                    {
                      title: "已分",
                      dataIndex: "shared_fen",
                      render: (v: number) => `¥${yuanText(v)}`,
                    },
                    {
                      title: "待分",
                      dataIndex: "pending_share_fen",
                      render: (v: number) => `¥${yuanText(v)}`,
                    },
                  ]}
                />
              </Card>
            </Col>
            <Col xs={24} lg={14}>
              <Card size="small" title="最近支付 / 分账">
                <Table
                  rowKey="id"
                  size="small"
                  pagination={{ pageSize: 8 }}
                  dataSource={data.recent_orders || []}
                  columns={[
                    {
                      title: "时间",
                      dataIndex: "paid_at",
                      width: 160,
                      render: (v: string) => (v ? String(v).replace("T", " ").slice(0, 19) : "—"),
                    },
                    {
                      title: "金额",
                      dataIndex: "amount_fen",
                      width: 90,
                      render: (v: number) => `¥${yuanText(v)}`,
                    },
                    {
                      title: "渠道",
                      dataIndex: "org_name",
                      render: (v: string | null, r) => v || r.org_id || "直客",
                    },
                    {
                      title: "分账",
                      dataIndex: "share_fen",
                      width: 90,
                      render: (v: number | null) => (v != null ? `¥${yuanText(v)}` : "—"),
                    },
                    {
                      title: "状态",
                      dataIndex: "wx_state",
                      width: 120,
                      render: (v: string | null, r) => {
                        const key = r.status === "refunded" || r.status === "refunding" ? r.status : v;
                        if (!key) return <Tag>未发起</Tag>;
                        const meta = STATE_TAG[key] || { color: "default", label: key };
                        return <Tag color={meta.color}>{meta.label}</Tag>;
                      },
                    },
                    {
                      title: "",
                      width: 72,
                      render: (_, r) =>
                        r.refundable ? (
                          <Button type="link" size="small" danger onClick={() => onRefund(r.id)}>
                            退款
                          </Button>
                        ) : null,
                    },
                  ]}
                />
              </Card>
            </Col>
          </Row>
        </>
      )}
    </div>
  );
}
