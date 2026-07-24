import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Alert, Button, Card, Form, Input, Space, Tabs, Typography, theme } from "antd";
import { ApiError, authApi } from "../lib/api";
import { useAuth } from "../lib/auth";

type Mode = "password" | "invite";

export function LoginPage() {
  const { login, user, loading, refreshMe } = useAuth();
  const nav = useNavigate();
  const { token } = theme.useToken();
  const [mode, setMode] = useState<Mode>("password");
  const [passwordForm] = Form.useForm();
  const [inviteForm] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && user) {
      nav(user.role === "author" || user.role === "admin" ? "/author" : "/app/courses", { replace: true });
    }
  }, [loading, user, nav]);

  useEffect(() => {
    passwordForm.setFieldsValue({
      email: "demo@fde.local",
      password: "demo1234",
      camp: "camp-v03",
    });
    inviteForm.setFieldsValue({
      invite: "FDE-DEMO",
      display: "学员",
      "invite-email": "",
    });
  }, [passwordForm, inviteForm]);

  const onPassword = async (values: { email: string; password: string; camp?: string }) => {
    setSubmitting(true);
    setError(null);
    try {
      await login(values.email.trim(), values.password, (values.camp || "").trim() || undefined);
      const roleHint = values.email.toLowerCase().includes("author") ? "/author" : "/app/courses";
      nav(roleHint, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "登录失败");
    } finally {
      setSubmitting(false);
    }
  };

  const onInvite = async (values: { invite: string; display: string; "invite-email"?: string }) => {
    setSubmitting(true);
    setError(null);
    try {
      await authApi.invite(
        values.invite.trim(),
        (values.display || "").trim() || "学员",
        (values["invite-email"] || "").trim() || undefined,
      );
      await refreshMe();
      nav("/app/courses", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "邀请码无效");
    } finally {
      setSubmitting(false);
    }
  };

  const fill = (kind: "learner" | "author") => {
    setMode("password");
    setError(null);
    if (kind === "learner") {
      passwordForm.setFieldsValue({ email: "demo@fde.local", password: "demo1234", camp: "camp-v03" });
    } else {
      passwordForm.setFieldsValue({ email: "author@fde.local", password: "author1234", camp: "camp-v03" });
    }
  };

  return (
    <div
      className="login-page"
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        background: `linear-gradient(160deg, ${token.colorBgLayout} 0%, #e6fffa 45%, ${token.colorBgLayout} 100%)`,
      }}
    >
      <Card style={{ width: "100%", maxWidth: 420, boxShadow: token.boxShadowSecondary }}>
        <Typography.Text type="secondary" style={{ letterSpacing: "0.04em" }}>
          FDE Learning OS
        </Typography.Text>
        <Typography.Title level={3} style={{ marginTop: 4, marginBottom: 8 }}>
          登录
        </Typography.Title>
        <Typography.Paragraph type="secondary" style={{ marginBottom: 16 }}>
          两周课学员 / 教研工作台 · Cookie 会话
        </Typography.Paragraph>

        <Tabs
          activeKey={mode}
          onChange={(k) => {
            setMode(k as Mode);
            setError(null);
          }}
          items={[
            { key: "password", label: "账号密码" },
            { key: "invite", label: "邀请码" },
          ]}
        />

        {mode === "password" ? (
          <Form form={passwordForm} layout="vertical" onFinish={(v) => void onPassword(v)}>
            <Form.Item
              name="email"
              label="邮箱"
              rules={[{ required: true, message: "请输入邮箱" }, { type: "email", message: "邮箱格式不正确" }]}
            >
              <Input id="email" type="email" autoComplete="username" />
            </Form.Item>
            <Form.Item name="password" label="密码" rules={[{ required: true, message: "请输入密码" }]}>
              <Input.Password id="password" autoComplete="current-password" />
            </Form.Item>
            <Form.Item name="camp" label="营期 ID（可选）">
              <Input id="camp" className="mono" />
            </Form.Item>
            {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} />}
            <Button type="primary" htmlType="submit" block loading={submitting}>
              登录
            </Button>
          </Form>
        ) : (
          <Form form={inviteForm} layout="vertical" onFinish={(v) => void onInvite(v)}>
            <Form.Item name="invite" label="邀请码" rules={[{ required: true, message: "请输入邀请码" }]}>
              <Input id="invite" className="mono" />
            </Form.Item>
            <Form.Item name="display" label="显示名" rules={[{ required: true, message: "请输入显示名" }]}>
              <Input id="display" />
            </Form.Item>
            <Form.Item name="invite-email" label="邮箱（可选）" rules={[{ type: "email", message: "邮箱格式不正确" }]}>
              <Input id="invite-email" type="email" placeholder="不填则自动生成" />
            </Form.Item>
            {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} />}
            <Button type="primary" htmlType="submit" block loading={submitting}>
              用邀请码进入
            </Button>
          </Form>
        )}

        <Space style={{ marginTop: 16 }} wrap>
          <Button onClick={() => fill("learner")}>学员演示账号</Button>
          <Button onClick={() => fill("author")}>教研演示账号</Button>
        </Space>
        <Typography.Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0, fontSize: 12 }}>
          demo@fde.local / demo1234 · 邀请码 FDE-DEMO（以 seed 为准）
        </Typography.Paragraph>
      </Card>
    </div>
  );
}
