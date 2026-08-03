import { useCallback, useEffect, useState } from "react";
import { Button, Card, InputNumber, Select, Space, Table, Typography, message } from "antd";
import { authorApi, ApiError } from "../../lib/api";
import { useAuth } from "../../lib/auth";

type OfferingRow = {
  id: string;
  title: string;
  course_title?: string;
  price_fen?: number;
  status?: string;
  enrollment_count?: number;
  version_tag?: string;
};

export function PricingSettings() {
  const { campId } = useAuth();
  const [items, setItems] = useState<OfferingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<Record<string, number>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authorApi.listOfferings({
        camp_id: campId || undefined,
        page: 1,
        page_size: 50,
      });
      const rows = (res.items || []) as OfferingRow[];
      setItems(rows);
      const next: Record<string, number> = {};
      for (const r of rows) {
        next[r.id] = Number(((r.price_fen || 0) / 100).toFixed(2));
      }
      setDrafts(next);
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [campId]);

  useEffect(() => {
    void load();
  }, [load]);

  const onSave = async (row: OfferingRow) => {
    const yuan = drafts[row.id];
    if (yuan == null || Number.isNaN(yuan) || yuan < 0) {
      message.error("请输入有效价格");
      return;
    }
    const fen = Math.round(yuan * 100);
    setSavingId(row.id);
    try {
      await authorApi.patchOffering(row.id, { price_fen: fen });
      message.success(`已更新价格为 ¥${(fen / 100).toFixed(2)}`);
      void load();
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : "保存失败");
    } finally {
      setSavingId(null);
    }
  };

  const onStatus = async (row: OfferingRow, status: string) => {
    setSavingId(row.id);
    try {
      await authorApi.patchOffering(row.id, { status });
      message.success("状态已更新");
      void load();
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : "更新失败");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div style={{ padding: 24, maxWidth: 960 }}>
      <Typography.Title level={3} style={{ marginTop: 0 }}>
        课程定价
      </Typography.Title>
      <Typography.Paragraph type="secondary">
        修改售卖价格后，学员「选购课程」页会立即显示新价格。价格单位为元；设为 0 则不在商城展示。
      </Typography.Paragraph>
      <Card size="small">
        <Table
          rowKey="id"
          loading={loading}
          dataSource={items}
          pagination={false}
          columns={[
            {
              title: "课程 / 营期",
              render: (_, r) => (
                <div>
                  <div style={{ fontWeight: 600 }}>{r.course_title || r.title}</div>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    {r.title}
                    {r.version_tag ? ` · ${r.version_tag}` : ""}
                  </Typography.Text>
                </div>
              ),
            },
            {
              title: "报名人数",
              dataIndex: "enrollment_count",
              width: 100,
            },
            {
              title: "售卖状态",
              width: 140,
              render: (_, r) => (
                <Select
                  size="small"
                  style={{ width: 120 }}
                  value={r.status || "active"}
                  disabled={savingId === r.id}
                  onChange={(v) => void onStatus(r, v)}
                  options={[
                    { value: "active", label: "在售" },
                    { value: "upcoming", label: "即将开售" },
                    { value: "ended", label: "已结束" },
                    { value: "archived", label: "已下架" },
                  ]}
                />
              ),
            },
            {
              title: "价格（元）",
              width: 200,
              render: (_, r) => (
                <Space>
                  <InputNumber
                    min={0}
                    max={100000}
                    step={1}
                    precision={2}
                    value={drafts[r.id]}
                    onChange={(v) => setDrafts((prev) => ({ ...prev, [r.id]: Number(v || 0) }))}
                    addonBefore="¥"
                  />
                  <Button type="primary" loading={savingId === r.id} onClick={() => void onSave(r)}>
                    保存
                  </Button>
                </Space>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
