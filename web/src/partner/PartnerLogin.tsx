import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Alert, Button, Card, Form, Input, Typography } from "antd";
import { ApiError, partnerApi } from "../lib/api";
import { useAuth } from "../lib/auth";
import { DEMO_PARTNER } from "../lib/demoConfig";

export function PartnerLoginPage() {
  const nav = useNavigate();
  const { user, loading, refreshMe } = useAuth();
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && user?.role === "partner") {
      nav("/partner", { replace: true });
    }
  }, [loading, user, nav]);

  useEffect(() => {
    form.setFieldsValue({ email: DEMO_PARTNER.email, password: DEMO_PARTNER.password });
  }, [form]);

  const onFinish = async (values: { email: string; password: string }) => {
    setSubmitting(true);
    setError(null);
    try {
      await partnerApi.login(values.email.trim(), values.password);
      await refreshMe();
      nav("/partner", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "登录失败");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <Card className="login-card" style={{ width: "100%", maxWidth: 420 }}>
        <Typography.Title level={3}>机构后台登录</Typography.Title>
        <Typography.Paragraph type="secondary">查看拉新与分账数据（只读）</Typography.Paragraph>
        <Form form={form} layout="vertical" onFinish={(v) => void onFinish(v)}>
          <Form.Item name="email" label="邮箱" rules={[{ required: true, type: "email" }]}>
            <Input autoComplete="username" />
          </Form.Item>
          <Form.Item name="password" label="密码" rules={[{ required: true }]}>
            <Input.Password autoComplete="current-password" />
          </Form.Item>
          {error && <Alert type="error" message={error} showIcon style={{ marginBottom: 16 }} />}
          <Button type="primary" htmlType="submit" block loading={submitting}>
            登录
          </Button>
        </Form>
      </Card>
    </div>
  );
}
