import { useCallback, useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { Alert, Button, Form, Input, QRCode, Space, Typography, message } from "antd";
import { ApiError, partnerApi } from "../lib/api";
import { useAuth } from "../lib/auth";
import { BrandLogo } from "../components/BrandLogo";
import { isWeChatBrowser, wechatMpEntryUrl } from "../lib/wechat";

export function PartnerActivatePage() {
  const nav = useNavigate();
  const { user, loading, refreshMe, portals } = useAuth();
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [entryUrl, setEntryUrl] = useState<string | null>(null);
  const inWeChat = isWeChatBrowser();

  const hasPartner = (portals || []).some((p) => p.kind === "partner");

  useEffect(() => {
    void partnerApi
      .activateEntry()
      .then((res) => setEntryUrl(res.entry_url))
      .catch(() => {
        setEntryUrl(wechatMpEntryUrl("/partner/activate"));
      });
  }, []);

  useEffect(() => {
    if (loading || user || !inWeChat) return;
    window.location.href = wechatMpEntryUrl("/partner/activate");
  }, [loading, user, inWeChat]);

  const onFinish = useCallback(
    async (values: { code: string; org_name?: string }) => {
      setSubmitting(true);
      setError(null);
      try {
        await partnerApi.activate(values.code.trim(), values.org_name?.trim() || undefined);
        await refreshMe();
        message.success("机构已开通");
        nav("/partner", { replace: true });
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "开通失败");
      } finally {
        setSubmitting(false);
      }
    },
    [nav, refreshMe],
  );

  if (!loading && user && hasPartner) {
    return <Navigate to="/partner" replace />;
  }

  return (
    <div className="login-split">
      <aside className="login-split__hero">
        <div className="login-split__hero-bg" />
        <div className="login-split__hero-overlay" />
        <div className="login-split__hero-top">
          <BrandLogo name="青山在" to="/" variant="light" className="login-split__brand-logo" />
          <p className="login-split__tagline">机构平台开通</p>
        </div>
        <p className="login-split__hero-foot">输入运营发给你的开通码，当前微信即可成为机构账号。</p>
      </aside>

      <main className="login-split__panel">
        <div className="login-split__card anim-pop">
          <header className="login-split__card-head">
            <h2>{user ? "输入开通码" : "微信扫码开通"}</h2>
            <p>
              {user
                ? "开通后可生成课程海报、查看渠道数据与分账。"
                : inWeChat
                  ? "正在跳转微信授权…"
                  : "请用手机微信扫描下方二维码"}
            </p>
          </header>

          {!user && !inWeChat && (
            <div className="login-split__wx" style={{ marginTop: 16 }}>
              {entryUrl ? (
                <QRCode value={entryUrl} size={180} />
              ) : (
                <Typography.Text type="secondary">加载二维码…</Typography.Text>
              )}
              <Typography.Paragraph type="secondary" style={{ textAlign: "center", marginBottom: 0 }}>
                扫码后登录，再输入开通码完成注册
              </Typography.Paragraph>
              {entryUrl ? (
                <Typography.Paragraph copyable={{ text: entryUrl }} style={{ fontSize: 12, wordBreak: "break-all" }}>
                  {entryUrl}
                </Typography.Paragraph>
              ) : null}
            </div>
          )}

          {user && (
            <Form
              form={form}
              layout="vertical"
              className="login-split__form"
              requiredMark={false}
              onFinish={(v) => void onFinish(v)}
              style={{ marginTop: 16 }}
            >
              <Form.Item
                name="code"
                label="开通码"
                rules={[{ required: true, message: "请输入开通码" }]}
              >
                <Input size="large" className="mono" placeholder="运营发给你的 8 位码" autoComplete="off" />
              </Form.Item>
              <Form.Item name="org_name" label="机构名称（可选）">
                <Input size="large" placeholder="默认用微信昵称" />
              </Form.Item>
              {error && <Alert type="error" message={error} showIcon style={{ marginBottom: 12 }} />}
              <Button type="primary" htmlType="submit" block size="large" loading={submitting}>
                开通机构账号
              </Button>
            </Form>
          )}

          <div className="login-split__switch">
            <Space direction="vertical" size={4} style={{ width: "100%" }}>
              <Link to="/partner/login" className="login-split__link">
                已有机构？去登录
              </Link>
              <Link to="/login" className="login-split__link">
                返回学员登录
              </Link>
            </Space>
          </div>
        </div>
      </main>
    </div>
  );
}
