import { useCallback, useEffect, useState } from "react";
import { Alert, App, Button, Card, Form, Input, Table, Tag, Typography, Upload, Empty } from "antd";
import { UploadOutlined } from "@ant-design/icons";
import { authorApi, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import type { CourseVersion } from "../lib/types";

export function CourseEditor() {
  const { campId } = useAuth();
  const { message } = App.useApp();
  const [versions, setVersions] = useState<CourseVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form] = Form.useForm();

  const load = useCallback(async () => {
    if (!campId) {
      setVersions([]);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await authorApi.listCourseVersions(campId);
      setVersions(res.items || []);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "加载失败");
      setVersions([]);
    } finally {
      setLoading(false);
    }
  }, [campId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    form.setFieldsValue({ version_tag: "721-v1", title: "FDE 两周课 721", note: "" });
  }, [form]);

  const uploadYaml = async (file: File) => {
    setBusy(true);
    try {
      await authorApi.uploadContract(file);
      message.success(`已上传 ${file.name}`);
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : "上传失败");
    } finally {
      setBusy(false);
    }
    return false;
  };

  const publish = async (values: { version_tag: string; title: string; note?: string }) => {
    if (!campId) {
      message.error("请先选择营期");
      return;
    }
    setBusy(true);
    try {
      await authorApi.publishCourseVersion({
        camp_id: campId,
        version_tag: values.version_tag,
        title: values.title,
        note: values.note,
      });
      message.success("课程版本已发布");
      await load();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "发布失败";
      message.error(msg);
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <Typography.Title level={3} style={{ marginTop: 0 }}>
        课程版本
      </Typography.Title>
      <Typography.Paragraph type="secondary">上传课次 YAML 契约，或发布课程版本</Typography.Paragraph>

      {!campId && (
        <Alert type="warning" showIcon message="当前会话未选择营期，无法发布或加载版本列表" style={{ marginBottom: 16 }} />
      )}

      <Card title="上传课次契约" style={{ marginBottom: 16 }}>
        <Typography.Paragraph type="secondary">
          <Typography.Text code>POST /api/v1/author/contracts/upload</Typography.Text> · 文件名需{" "}
          <Typography.Text code>day-*.yaml</Typography.Text>
        </Typography.Paragraph>
        <Upload
          accept=".yaml,.yml"
          showUploadList={false}
          beforeUpload={(file) => {
            void uploadYaml(file);
            return false;
          }}
          disabled={busy}
        >
          <Button type="primary" icon={<UploadOutlined />} loading={busy}>
            选择 YAML
          </Button>
        </Upload>
      </Card>

      <Card title="发布课程版本" style={{ marginBottom: 16 }}>
        <Form form={form} layout="vertical" onFinish={(v) => void publish(v)}>
          <Form.Item name="version_tag" label="版本标签" rules={[{ required: true, message: "请填写版本标签" }]}>
            <Input className="mono" />
          </Form.Item>
          <Form.Item name="title" label="标题" rules={[{ required: true, message: "请填写标题" }]}>
            <Input />
          </Form.Item>
          <Form.Item name="note" label="发布说明">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={busy} disabled={!campId}>
            发布
          </Button>
        </Form>
      </Card>

      {error && (
        <Alert
          type="error"
          showIcon
          message="版本列表不可用"
          description={error}
          action={
            <Button size="small" onClick={() => void load()}>
              重试
            </Button>
          }
          style={{ marginBottom: 16 }}
        />
      )}

      <Card title="已发布版本">
        <Table
          rowKey="id"
          loading={loading}
          dataSource={versions}
          locale={{ emptyText: <Empty description={campId ? "暂无版本记录" : "请先选择营期"} /> }}
          columns={[
            { title: "版本", dataIndex: "version_tag", render: (t) => <Typography.Text code>{t}</Typography.Text> },
            { title: "标题", dataIndex: "title" },
            { title: "状态", dataIndex: "status", render: (s: string) => <Tag>{s === "published" ? "已发布" : s === "draft" ? "草稿" : s}</Tag> },
            { title: "发布时间", dataIndex: "published_at", render: (t) => t || "—" },
          ]}
        />
      </Card>
    </div>
  );
}
