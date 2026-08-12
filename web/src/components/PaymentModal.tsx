import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Alert, Button, Modal, QRCode, Segmented, Space, Typography } from "antd";
import { AlipayCircleOutlined, WechatOutlined } from "@ant-design/icons";
import { billingApi, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { isWeChatBrowser } from "../lib/wechat";

export type PayChannel = "wechat" | "alipay";

/** Temporary allowlist while Alipay is soft-hidden for everyone else. */
const ALIPAY_VISIBLE_EMAILS = new Set(["partner@fde.local"]);

type JsapiParams = {
  appId: string;
  timeStamp: string;
  nonceStr: string;
  package: string;
  signType: string;
  paySign: string;
};

type Props = {
  open: boolean;
  offeringId: string | null;
  amountFen: number;
  onClose: () => void;
  onPaid: () => void;
};

const CHANNEL_LABEL: Record<PayChannel, string> = {
  wechat: "微信支付",
  alipay: "支付宝",
};

function invokeWxJsapiPay(params: JsapiParams): Promise<"ok" | "cancel" | "fail"> {
  type Bridge = {
    invoke: (
      method: string,
      payload: Record<string, string>,
      cb: (res: { err_msg?: string }) => void,
    ) => void;
  };
  const w = window as Window & { WeixinJSBridge?: Bridge };
  const run = (bridge: Bridge) =>
    new Promise<"ok" | "cancel" | "fail">((resolve) => {
      bridge.invoke(
        "getBrandWCPayRequest",
        {
          appId: params.appId,
          timeStamp: params.timeStamp,
          nonceStr: params.nonceStr,
          package: params.package,
          signType: params.signType,
          paySign: params.paySign,
        },
        (res) => {
          const msg = res?.err_msg || "";
          if (msg === "get_brand_wcpay_request:ok") resolve("ok");
          else if (msg === "get_brand_wcpay_request:cancel") resolve("cancel");
          else resolve("fail");
        },
      );
    });
  if (w.WeixinJSBridge) return run(w.WeixinJSBridge);
  return new Promise((resolve) => {
    const onReady = () => {
      document.removeEventListener("WeixinJSBridgeReady", onReady);
      if (w.WeixinJSBridge) void run(w.WeixinJSBridge).then(resolve);
      else resolve("fail");
    };
    document.addEventListener("WeixinJSBridgeReady", onReady, false);
    window.setTimeout(() => {
      document.removeEventListener("WeixinJSBridgeReady", onReady);
      if (w.WeixinJSBridge) void run(w.WeixinJSBridge).then(resolve);
      else resolve("fail");
    }, 2500);
  });
}

export function PaymentModal({ open, offeringId, amountFen, onClose, onPaid }: Props) {
  const { user } = useAuth();
  const inWeChat = isWeChatBrowser();
  const showAlipay = ALIPAY_VISIBLE_EMAILS.has((user?.email || "").trim().toLowerCase());
  const [channel, setChannel] = useState<PayChannel>("wechat");
  const [orderId, setOrderId] = useState<string | null>(null);
  const [codeUrl, setCodeUrl] = useState<string | null>(null);
  const [payMode, setPayMode] = useState<"native" | "jsapi">("native");
  const [jsapiParams, setJsapiParams] = useState<JsapiParams | null>(null);
  const [devMode, setDevMode] = useState(false);
  const [status, setStatus] = useState<string>("pending");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [devLoading, setDevLoading] = useState(false);
  const [paying, setPaying] = useState(false);
  const [oauthUrl, setOauthUrl] = useState<string | null>(null);
  const timer = useRef<number | null>(null);
  const autoInvoked = useRef(false);

  const channelOptions = useMemo(() => {
    const opts: Array<{ label: ReactNode; value: PayChannel; disabled?: boolean }> = [
      {
        label: (
          <span>
            <WechatOutlined style={{ color: "#07c160", marginRight: 6 }} />
            微信
          </span>
        ),
        value: "wechat",
      },
    ];
    if (showAlipay) {
      opts.push({
        label: (
          <span>
            <AlipayCircleOutlined style={{ color: "#1677ff", marginRight: 6 }} />
            支付宝
          </span>
        ),
        value: "alipay",
        disabled: inWeChat,
      });
    }
    return opts;
  }, [showAlipay, inWeChat]);

  useEffect(() => {
    if (!showAlipay && channel === "alipay") setChannel("wechat");
  }, [showAlipay, channel]);

  // Reset + create order when modal opens or channel changes
  useEffect(() => {
    if (!open || !offeringId) return;
    const activeChannel: PayChannel = showAlipay ? channel : "wechat";
    let cancelled = false;
    autoInvoked.current = false;
    setStatus("pending");
    setError(null);
    setOrderId(null);
    setCodeUrl(null);
    setJsapiParams(null);
    setOauthUrl(null);
    setPayMode(inWeChat && activeChannel === "wechat" ? "jsapi" : "native");
    setDevMode(false);
    setLoading(true);
    void (async () => {
      try {
        const mode = inWeChat && activeChannel === "wechat" ? "jsapi" : "native";
        const res = await billingApi.checkout(offeringId, activeChannel, mode);
        if (cancelled) return;
        setOrderId(res.order_id);
        setCodeUrl(res.code_url || null);
        setPayMode((res.pay_mode as "native" | "jsapi") || mode);
        setJsapiParams(res.jsapi_params || null);
        setDevMode(!!res.dev_mode);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError) {
          const detail = (err.body as { detail?: unknown } | null)?.detail;
          if (detail && typeof detail === "object" && detail !== null && "code" in detail) {
            const d = detail as { code?: string; message?: string; oauth_url?: string };
            if (d.code === "need_wechat_oauth") {
              setOauthUrl(d.oauth_url || "/api/v1/auth/wechat/mp-entry?next=%2Fapp%2Fshop");
              setError(d.message || "请先完成微信授权后再支付");
              return;
            }
          }
          setError(err.message);
        } else {
          setError("下单失败");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, offeringId, channel, inWeChat, showAlipay]);

  useEffect(() => {
    if (!open || !orderId) return;
    const poll = async () => {
      try {
        const res = await billingApi.syncOrder(orderId);
        setStatus(res.status);
        if (res.status === "paid") {
          onPaid();
        }
      } catch {
        /* ignore transient */
      }
    };
    void poll();
    timer.current = window.setInterval(() => void poll(), 2500);
    return () => {
      if (timer.current) window.clearInterval(timer.current);
    };
  }, [open, orderId, onPaid]);

  const launchJsapi = async () => {
    if (!jsapiParams || paying) return;
    if (devMode) {
      setError("开发模式：未配置真实微信支付，请用模拟支付");
      return;
    }
    setPaying(true);
    setError(null);
    try {
      const result = await invokeWxJsapiPay(jsapiParams);
      if (result === "ok") {
        setStatus("paid");
        onPaid();
      } else if (result === "cancel") {
        setError("已取消支付，可再次点击下方按钮继续");
      } else {
        setError("调起微信支付失败，请重试或改用电脑端扫码");
      }
    } finally {
      setPaying(false);
    }
  };

  // Auto-invoke once when JSAPI params are ready (WeChat in-app).
  useEffect(() => {
    if (!open || loading || !jsapiParams || payMode !== "jsapi" || status === "paid") return;
    if (autoInvoked.current) return;
    autoInvoked.current = true;
    void launchJsapi();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, loading, jsapiParams, payMode, status]);

  const onDevPay = async () => {
    if (!orderId) return;
    setDevLoading(true);
    try {
      await billingApi.devMarkPaid(orderId);
      setStatus("paid");
      onPaid();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "模拟支付失败");
    } finally {
      setDevLoading(false);
    }
  };

  const yuan = (amountFen / 100).toFixed(2);
  const tip =
    channel === "alipay"
      ? inWeChat
        ? "微信内无法直接打开支付宝，请用另一部手机支付宝扫码，或在系统浏览器打开本页"
        : "请使用支付宝扫一扫完成支付"
      : payMode === "jsapi"
        ? "正在调起微信支付…"
        : "请使用微信扫一扫完成支付";

  return (
    <Modal
      open={open}
      title={payMode === "jsapi" ? "微信支付" : "扫码支付"}
      onCancel={onClose}
      footer={null}
      width={440}
      destroyOnClose
    >
      <Typography.Paragraph>
        应付金额：<strong>¥{yuan}</strong>
      </Typography.Paragraph>
      {showAlipay ? (
        <Segmented
          block
          value={channel}
          onChange={(v) => setChannel(v as PayChannel)}
          options={channelOptions}
          style={{ marginBottom: 16 }}
        />
      ) : null}
      {inWeChat && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          message="检测到微信内打开：将直接调起微信支付，无需再扫码"
        />
      )}
      {error && <Alert type="error" message={error} showIcon style={{ marginBottom: 12 }} />}
      {oauthUrl && (
        <Button
          type="primary"
          block
          style={{ marginBottom: 12 }}
          onClick={() => {
            window.location.href = oauthUrl;
          }}
        >
          去微信授权后支付
        </Button>
      )}
      {status === "paid" ? (
        <Alert type="success" message="支付成功，正在刷新课程…" showIcon />
      ) : loading ? (
        <Alert
          type="info"
          message={
            payMode === "jsapi"
              ? "正在准备微信支付…"
              : `正在生成${CHANNEL_LABEL[channel]}收款码…`
          }
          showIcon
        />
      ) : devMode ? (
        <Space direction="vertical" style={{ width: "100%" }}>
          <Alert
            type="info"
            message={`开发模式：${CHANNEL_LABEL[channel]}未配置，可点击下方模拟支付`}
            showIcon
          />
          <Button type="primary" block loading={devLoading} onClick={() => void onDevPay()}>
            模拟支付成功
          </Button>
        </Space>
      ) : payMode === "jsapi" && jsapiParams ? (
        <Space direction="vertical" style={{ width: "100%" }}>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0, textAlign: "center" }}>
            {tip}
          </Typography.Paragraph>
          <Button type="primary" block loading={paying} onClick={() => void launchJsapi()}>
            {paying ? "调起支付中…" : "立即支付"}
          </Button>
        </Space>
      ) : codeUrl && !codeUrl.startsWith("dev://") && !codeUrl.startsWith("jsapi:") ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            width: "100%",
          }}
        >
          <QRCode value={codeUrl} size={220} style={{ margin: "0 auto" }} />
          <Typography.Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0, textAlign: "center" }}>
            {tip}
          </Typography.Paragraph>
        </div>
      ) : (
        <Alert type="warning" message="无法发起支付，请稍后重试" showIcon />
      )}
      {status === "pending" && !devMode && !loading && (
        <Typography.Paragraph
          type="secondary"
          style={{ marginTop: 12, marginBottom: 0, fontSize: 12, textAlign: "center" }}
        >
          支付完成后将自动刷新，请勿关闭此窗口
        </Typography.Paragraph>
      )}
    </Modal>
  );
}
