import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Alert, Button, Form, Input, QRCode, Typography } from "antd";
import { ArrowRightOutlined, LockOutlined, MailOutlined, ReloadOutlined, WechatOutlined } from "@ant-design/icons";
import { ApiError, authApi, partnerApi } from "../lib/api";
import { useAuth } from "../lib/auth";
import { BrandLogo } from "../components/BrandLogo";

type Mode = "wechat" | "email";

export function PartnerLoginPage() {
  const nav = useNavigate();
  const { user, loading, refreshMe, portals } = useAuth();
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
    if (loading || !user) return;
    const partnerPath = (portals || []).find((p) => p.kind === "partner")?.path;
    if (partnerPath) nav(partnerPath, { replace: true });
  }, [loading, user, nav, portals]);

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
          const me = await refreshMe();
          const partnerPath = (me?.portals || []).find((p) => p.kind === "partner")?.path;
          nav(st.redirect || partnerPath || "/partner", { replace: true });
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
      const partnerPath = (res.portals || []).find((p) => p.kind === "partner")?.path || "/partner";
      nav(needBind ? "/partner?bind=1" : partnerPath, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "登录失败");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-split">
      <aside className="login-split__hero">
        <div className="login-split__hero-bg" />
        <div className="login-split__hero-overlay" />
        <div className="login-split__hero-top">
          <BrandLogo name="青山在" to="/" variant="light" className="login-split__brand-logo" />
          <p className="login-split__tagline">青山在机构管理后台</p>
        </div>
        <p className="login-split__hero-foot">查看渠道数据、课程海报与分账明细。请使用已开通的机构账号登录。</p>
      </aside>

      <main className="login-split__panel">
        <div className="login-split__card anim-pop">
          <header className="login-split__card-head">
            <h2>{mode === "wechat" ? "微信登录" : "邮箱登录"}</h2>
            <p>
              {mode === "wechat"
                ? "微信扫码关注登录（需已绑定收款微信的机构账号）"
                : "使用机构邮箱与密码登录"}
            </p>
          </header>

          <div className="login-split__sso" style={{ marginTop: 16 }}>
            <button
              type="button"
              className={`login-split__sso-btn${mode === "wechat" ? " is-active" : ""}`}
              onClick={() => {
                setMode("wechat");
                setError(null);
                setWxError(null);
              }}
            >
              <WechatOutlined style={{ color: "#07c160", fontSize: 18 }} />
              微信
            </button>
            <button
              type="button"
              className={`login-split__sso-btn${mode === "email" ? " is-active" : ""}`}
              onClick={() => {
                setMode("email");
                setError(null);
                setWxError(null);
              }}
            >
              <MailOutlined style={{ fontSize: 16 }} />
              邮箱
            </button>
          </div>

          {mode === "wechat" && (
            <div className="login-split__wx">
              {wxContent ? (
                <QRCode value={wxContent} size={168} />
              ) : (
                <Typography.Text type="secondary">生成登录码…</Typography.Text>
              )}
              {wxWaiting && <Typography.Text type="secondary">等待手机确认…</Typography.Text>}
              {wxError && <Alert type="warning" showIcon message={wxError} style={{ width: "100%" }} />}
              <button type="button" className="login-split__sso-btn" onClick={() => void startWxLogin()}>
                <ReloadOutlined />
                刷新二维码
              </button>
            </div>
          )}

          {mode === "email" && (
            <Form form={form} layout="vertical" className="login-split__form" requiredMark={false} onFinish={(v) => void onFinish(v)}>
              <Form.Item name="email" label="邮箱" rules={[{ required: true, type: "email" }]}>
                <Input size="large" prefix={<MailOutlined />} autoComplete="username" />
              </Form.Item>
              <Form.Item name="password" label="密码" rules={[{ required: true }]}>
                <Input.Password size="large" prefix={<LockOutlined />} autoComplete="current-password" />
              </Form.Item>
              {error && <Alert type="error" message={error} showIcon style={{ marginBottom: 12 }} />}
              <Button
                type="primary"
                htmlType="submit"
                block
                size="large"
                className="login-split__submit"
                loading={submitting}
                icon={<ArrowRightOutlined />}
                iconPosition="end"
              >
                登录
              </Button>
            </Form>
          )}

          <div className="login-split__switch">
            <button type="button" className="login-split__link" onClick={() => nav("/login")}>
              返回学员 / 教研登录
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
