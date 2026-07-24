import { useEffect, useState } from "react";
import { App, Button, Empty, Form, Input, Modal, Table, Tabs, Upload } from "antd";
import type { ColumnsType } from "antd/es/table";
import { PlusOutlined, UploadOutlined } from "@ant-design/icons";
import { authorApi, ApiError } from "../../../lib/api";
import type { Paginated } from "../../../lib/listQuery";
import { PAGE_SIZE_OPTIONS } from "../../../lib/listQuery";

export interface PickedMedia {
  kind?: string;
  title?: string;
  object_key: string;
  poster_key?: string;
  duration_sec?: number;
}

type MediaAssetRow = {
  id: string;
  title: string;
  kind: string;
  object_key: string;
  poster_key?: string | null;
  duration_sec?: number;
  size_bytes?: number;
  created_at?: string;
};

export function MediaPickerModal({
  open,
  onClose,
  onPick,
  campId,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (media: PickedMedia) => void;
  campId?: string;
}) {
  const { message } = App.useApp();
  const [activeTab, setActiveTab] = useState<"list" | "upload">("list");
  const [data, setData] = useState<Paginated<MediaAssetRow> | null>(null);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [uploadForm] = Form.useForm();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await authorApi.listMediaAssets({
        kind: "video",
        camp_id: campId || undefined,
        q: q || undefined,
        page,
        page_size: pageSize,
      });
      setData(res as Paginated<MediaAssetRow>);
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : "加载视频库失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    setActiveTab("list");
    setQ("");
    setPage(1);
    void load();
    uploadForm.resetFields();
    setFile(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize]);

  const doSearch = (value: string) => {
    setQ(value);
    setPage(1);
    void load();
  };

  const handlePick = (row: MediaAssetRow) => {
    onPick({
      kind: row.kind,
      title: row.title,
      object_key: row.object_key,
      poster_key: row.poster_key || undefined,
      duration_sec: row.duration_sec,
    });
    onClose();
  };

  const handleUpload = async () => {
    if (!file) {
      message.warning("请先选择要上传的视频文件");
      return;
    }
    try {
      const values = await uploadForm.validateFields();
      setUploading(true);
      const fd = new FormData();
      fd.append("file", file);
      fd.append("kind", "video");
      fd.append("title", values.title || file.name);
      if (campId) fd.append("camp_id", campId);
      const res = await authorApi.uploadMediaAsset(fd);
      message.success("上传成功");
      onPick({
        kind: res.kind || "video",
        title: res.title || values.title || file.name,
        object_key: res.object_key,
        poster_key: res.poster_key || undefined,
        duration_sec: res.duration_sec,
      });
      onClose();
    } catch (err) {
      if (err instanceof ApiError) message.error(err.message);
      else if (err instanceof Error) message.error(err.message);
    } finally {
      setUploading(false);
    }
  };

  const columns: ColumnsType<MediaAssetRow> = [
    { title: "标题", dataIndex: "title" },
    { title: "时长（秒）", dataIndex: "duration_sec", width: 100 },
    { title: "大小", dataIndex: "size_bytes", width: 100, responsive: ["md"] },
    { title: "创建时间", dataIndex: "created_at", width: 160, responsive: ["lg"] },
    {
      title: "操作",
      width: 90,
      render: (_, row) => (
        <Button size="small" type="primary" onClick={() => handlePick(row)}>
          选择
        </Button>
      ),
    },
  ];

  return (
    <Modal
      title="选择视频"
      open={open}
      onCancel={onClose}
      footer={null}
      destroyOnClose
      width={720}
    >
      <Tabs
        activeKey={activeTab}
        onChange={(k) => setActiveTab(k as "list" | "upload")}
        items={[
          {
            key: "list",
            label: "从视频库选择",
            children: (
              <>
                <Input.Search
                  allowClear
                  placeholder="搜索标题"
                  style={{ marginBottom: 12, maxWidth: 320 }}
                  onSearch={doSearch}
                />
                <Table<MediaAssetRow>
                  rowKey="id"
                  size="small"
                  loading={loading}
                  columns={columns}
                  dataSource={data?.items || []}
                  locale={{ emptyText: <Empty description="暂无视频，可切换到「上传新视频」" /> }}
                  pagination={{
                    current: data?.page || page,
                    pageSize: data?.page_size || pageSize,
                    total: data?.total || 0,
                    pageSizeOptions: PAGE_SIZE_OPTIONS.map(String),
                    showTotal: (t) => `共 ${t} 条`,
                    onChange: (p, ps) => {
                      setPage(p);
                      setPageSize(ps);
                    },
                  }}
                />
              </>
            ),
          },
          {
            key: "upload",
            label: "上传新视频",
            children: (
              <Form form={uploadForm} layout="vertical">
                <Form.Item label="选择视频文件" required>
                  <Upload
                    accept="video/*"
                    maxCount={1}
                    showUploadList
                    beforeUpload={(f) => {
                      setFile(f);
                      if (!uploadForm.getFieldValue("title")) uploadForm.setFieldValue("title", f.name);
                      return false;
                    }}
                    onRemove={() => setFile(null)}
                  >
                    <Button icon={<UploadOutlined />}>选择文件</Button>
                  </Upload>
                </Form.Item>
                <Form.Item name="title" label="标题" rules={[{ required: true, message: "请输入标题" }]}>
                  <Input placeholder="视频标题" />
                </Form.Item>
                <Button type="primary" icon={<PlusOutlined />} loading={uploading} onClick={() => void handleUpload()}>
                  上传并使用
                </Button>
              </Form>
            ),
          },
        ]}
      />
    </Modal>
  );
}
