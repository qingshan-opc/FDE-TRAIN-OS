import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Alert,
  Button,
  Checkbox,
  Form,
  Input,
  QRCode,
  Typography,
  message,
} from "antd";
import {
  ArrowRightOutlined,
  BankOutlined,
  LockOutlined,
  MailOutlined,
  ReloadOutlined,
  WechatOutlined,
} from "@ant-design/icons";
import { ApiError, authApi } from "../lib/api";
import { useAuth } from "../lib/auth";
import { BrandLogo } from "../components/BrandLogo";
import { isMobilePhoneUa } from "../lib/device";
import { isWeChatBrowser, sanitizeAppNext, wechatBindOauthUrl, wechatMpEntryUrl } from "../lib/wechat";

type Mode = "email" | "wechat" | "register" | "bind" | "reset";

const REMEMBER_KEY = "fde_login_remember_email";

export function LoginPage() {
  const { login, user, loading, refreshMe, needsWxBind, logout, defaultHome } = useAuth();
  const nav = useNavigate();
  const [searchParams] = useSearchParams();
  const inviteFromUrl = (searchParams.get("invite") || "").trim();
  const forceBind = searchParams.get("bind") === "1";
  const nextFromUrl = sanitizeAppNext(searchParams.get("next"), "");
  const wxForcedOff = searchParams.get("wx") === "off" || searchParams.get("wx") === "err";
  const inWeChat = isWeChatBrowser();
  const onPhone = isMobilePhoneUa();
  const [wxOauthReady, setWxOauthReady] = useState<boolean | null>(() => {
    if (wxForcedOff) return false;
    if (!inWeChat) return false;
    return null;
  });
  const [mode, setMode] = useState<Mode>(() => {
    if (forceBind) return "bind";
    if (wxForcedOff) return "email";
    if (inviteFromUrl) return "register";
    return "email";
  });
  const [loginForm] = Form.useForm();
  const [registerForm] = Form.useForm();
  const [resetForm] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remember, setRemember] = useState(false);
  const [inviteLink, setInviteLink] = useState<{
    code: string;
    kind?: "org" | "learner";
    org_name?: string;
    referrer_name?: string;
  } | null>(null);
  const [inviteLinkError, setInviteLinkError] = useState<string | null>(null);
  const [claimingInvite, setClaimingInvite] = useState(false);
  const [wxContent, setWxContent] = useState<string | null>(null);
  const [wxImg, setWxImg] = useState<string | null>(null);
  const [wxState, setWxState] = useState<string | null>(null);
  const [wxWaiting, setWxWaiting] = useState(false);
  const [wxError, setWxError] = useState<string | null>(null);
  const [bindTicket, setBindTicket] = useState<string | null>(null);
  const [resetTicket, setResetTicket] = useState<string | null>(null);
  const [resetEmail, setResetEmail] = useState("");
  const [resetCodeSent, setResetCodeSent] = useState(false);
  const [resetHint, setResetHint] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);

  const stopPoll = useCallback(() => {
    if (pollRef.current != null) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
    setWxWaiting(false);
  }, []);

  const redirectWeChatBind = useCallback(() => {
    const next = nextFromUrl || defaultHome || "/app/shop";
    window.location.href = wechatBindOauthUrl(next);
  }, [nextFromUrl, defaultHome]);

  const goAfterAuth = useCallback(
    async (role: string, needsBind?: boolean, home?: string | null) => {
      if ((role === "learner" || role === "partner") && needsBind) {
        if (inWeChat && wxOauthReady !== false && !wxForcedOff) {
          redirectWeChatBind();
          return;
        }
        setMode("bind");
        return;
      }
      const dest = nextFromUrl || home || defaultHome || "/app/courses";
      nav(dest, { replace: true });
    },
    [nav, nextFromUrl, defaultHome, inWeChat, wxOauthReady, wxForcedOff, redirectWeChatBind],
  );

  const redirectWeChatInAppLogin = useCallback(() => {
    if (wxForcedOff || wxOauthReady === false) {
      setMode("email");
      setWxError("当前环境未开通微信登录，请用邮箱进入");
      return;
    }
    const next = nextFromUrl || (inviteFromUrl ? "/app/shop" : "/app/courses");
    window.location.href = wechatMpEntryUrl(next, inviteFromUrl || null);
  }, [nextFromUrl, inviteFromUrl, wxForcedOff, wxOauthReady]);

  const startWxLogin = useCallback(async () => {
    setWxError(null);
    setWxContent(null);
    setWxImg(null);
    setWxState(null);
    stopPoll();
    if (inWeChat) {
      redirectWeChatInAppLogin();
      return;
    }
    try {
      const res = await authApi.wechatLoginQr();
      setWxContent(res.qr_content);
      setWxImg(res.qr_url);
      setWxState(res.state);
      setWxWaiting(true);
    } catch (err) {
      setWxError(err instanceof ApiError ? err.message : "无法生成微信登录码");
    }
  }, [stopPoll, inWeChat, redirectWeChatInAppLogin]);

  const startBindQr = useCallback(async () => {
    setWxError(null);
    setWxContent(null);
    setWxImg(null);
    setBindTicket(null);
    stopPoll();
    try {
      const res = await authApi.wechatBindStart();
      if (res.already_bound || res.wx_bound) {
        const me = await refreshMe();
        if (me?.user) nav(me.default_home || defaultHome || "/app/courses", { replace: true });
        return;
      }
      setBindTicket(res.ticket || null);
      setWxContent(res.qr_content || null);
      setWxImg(res.qr_url || null);
      setWxWaiting(true);
    } catch (err) {
      setWxError(err instanceof ApiError ? err.message : "无法生成绑定二维码");
    }
  }, [nav, refreshMe, stopPoll, defaultHome]);

  useEffect(() => {
    if (loading) return;
    if (user && needsWxBind && (user.role === "learner" || user.role === "partner")) {
      if (inWeChat && wxOauthReady === true && !wxForcedOff) {
        redirectWeChatBind();
        return;
      }
      setMode("bind");
      return;
    }
    if (!loading && user && !needsWxBind && mode !== "reset") {
      if (forceBind && (user.role === "learner" || user.role === "partner")) {
        setMode("bind");
        return;
      }
      nav(nextFromUrl || defaultHome || "/app/courses", { replace: true });
    }
  }, [loading, user, needsWxBind, nav, mode, forceBind, defaultHome, nextFromUrl, inWeChat, wxOauthReady, wxForcedOff, redirectWeChatBind]);

  useEffect(() => {
    if (wxForcedOff || !inWeChat) {
      setWxOauthReady(false);
      return;
    }
    let cancelled = false;
    void authApi
      .wechatOauthReady()
      .then((res) => {
        if (cancelled) return;
        setWxOauthReady(!!res.ready);
        if (res.ready && !user && !forceBind && !inviteFromUrl) setMode("wechat");
      })
      .catch(() => {
        if (!cancelled) setWxOauthReady(false);
      });
    return () => {
      cancelled = true;
    };
  }, [inWeChat, wxForcedOff, user, forceBind, inviteFromUrl]);

  useEffect(() => {
    registerForm.setFieldsValue({ display: "新学员" });
  }, [registerForm]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(REMEMBER_KEY);
      if (saved) {
        setRemember(true);
        loginForm.setFieldsValue({ email: saved });
      }
    } catch {
      /* ignore */
    }
  }, [loginForm]);

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
        setInviteLink({
          code: res.code,
          kind: res.kind,
          org_name: res.org_name,
          referrer_name: res.referrer_name,
        });
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

  useEffect(() => {
    if (mode === "wechat" && !user && !loading) {
      if (inWeChat && wxOauthReady !== true) return;
      void startWxLogin();
    } else if (mode === "bind" && user && !loading) {
      if (inWeChat) {
        if (wxOauthReady === true && !wxForcedOff) redirectWeChatBind();
        return;
      }
      if (onPhone) return;
      void startBindQr();
    } else if (mode !== "wechat" && mode !== "bind" && mode !== "reset") {
      stopPoll();
    }
    return () => stopPoll();
  }, [mode, user, loading, startWxLogin, startBindQr, stopPoll, inWeChat, wxOauthReady, wxForcedOff, onPhone, redirectWeChatBind]);

  useEffect(() => {
    if (mode !== "wechat" || !wxWaiting || !wxState) return;
    const tick = async () => {
      try {
        const st = await authApi.wechatLoginStatus(wxState);
        if (st.done) {
          stopPoll();
          const me = await refreshMe();
          if (me?.user) {
            await goAfterAuth(me.user.role, me.needs_wx_bind, me.default_home || st.redirect);
          } else {
            nav(st.redirect || "/app/courses", { replace: true });
          }
          return;
        }
        if (st.expired) {
          stopPoll();
          setWxError("二维码已过期，请点击刷新");
        }
      } catch {
        /* ignore */
      }
    };
    void tick();
    pollRef.current = window.setInterval(() => void tick(), 2000);
    return () => stopPoll();
  }, [mode, wxWaiting, wxState, nav, refreshMe, stopPoll, goAfterAuth]);

  useEffect(() => {
    if (mode !== "bind" || !wxWaiting || !bindTicket) return;
    const tick = async () => {
      try {
        const st = await authApi.wechatBindStatus(bindTicket);
        if (st.done) {
          stopPoll();
          message.success("微信绑定成功");
          const me = await refreshMe();
          if (me?.user) nav(me.default_home || defaultHome || "/app/courses", { replace: true });
          return;
        }
        if (st.expired) {
          stopPoll();
          setWxError("绑定二维码已过期，请点击刷新");
        }
      } catch {
        /* ignore */
      }
    };
    void tick();
    pollRef.current = window.setInterval(() => void tick(), 2000);
    return () => stopPoll();
  }, [mode, wxWaiting, bindTicket, nav, refreshMe, stopPoll]);

  useEffect(() => {
    if (mode !== "reset" || !resetTicket || resetCodeSent) return;
    const tick = async () => {
      try {
        const st = await authApi.passwordResetStatus(resetTicket);
        if (st.code_sent) {
          setResetCodeSent(true);
          message.success("验证码已发送到微信，请查收");
          stopPoll();
          return;
        }
        if (st.expired) {
          stopPoll();
          setWxError("二维码已过期，请重新获取");
        }
      } catch {
        /* ignore */
      }
    };
    void tick();
    pollRef.current = window.setInterval(() => void tick(), 2000);
    return () => stopPoll();
  }, [mode, resetTicket, resetCodeSent, stopPoll]);

  const onLogin = async (values: { email: string; password: string }) => {
    setSubmitting(true);
    setError(null);
    try {
      const email = values.email.trim();
      try {
        if (remember) localStorage.setItem(REMEMBER_KEY, email);
        else localStorage.removeItem(REMEMBER_KEY);
      } catch {
        /* ignore */
      }
      const me = await login(email, values.password, { remember });
      const role = me && "user" in me ? me.user.role : "learner";
      const needs = me && "needs_wx_bind" in me ? Boolean(me.needs_wx_bind) : false;
      const home = me && "default_home" in me ? me.default_home : undefined;
      await goAfterAuth(role, needs, home);
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
      const res = await authApi.register(
        values.email.trim(),
        values.password,
        (values.display || "").trim() || "学员",
      );
      await refreshMe();
      await goAfterAuth(res.user.role, Boolean(res.needs_wx_bind), res.default_home);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "注册失败");
    } finally {
      setSubmitting(false);
    }
  };

  const onResetStart = async (values: { email: string }) => {
    setSubmitting(true);
    setError(null);
    setWxError(null);
    setResetCodeSent(false);
    try {
      const email = values.email.trim().toLowerCase();
      const res = await authApi.passwordResetStart(email);
      setResetEmail(email);
      setResetTicket(res.ticket);
      setWxContent(res.qr_content);
      setWxImg(res.qr_url);
      setResetHint(res.hint || null);
      setWxWaiting(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "无法开始重置");
    } finally {
      setSubmitting(false);
    }
  };

  const onResetConfirm = async (values: { code: string; new_password: string }) => {
    setSubmitting(true);
    setError(null);
    try {
      await authApi.passwordResetConfirm(resetEmail, values.code.trim(), values.new_password);
      message.success("密码已更新，请使用新密码登录");
      setMode("email");
      loginForm.setFieldsValue({ email: resetEmail });
      setResetTicket(null);
      setResetCodeSent(false);
      setWxContent(null);
      setWxImg(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "重置失败");
    } finally {
      setSubmitting(false);
    }
  };

  const cardTitle =
    mode === "wechat"
      ? inWeChat
        ? "微信一键登录"
        : "微信扫码登录"
      : mode === "register"
        ? "创建账号"
        : mode === "bind"
          ? "绑定微信"
          : mode === "reset"
            ? "重置密码"
            : "欢迎回来";
  const cardSubtitle =
    mode === "wechat"
      ? inWeChat
        ? "即将跳转微信授权，无需扫码"
        : "手机微信扫码即可登录"
      : mode === "register"
        ? inviteLink
          ? inviteLink.kind === "learner"
            ? "好友邀请注册 · 完成后计入邀请人"
            : "机构邀请注册 · 完成后自动归属渠道"
          : "注册后需绑定微信"
        : mode === "bind"
          ? inWeChat
            ? "即将弹出微信授权，绑定后即可进入"
            : onPhone
              ? "请在微信中打开本页，将弹出授权完成绑定"
              : "邮箱账号须绑定服务号后才能进入学习中心"
          : mode === "reset"
            ? "扫码后验证码将发送到微信服务号"
            : "登录学习中心，继续你的课程";

  return (
    <div className="login-split">
      <aside className="login-split__hero">
        <div className="login-split__hero-bg" />
        <div className="login-split__hero-overlay" />
        <div className="login-split__hero-top">
          <BrandLogo name="青山在" to="/" variant="light" className="login-split__brand-logo" />
          <p className="login-split__tagline">数字化人才训练 · 可验收交付</p>
        </div>
        <p className="login-split__hero-foot">进入青山在学习中心，完成训练营课程与实践任务。</p>
      </aside>

      <main className="login-split__panel">
        <div className="login-split__card anim-pop">
          <header className="login-split__card-head">
            <h2>{cardTitle}</h2>
            <p>{cardSubtitle}</p>
          </header>

          {inWeChat && wxOauthReady === false && mode === "email" && (
            <Alert
              type="info"
              showIcon
              message="微信登录未开通"
              description="本机调试环境没有公众号授权。用演示邮箱登录即可继续看选购页。"
              style={{ marginBottom: 12 }}
            />
          )}
          {inviteLink && mode === "register" && (
            <Alert
              type="info"
              showIcon
              message={
                inviteLink.kind === "learner"
                  ? `好友邀请：${inviteLink.referrer_name || inviteLink.code}`
                  : `机构邀请：${inviteLink.org_name || inviteLink.code}`
              }
              style={{ marginBottom: 12 }}
            />
          )}

          {mode === "email" && (
            <>
              <Form
                form={loginForm}
                layout="vertical"
                className="login-split__form"
                requiredMark={false}
                onFinish={(v) => void onLogin(v)}
              >
                <Form.Item
                  name="email"
                  label="邮箱地址"
                  rules={[
                    { required: true, message: "请输入邮箱" },
                    { type: "email", message: "邮箱格式不正确" },
                  ]}
                >
                  <Input
                    size="large"
                    prefix={<MailOutlined />}
                    placeholder="name@example.com"
                    autoComplete="username"
                  />
                </Form.Item>
                <Form.Item name="password" label="密码" rules={[{ required: true, message: "请输入密码" }]}>
                  <Input.Password
                    size="large"
                    prefix={<LockOutlined />}
                    placeholder="••••••••"
                    autoComplete="current-password"
                  />
                </Form.Item>

                <div className="login-split__row">
                  <Checkbox checked={remember} onChange={(e) => setRemember(e.target.checked)}>
                    记住我
                  </Checkbox>
                  <button
                    type="button"
                    className="login-split__link"
                    onClick={() => {
                      setError(null);
                      setWxError(null);
                      setResetTicket(null);
                      setResetCodeSent(false);
                      setMode("reset");
                    }}
                  >
                    忘记密码？
                  </button>
                </div>

                {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 12 }} />}

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

              <div className="login-split__divider">
                <span>或通过以下方式继续</span>
              </div>

              <div className="login-split__sso">
                <button
                  type="button"
                  className="login-split__sso-btn"
                  onClick={() => {
                    setError(null);
                    setWxError(null);
                    if (inWeChat) {
                      redirectWeChatInAppLogin();
                      return;
                    }
                    setMode("wechat");
                  }}
                >
                  <WechatOutlined style={{ color: "#07c160", fontSize: 18 }} />
                  微信
                </button>
                <button type="button" className="login-split__sso-btn" onClick={() => nav("/partner/login")}>
                  <BankOutlined style={{ fontSize: 16 }} />
                  机构后台
                </button>
              </div>

              <div className="login-split__switch">
                还没有账号？
                <button
                  type="button"
                  className="login-split__link"
                  onClick={() => {
                    setError(null);
                    setMode("register");
                  }}
                >
                  立即注册
                </button>
              </div>
            </>
          )}

          {(mode === "wechat" || mode === "bind" || (mode === "reset" && resetTicket && !resetCodeSent)) && (
            <div className="login-split__wx">
              {mode === "wechat" && inWeChat ? (
                <>
                  <Alert
                    type="info"
                    showIcon
                    message="检测到微信内打开"
                    description="将直接唤起微信授权登录，无需再扫码。"
                    style={{ width: "100%", marginBottom: 12 }}
                  />
                  <Button
                    type="primary"
                    block
                    size="large"
                    className="login-split__submit"
                    icon={<WechatOutlined />}
                    onClick={() => redirectWeChatInAppLogin()}
                  >
                    微信一键登录
                  </Button>
                </>
              ) : mode === "bind" && (inWeChat || onPhone) ? (
                <>
                  <Alert
                    type="info"
                    showIcon
                    message={inWeChat ? "绑定当前微信" : "请在微信中打开"}
                    description={
                      inWeChat
                        ? "点击下方按钮弹出微信授权，绑定后即可进入，无需扫码。"
                        : "手机浏览器无法弹出公众号授权。请用微信打开本页，未绑定会自动弹出授权。"
                    }
                    style={{ width: "100%", marginBottom: 12 }}
                  />
                  {inWeChat ? (
                    <Button
                      type="primary"
                      block
                      size="large"
                      className="login-split__submit"
                      icon={<WechatOutlined />}
                      onClick={() => redirectWeChatBind()}
                    >
                      授权绑定微信
                    </Button>
                  ) : null}
                </>
              ) : (
                <>
                  {wxContent ? (
                    <QRCode value={wxContent} size={168} />
                  ) : wxImg ? (
                    <img src={wxImg} alt="微信二维码" width={168} height={168} />
                  ) : (
                    <Typography.Text type="secondary">正在生成二维码…</Typography.Text>
                  )}
                  <Typography.Text type="secondary" className="login-split__wx-hint">
                    {mode === "bind"
                      ? "请用微信扫码关注服务号完成绑定"
                      : mode === "reset"
                        ? resetHint || "请用已绑定该账号的微信扫码收取验证码"
                        : "请用手机微信扫码登录"}
                  </Typography.Text>
                  {wxWaiting && mode !== "reset" && (
                    <Typography.Text type="secondary">等待手机确认…</Typography.Text>
                  )}
                </>
              )}
              {wxError && <Alert type="warning" showIcon message={wxError} style={{ width: "100%" }} />}
              <div className="login-split__wx-actions">
                {mode === "bind" && (inWeChat || onPhone)
                  ? null
                  : !(mode === "wechat" && inWeChat) && (
                      <button
                        type="button"
                        className="login-split__sso-btn"
                        onClick={() => {
                          if (mode === "bind") void startBindQr();
                          else if (mode === "reset") void onResetStart({ email: resetEmail });
                          else void startWxLogin();
                        }}
                      >
                        <ReloadOutlined />
                        刷新二维码
                      </button>
                    )}
                {mode === "bind" ? (
                  <button
                    type="button"
                    className="login-split__link"
                    onClick={() => {
                      void logout();
                      setMode("email");
                    }}
                  >
                    退出并换账号
                  </button>
                ) : (
                  <button
                    type="button"
                    className="login-split__link"
                    onClick={() => {
                      setWxError(null);
                      setMode("email");
                    }}
                  >
                    返回邮箱登录
                  </button>
                )}
              </div>
            </div>
          )}

          {mode === "reset" && !resetTicket && (
            <Form
              form={resetForm}
              layout="vertical"
              className="login-split__form"
              requiredMark={false}
              onFinish={(v) => void onResetStart(v)}
            >
              <Form.Item
                name="email"
                label="注册邮箱"
                rules={[
                  { required: true, message: "请输入邮箱" },
                  { type: "email", message: "邮箱格式不正确" },
                ]}
              >
                <Input size="large" prefix={<MailOutlined />} placeholder="name@example.com" />
              </Form.Item>
              {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 12 }} />}
              <Button type="primary" htmlType="submit" block size="large" className="login-split__submit" loading={submitting}>
                获取验证码二维码
              </Button>
              <div className="login-split__switch">
                <button type="button" className="login-split__link" onClick={() => setMode("email")}>
                  返回登录
                </button>
              </div>
            </Form>
          )}

          {mode === "reset" && resetCodeSent && (
            <Form
              layout="vertical"
              className="login-split__form"
              requiredMark={false}
              onFinish={(v) => void onResetConfirm(v)}
            >
              <Form.Item name="code" label="微信验证码" rules={[{ required: true, message: "请输入验证码" }]}>
                <Input size="large" placeholder="6 位数字" maxLength={8} />
              </Form.Item>
              <Form.Item
                name="new_password"
                label="新密码"
                rules={[{ required: true, min: 6, message: "至少 6 位" }]}
              >
                <Input.Password size="large" prefix={<LockOutlined />} autoComplete="new-password" />
              </Form.Item>
              {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 12 }} />}
              <Button type="primary" htmlType="submit" block size="large" className="login-split__submit" loading={submitting}>
                确认重置
              </Button>
              <div className="login-split__switch">
                <button
                  type="button"
                  className="login-split__link"
                  onClick={() => {
                    setResetCodeSent(false);
                    setResetTicket(null);
                    setMode("email");
                  }}
                >
                  返回登录
                </button>
              </div>
            </Form>
          )}

          {mode === "register" && (
            <>
              <Form
                form={registerForm}
                layout="vertical"
                className="login-split__form"
                requiredMark={false}
                onFinish={(v) => void onRegister(v)}
              >
                <Form.Item
                  name="email"
                  label="邮箱地址"
                  rules={[{ required: true, type: "email", message: "请输入有效邮箱" }]}
                >
                  <Input size="large" prefix={<MailOutlined />} type="email" autoComplete="username" />
                </Form.Item>
                <Form.Item
                  name="password"
                  label="密码"
                  rules={[{ required: true, min: 6, message: "至少 6 位" }]}
                >
                  <Input.Password size="large" prefix={<LockOutlined />} autoComplete="new-password" />
                </Form.Item>
                <Form.Item name="display" label="显示名" rules={[{ required: true, message: "请输入显示名" }]}>
                  <Input size="large" />
                </Form.Item>
                {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 12 }} />}
                <Button
                  type="primary"
                  htmlType="submit"
                  block
                  size="large"
                  className="login-split__submit"
                  loading={submitting || claimingInvite}
                  disabled={Boolean(inviteFromUrl && !inviteLink && !inviteLinkError)}
                  icon={<ArrowRightOutlined />}
                  iconPosition="end"
                >
                  {inviteLink
                    ? inviteLink.kind === "learner"
                      ? "通过好友邀请注册"
                      : "通过机构链接注册"
                    : "注册"}
                </Button>
              </Form>
              <div className="login-split__switch">
                已有账号？
                <button
                  type="button"
                  className="login-split__link"
                  onClick={() => {
                    setError(null);
                    setMode("email");
                  }}
                >
                  返回登录
                </button>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
