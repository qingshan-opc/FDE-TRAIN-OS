import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Alert, Button, Card, Form, Input, QRCode, Tabs, Typography } from "antd";
import { ApiError, authApi, partnerApi } from "../lib/api";
import { useAuth } from "../lib/auth";

type Mode = "wechat" | "email";

export function PartnerLoginPage() {
  const nav = useNavigate();
  const { user, loading, refreshMe } = useAuth();
  const [form] = Form.useForm();
  const [mode, setMode] = useState<Mode>("wechat");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wxContent, setWxContent] = useState<string | null>(null);
  const [wxState, setWxState] = useState<string | null>(null);
  const [wxWaiting, setWxWaiting] = useState(false);
  const [wxError, setWxError] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);

  const stopWxPoll = useCallback(() => {
    if (pollRef.current != null) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
    setWxWaiting(false);
  }, []);

  const startWxLogin = useCallback(async () => {
    setWxError(null);
    setWxContent(null);
    setWxState(null);
    stopWxPoll();
    try {
      const res = await authApi.wechatLoginQr();
      setWxContent(res.qr_content);
      setWxState(res.state);
      setWxWaiting(true);
    } catch (err) {
      setWxError(err instanceof ApiError ? err.message : "无法生成微信登录码");
    }
  }, [stopWxPoll]);

  useEffect(() => {
    if (!loading && user?.role === "partner") {
      nav("/partner", { replace: true });
    }
  }, [loading, user, nav]);

  useEffect(() => {
    if (mode === "wechat" && !user && !loading) void startWxLogin();
    else stopWxPoll();
    return () => stopWxPoll();
  }, [mode, user, loading, startWxLogin, stopWxPoll]);

  useEffect(() => {
    if (mode !== "wechat" || !wxWaiting || !wxState) return;
    const tick = async () => {
      try {
        const st = await authApi.wechatLoginStatus(wxState, { expect_role: "partner" });
        if (st.error) {
          stopWxPoll();
          setWxError(st.error);
          return;
        }
        if (st.done) {
          stopWxPoll();
          await refreshMe();
          nav(st.redirect || "/partner", { replace: true });
          return;
        }
        if (st.expired) {
          stopWxPoll();
          setWxError("二维码已过期，请刷新");
        }
      } catch {
        /* ignore */
      }
    };
    void tick();
    pollRef.current = window.setInterval(() => void tick(), 2000);
    return () => stopWxPoll();
  }, [mode, wxWaiting, wxState, nav, refreshMe, stopWxPoll]);

  const onFinish = async (values: { email: string; password: string }) => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await partnerApi.login(values.email.trim(), values.password);
      await refreshMe();
      const needBind = res.receiver && !res.receiver.bound;
      nav(needBind ? "/partner?bind=1" : "/partner", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "登录失败");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <Card className="login-card" style={{ width: "100%", maxWidth: 420 }}>
        <Typography.Title level={3}>{mode === "wechat" ? "微信登录" : "邮箱登录"}</Typography.Title>
        <Typography.Paragraph type="secondary">
          {mode === "wechat"
            ? "微信扫码关注登录（需已绑定收款微信的机构账号）"
            : "使用机构邮箱与密码登录"}
        </Typography.Paragraph>

        <Tabs
          activeKey={mode}
          onChange={(k) => {
            setMode(k as Mode);
            setError(null);
            setWxError(null);
          }}
          items={[
            { key: "wechat", label: "微信登录" },
            { key: "email", label: "邮箱登录" },
          ]}
        />

        {mode === "wechat" && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            {wxContent ? <QRCode value={wxContent} size={200} /> : <Typography.Text type="secondary">生成登录码…</Typography.Text>}
            {wxWaiting && <Typography.Text type="secondary">等待手机确认…</Typography.Text>}
            {wxError && <Alert type="warning" showIcon message={wxError} style={{ width: "100%" }} />}
            <Button size="small" onClick={() => void startWxLogin()}>
              刷新二维码
            </Button>
          </div>
        )}

        {mode === "email" && (
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
        )}
      </Card>
    </div>
  );
}
