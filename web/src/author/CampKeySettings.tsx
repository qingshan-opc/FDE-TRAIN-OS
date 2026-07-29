import { useState } from "react";
import { App, Button, Card, Form, Input, Select, Space, Typography } from "antd";
import { authorApi, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { DEMO_LEARNER } from "../lib/demoConfig";
import { authorSelectPopup, useAuthorLayout } from "../lib/authorLayoutContext";
import { useErrorModal } from "../hooks/useErrorModal";

export function CampKeySettings() {
  const { campId, camps } = useAuth();
  const { getContentPopupContainer } = useAuthorLayout();
  const selectPopup = authorSelectPopup(getContentPopupContainer);
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [masked, setMasked] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const options = (camps.length ? camps : campId ? [{ id: campId, name: campId }] : []).map((c) => ({
    value: c.id,
    label: `${c.name || c.id} (${c.id})`,
  }));

  const save = async (values: { camp_id: string; lingzhi_api_key: string }) => {
    setBusy(true);
    setError(null);
    try {
      const res = await authorApi.setCampKey(values.camp_id, values.lingzhi_api_key || "");
      setMasked(res.masked);
      form.setFieldValue("lingzhi_api_key", "");
      message.success("营期 Key 已更新");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "保存失败");
    } finally {
      setBusy(false);
    }
  };

  useErrorModal(error, { title: "保存失败" });

  return (
    <div>
      <Typography.Title level={3} style={{ marginTop: 0 }}>
        营期 Key
      </Typography.Title>
      <Typography.Paragraph type="secondary">
        配置灵知 API Key（仅存服务端，界面只显示打码）。用于 Memories / RAG。
      </Typography.Paragraph>

      <Card>
        <Form
          form={form}
          layout="vertical"
          initialValues={{ camp_id: campId || camps[0]?.id || DEMO_LEARNER.campId, lingzhi_api_key: "" }}
          onFinish={(v) => void save(v)}
        >
          <Form.Item name="camp_id" label="营期" rules={[{ required: true, message: "请选择营期" }]}>
            <Select options={options} getPopupContainer={selectPopup} />
          </Form.Item>
          <Form.Item name="lingzhi_api_key" label="LINGZHI_API_KEY">
            <Input.Password placeholder="粘贴新 Key；留空可清空" autoComplete="off" />
          </Form.Item>
          {masked && (
            <Typography.Paragraph type="secondary">
              当前打码：<Typography.Text code>{masked}</Typography.Text>
            </Typography.Paragraph>
          )}
          <Space>
            <Button type="primary" htmlType="submit" loading={busy}>
              保存 Key
            </Button>
          </Space>
        </Form>
      </Card>
    </div>
  );
}
