import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Alert, Button, Card, Form, Input, QRCode, Tabs, Typography } from "antd";
import { ApiError, authApi } from "../lib/api";
import { useAuth } from "../lib/auth";

type Mode = "wechat" | "email" | "register";

export function LoginPage() {
  const { login, user, loading, refreshMe } = useAuth();
  const nav = useNavigate();
  const [searchParams] = useSearchParams();
  const inviteFromUrl = (searchParams.get("invite") || "").trim();
  const [mode, setMode] = useState<Mode>(inviteFromUrl ? "register" : "wechat");
  const [loginForm] = Form.useForm();
  const [registerForm] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<{ code: string; org_name?: string } | null>(null);
  const [inviteLinkError, setInviteLinkError] = useState<string | null>(null);
  const [claimingInvite, setClaimingInvite] = useState(false);
  const [wxContent, setWxContent] = useState<string | null>(null);
  const [wxImg, setWxImg] = useState<string | null>(null);
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
    setWxImg(null);
    setWxState(null);
    stopWxPoll();
    try {
      const res = await authApi.wechatLoginQr();
      setWxContent(res.qr_content);
      setWxImg(res.qr_url);
      setWxState(res.state);
      setWxWaiting(true);
    } catch (err) {
      setWxError(err instanceof ApiError ? err.message : "无法生成微信登录码");
    }
  }, [stopWxPoll]);

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
    registerForm.setFieldsValue({
      display: "新学员",
    });
  }, [registerForm]);

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

  // Only load / poll WeChat QR on the WeChat tab
  useEffect(() => {
    if (mode === "wechat" && !user && !loading) {
      void startWxLogin();
    } else {
      stopWxPoll();
    }
    return () => stopWxPoll();
  }, [mode, user, loading, startWxLogin, stopWxPoll]);

  useEffect(() => {
    if (mode !== "wechat" || !wxWaiting || !wxState) return;
    const tick = async () => {
      try {
        const st = await authApi.wechatLoginStatus(wxState);
        if (st.done) {
          stopWxPoll();
          await refreshMe();
          nav(st.redirect || "/app/courses", { replace: true });
          return;
        }
        if (st.expired) {
          stopWxPoll();
          setWxError("二维码已过期，请点击刷新");
        }
      } catch {
        /* ignore */
      }
    };
    void tick();
    pollRef.current = window.setInterval(() => void tick(), 2000);
    return () => stopWxPoll();
  }, [mode, wxWaiting, wxState, nav, refreshMe, stopWxPoll]);

  const onLogin = async (values: { email: string; password: string }) => {
    setSubmitting(true);
    setError(null);
    try {
      await login(values.email.trim(), values.password);
      const me = await authApi.me();
      if (me.user.role === "partner") {
        nav("/partner", { replace: true });
      } else if (me.user.role === "author" || me.user.role === "admin") {
        nav("/author", { replace: true });
      } else {
        nav("/app/courses", { replace: true });
      }
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

  const title =
    mode === "wechat" ? "微信登录" : mode === "email" ? "邮箱登录" : "注册";
  const subtitle = inviteLink
    ? "机构邀请注册 · 完成注册后自动归属渠道"
    : mode === "wechat"
      ? "手机微信扫码关注即可登录 · 机构账号自动识别"
      : mode === "email"
        ? "使用邮箱与密码登录"
        : "自由注册 · 机构渠道请使用邀请链接";

  return (
    <div className="login-page">
      <div className="login-page__glow" aria-hidden="true" />
      <Card className="login-card anim-pop" style={{ width: "100%", maxWidth: 420 }}>
        <Typography.Text type="secondary" style={{ letterSpacing: "0.08em", textTransform: "uppercase", fontSize: 11, fontWeight: 600 }}>
          FDE Learning OS
        </Typography.Text>
        <Typography.Title level={3} style={{ marginTop: 4, marginBottom: 8 }}>
          {title}
        </Typography.Title>
        <Typography.Paragraph type="secondary" style={{ marginBottom: 16 }}>
          {subtitle}
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
            setWxError(null);
          }}
          items={[
            { key: "wechat", label: "微信登录" },
            { key: "email", label: "邮箱登录" },
            { key: "register", label: "注册" },
          ]}
        />

        {mode === "wechat" && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, paddingTop: 4 }}>
            {wxContent ? (
              <QRCode value={wxContent} size={200} />
            ) : wxImg ? (
              <img src={wxImg} alt="微信登录码" width={200} height={200} />
            ) : (
              <Typography.Text type="secondary">正在生成微信登录码…</Typography.Text>
            )}
            <Typography.Text type="secondary" style={{ textAlign: "center", fontSize: 13 }}>
              请用手机微信扫码；未关注将先关注公众号，已关注直接确认登录
            </Typography.Text>
            {wxWaiting && <Typography.Text type="secondary">等待手机确认…</Typography.Text>}
            {wxError && <Alert type="warning" showIcon message={wxError} style={{ width: "100%" }} />}
            <Button size="small" onClick={() => void startWxLogin()}>
              刷新二维码
            </Button>
          </div>
        )}

        {mode === "email" && (
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
            {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} />}
            <Button type="primary" htmlType="submit" block loading={submitting}>
              登录
            </Button>
          </Form>
        )}

        {mode === "register" && (
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

        <Button type="link" style={{ marginTop: 12, paddingInline: 0 }} onClick={() => nav("/partner/login")}>
          机构后台
        </Button>
      </Card>
    </div>
  );
}
