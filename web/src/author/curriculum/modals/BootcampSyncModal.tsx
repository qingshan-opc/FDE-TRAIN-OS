import { useEffect, useState } from "react";
import { Alert, App, Button, Checkbox, Modal, Radio, Space, Table, Typography } from "antd";
import { authorApi, ApiError } from "../../../lib/api";

type PreviewDay = {
  day: number;
  title: string;
  capsule_count: number;
  capsules: Array<{ id: string; title?: string; media_count?: number; knowledge_cards_count?: number }>;
  changes: string[];
};

export function BootcampSyncModal({
  open,
  versionId,
  onCancel,
  onSynced,
}: {
  open: boolean;
  versionId: string;
  onCancel: () => void;
  onSynced: () => void;
}) {
  const { message } = App.useApp();
  const [available, setAvailable] = useState<number[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [mergeMode, setMergeMode] = useState<"full" | "media_fields">("media_fields");
  const [preview, setPreview] = useState<PreviewDay[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPreview(null);
    void authorApi
      .listBootcampDays()
      .then((res) => {
        const days = res.items || [];
        setAvailable(days);
        setSelected(days);
      })
      .catch(() => {
        setAvailable([]);
        setSelected([]);
      });
  }, [open]);

  const runPreview = async () => {
    if (!selected.length) {
      message.warning("请至少选择一天");
      return;
    }
    setLoading(true);
    try {
      const res = await authorApi.syncBootcamp(versionId, {
        days: selected,
        dry_run: true,
        merge_mode: mergeMode,
      });
      setPreview(res.days || []);
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : "预览失败");
    } finally {
      setLoading(false);
    }
  };

  const confirmSync = async () => {
    if (!selected.length) return;
    setSyncing(true);
    try {
      const res = await authorApi.syncBootcamp(versionId, {
        days: selected,
        dry_run: false,
        merge_mode: mergeMode,
      });
      message.success(`已同步 ${res.updated?.length || 0} 个课次`);
      onSynced();
      onCancel();
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : "同步失败");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Modal
      title="从 bootcamp 同步"
      open={open}
      onCancel={onCancel}
      width={720}
      footer={
        <Space>
          <Button onClick={onCancel}>取消</Button>
          <Button loading={loading} onClick={() => void runPreview()} disabled={!selected.length}>
            预览变更
          </Button>
          <Button type="primary" loading={syncing} onClick={() => void confirmSync()} disabled={!selected.length}>
            确认同步
          </Button>
        </Space>
      }
    >
      <Typography.Paragraph type="secondary">
        从 <Typography.Text code>class/bootcamp</Typography.Text> 读取 day.yaml、口播稿与 media 配置，写入当前草稿版本。
      </Typography.Paragraph>
      <Space direction="vertical" style={{ width: "100%" }} size="middle">
        <div>
          <Typography.Text strong>选择课次</Typography.Text>
          <Checkbox.Group
            style={{ display: "block", marginTop: 8 }}
            value={selected}
            onChange={(v) => setSelected(v as number[])}
            options={available.map((d) => ({ label: `Day ${d}`, value: d }))}
          />
        </div>
        <div>
          <Typography.Text strong>合并模式</Typography.Text>
          <Radio.Group
            style={{ display: "block", marginTop: 8 }}
            value={mergeMode}
            onChange={(e) => setMergeMode(e.target.value)}
            options={[
              { label: "仅更新内容/媒体/知识卡片（保留手工编辑）", value: "media_fields" },
              { label: "整包覆盖（bootcamp 为准）", value: "full" },
            ]}
          />
        </div>
        {preview && (
          <>
            <Alert type="info" showIcon message={`预览 ${preview.length} 个课次变更`} />
            <Table
              size="small"
              rowKey="day"
              pagination={false}
              dataSource={preview}
              columns={[
                { title: "课次", dataIndex: "day", width: 72, render: (d) => `Day ${d}` },
                { title: "标题", dataIndex: "title", ellipsis: true },
                { title: "课节", dataIndex: "capsule_count", width: 64 },
                {
                  title: "变更摘要",
                  dataIndex: "changes",
                  render: (changes: string[]) =>
                    changes.length ? (
                      <ul style={{ margin: 0, paddingLeft: 16 }}>
                        {changes.slice(0, 4).map((c) => (
                          <li key={c}>{c}</li>
                        ))}
                        {changes.length > 4 && <li>…共 {changes.length} 项</li>}
                      </ul>
                    ) : (
                      "无变更"
                    ),
                },
              ]}
            />
          </>
        )}
      </Space>
    </Modal>
  );
}
