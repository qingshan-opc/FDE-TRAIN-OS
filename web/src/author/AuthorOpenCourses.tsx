import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  App,
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Space,
  Table,
  Typography,
  Upload,
  Popconfirm,
  Tag,
  Empty,
} from "antd";
import { UploadOutlined } from "@ant-design/icons";
import type { UploadFile } from "antd/es/upload/interface";
import { authorApi, ApiError } from "../lib/api";
import type { LandingOpenCourse } from "../lib/types";

export function AuthorOpenCourses() {
  const { message } = App.useApp();
  const [items, setItems] = useState<LandingOpenCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form] = Form.useForm();
  const [video, setVideo] = useState<File | null>(null);
  const [poster, setPoster] = useState<File | null>(null);
  const [videoList, setVideoList] = useState<UploadFile[]>([]);
  const [posterList, setPosterList] = useState<UploadFile[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authorApi.listOpenCourses();
      setItems(res.items || []);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const clearMedia = () => {
    setVideo(null);
    setPoster(null);
    setVideoList([]);
    setPosterList([]);
  };

  const onCreate = async (values: { title: string; level?: string; summary?: string; minutes?: number }) => {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("title", values.title.trim());
      fd.append("level", (values.level || "").trim());
      fd.append("summary", (values.summary || "").trim());
      fd.append("minutes", String(values.minutes || 0));
      fd.append("published", "true");
      if (video) fd.append("video", video);
      if (poster) fd.append("poster", poster);
      const res = await authorApi.upsertOpenCourse(fd);
      setItems(res.items);
      form.resetFields();
      clearMedia();
      message.success("公开课已保存");
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : "保存失败");
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async (id: string) => {
    setBusy(true);
    try {
      const res = await authorApi.deleteOpenCourse(id);
      setItems(res.items);
      message.success("已删除");
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : "删除失败");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <Typography.Title level={3} style={{ marginTop: 0 }}>
        站点公开课
      </Typography.Title>
      <Typography.Paragraph type="secondary">
        上传真实授权视频到 Landing「公开课」。无素材时前台显示待发布，不造假。
      </Typography.Paragraph>

      <Card title="新增 / 上传" style={{ marginBottom: 16 }}>
        <Form
          form={form}
          layout="vertical"
          initialValues={{ level: "入门", minutes: 2 }}
          onFinish={(v) => void onCreate(v)}
        >
          <Form.Item name="title" label="标题" rules={[{ required: true, message: "请填写标题" }]}>
            <Input />
          </Form.Item>
          <Space size="large" style={{ display: "flex" }} wrap>
            <Form.Item name="level" label="级别" style={{ minWidth: 160 }}>
              <Input />
            </Form.Item>
            <Form.Item name="minutes" label="分钟">
              <InputNumber min={0} />
            </Form.Item>
          </Space>
          <Form.Item name="summary" label="摘要">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Space wrap style={{ marginBottom: 16 }}>
            <Upload
              accept="video/*"
              maxCount={1}
              fileList={videoList}
              beforeUpload={(file) => {
                setVideo(file);
                setVideoList([{ uid: `-video-${Date.now()}`, name: file.name, status: "done" }]);
                return false;
              }}
              onRemove={() => {
                setVideo(null);
                setVideoList([]);
              }}
            >
              <Button icon={<UploadOutlined />}>选择视频</Button>
            </Upload>
            <Upload
              accept="image/*"
              maxCount={1}
              fileList={posterList}
              beforeUpload={(file) => {
                setPoster(file);
                setPosterList([{ uid: `-poster-${Date.now()}`, name: file.name, status: "done" }]);
                return false;
              }}
              onRemove={() => {
                setPoster(null);
                setPosterList([]);
              }}
            >
              <Button icon={<UploadOutlined />}>选择海报</Button>
            </Upload>
          </Space>
          <div>
            <Button type="primary" htmlType="submit" loading={busy}>
              保存公开课
            </Button>
          </div>
        </Form>
      </Card>

      {error && (
        <Alert
          type="error"
          showIcon
          message={error}
          action={
            <Button size="small" onClick={() => void load()}>
              重试
            </Button>
          }
          style={{ marginBottom: 16 }}
        />
      )}

      <Card title={`已配置（${items.length}）`}>
        <Table
          rowKey="id"
          loading={loading}
          dataSource={items}
          locale={{ emptyText: <Empty description="暂无自定义公开课，前台将使用系统种子片" /> }}
          columns={[
            { title: "ID", dataIndex: "id", render: (id) => <Typography.Text code>{id}</Typography.Text> },
            { title: "标题", dataIndex: "title" },
            {
              title: "发布",
              dataIndex: "published",
              render: (p) => <Tag color={p === false ? "default" : "success"}>{p === false ? "否" : "是"}</Tag>,
            },
            {
              title: "媒资",
              render: (_, c) => (
                <Typography.Text type="secondary">
                  {c.object_key ? "有视频" : "无视频"}
                  {c.poster_key ? " · 有海报" : ""}
                </Typography.Text>
              ),
            },
            {
              title: "操作",
              render: (_, c) => (
                <Popconfirm title={`删除公开课 ${c.id}？`} onConfirm={() => void onDelete(c.id)}>
                  <Button danger disabled={busy}>
                    删除
                  </Button>
                </Popconfirm>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
