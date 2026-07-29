import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Alert, Button, Card, Form, Input, Space, Tabs, Typography } from "antd";
import { ApiError, authApi } from "../lib/api";
import { useAuth } from "../lib/auth";
import { DEMO_AUTHOR, DEMO_LEARNER } from "../lib/demoConfig";

type Mode = "login" | "register";

export function LoginPage() {
  const { login, user, loading, refreshMe } = useAuth();
  const nav = useNavigate();
  const [searchParams] = useSearchParams();
  const inviteFromUrl = (searchParams.get("invite") || "").trim();
  const [mode, setMode] = useState<Mode>(inviteFromUrl ? "register" : "login");
  const [loginForm] = Form.useForm();
  const [registerForm] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<{ code: string; org_name?: string } | null>(null);
  const [inviteLinkError, setInviteLinkError] = useState<string | null>(null);
  const [claimingInvite, setClaimingInvite] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      if (user.role === "partner") {
        nav("/partner", { replace: true });
        return;
      }
      nav(user.role === "author" || user.role === "admin" ? "/author" : "/app/courses", { replace: true });
    }
  }, [loading, user, nav]);

  useEffect(() => {
    loginForm.setFieldsValue({
      email: DEMO_LEARNER.email,
      password: DEMO_LEARNER.password,
      camp: DEMO_LEARNER.campId,
    });
    registerForm.setFieldsValue({
      display: "新学员",
    });
  }, [loginForm, registerForm]);

  useEffect(() => {
    if (!inviteFromUrl) {
      setInviteLink(null);
      setInviteLinkError(null);
      return;
    }
    let cancelled = false;
    setClaimingInvite(true);
    setInviteLinkError(null);
    void authApi
      .claimInviteLink(inviteFromUrl)
      .then((res) => {
        if (cancelled) return;
        setInviteLink({ code: res.code, org_name: res.org_name });
        setMode("register");
      })
      .catch((err) => {
        if (cancelled) return;
        setInviteLink(null);
        setInviteLinkError(err instanceof ApiError ? err.message : "邀请链接无效");
      })
      .finally(() => {
        if (!cancelled) setClaimingInvite(false);
      });
    return () => {
      cancelled = true;
    };
  }, [inviteFromUrl]);

  const onLogin = async (values: { email: string; password: string; camp?: string }) => {
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

  const onRegister = async (values: { email: string; password: string; display: string }) => {
    setSubmitting(true);
    setError(null);
    try {
      await authApi.register(values.email.trim(), values.password, (values.display || "").trim() || "学员");
      await refreshMe();
      nav("/app/shop", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "注册失败");
    } finally {
      setSubmitting(false);
    }
  };

  const fill = (kind: "learner" | "author") => {
    setMode("login");
    setError(null);
    if (kind === "learner") {
      loginForm.setFieldsValue({ email: DEMO_LEARNER.email, password: DEMO_LEARNER.password, camp: DEMO_LEARNER.campId });
    } else {
      loginForm.setFieldsValue({ email: DEMO_AUTHOR.email, password: DEMO_AUTHOR.password, camp: DEMO_AUTHOR.campId });
    }
  };

  return (
    <div className="login-page">
      <div className="login-page__glow" aria-hidden="true" />
      <Card className="login-card anim-pop" style={{ width: "100%", maxWidth: 420 }}>
        <Typography.Text type="secondary" style={{ letterSpacing: "0.08em", textTransform: "uppercase", fontSize: 11, fontWeight: 600 }}>
          FDE Learning OS
        </Typography.Text>
        <Typography.Title level={3} style={{ marginTop: 4, marginBottom: 8 }}>
          {mode === "login" ? "登录" : "注册"}
        </Typography.Title>
        <Typography.Paragraph type="secondary" style={{ marginBottom: 16 }}>
          {inviteLink
            ? "机构邀请注册 · 完成注册后自动归属渠道"
            : "自由注册 · 机构渠道请使用邀请链接 · 微信购课"}
        </Typography.Paragraph>

        {inviteLinkError && (
          <Alert type="error" showIcon message={inviteLinkError} style={{ marginBottom: 16 }} />
        )}
        {inviteLink && (
          <Alert
            type="info"
            showIcon
            message={`机构邀请：${inviteLink.org_name || inviteLink.code}`}
            description={`邀请码 ${inviteLink.code} 将在注册成功后自动绑定，不支持注册后再自行填写。`}
            style={{ marginBottom: 16 }}
          />
        )}

        <Tabs
          activeKey={mode}
          onChange={(k) => {
            setMode(k as Mode);
            setError(null);
          }}
          items={[
            { key: "login", label: "登录" },
            { key: "register", label: "注册" },
          ]}
        />

        {mode === "login" ? (
          <Form form={loginForm} layout="vertical" onFinish={(v) => void onLogin(v)}>
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
          <Form form={registerForm} layout="vertical" onFinish={(v) => void onRegister(v)}>
            <Form.Item name="email" label="邮箱" rules={[{ required: true, type: "email" }]}>
              <Input type="email" autoComplete="username" />
            </Form.Item>
            <Form.Item name="password" label="密码" rules={[{ required: true, min: 6, message: "至少 6 位" }]}>
              <Input.Password autoComplete="new-password" />
            </Form.Item>
            <Form.Item name="display" label="显示名" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} />}
            <Button
              type="primary"
              htmlType="submit"
              block
              loading={submitting || claimingInvite}
              disabled={Boolean(inviteFromUrl && !inviteLink && !inviteLinkError)}
            >
              {inviteLink ? "通过机构链接注册" : "注册"}
            </Button>
          </Form>
        )}

        <Space style={{ marginTop: 16 }} wrap>
          <Button onClick={() => fill("learner")}>学员演示账号</Button>
          <Button onClick={() => fill("author")}>教研演示账号</Button>
          <Button type="link" onClick={() => nav("/partner/login")}>
            机构后台
          </Button>
        </Space>
        <Typography.Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0, fontSize: 12 }}>
          {DEMO_LEARNER.email} / {DEMO_LEARNER.password} · 机构链接示例 /login?invite=PARTNER-DEMO
        </Typography.Paragraph>
      </Card>
    </div>
  );
}
