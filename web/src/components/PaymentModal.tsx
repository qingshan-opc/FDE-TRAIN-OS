import { useEffect, useRef, useState } from "react";
import { Alert, Button, Modal, QRCode, Segmented, Space, Typography } from "antd";
import { AlipayCircleOutlined, WechatOutlined } from "@ant-design/icons";
import { billingApi, ApiError } from "../lib/api";

export type PayChannel = "wechat" | "alipay";

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

export function PaymentModal({ open, offeringId, amountFen, onClose, onPaid }: Props) {
  const [channel, setChannel] = useState<PayChannel>("wechat");
  const [orderId, setOrderId] = useState<string | null>(null);
  const [codeUrl, setCodeUrl] = useState<string | null>(null);
  const [devMode, setDevMode] = useState(false);
  const [status, setStatus] = useState<string>("pending");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [devLoading, setDevLoading] = useState(false);
  const timer = useRef<number | null>(null);

  // Reset + create order when modal opens or channel changes
  useEffect(() => {
    if (!open || !offeringId) return;
    let cancelled = false;
    setStatus("pending");
    setError(null);
    setOrderId(null);
    setCodeUrl(null);
    setDevMode(false);
    setLoading(true);
    void (async () => {
      try {
        const res = await billingApi.checkout(offeringId, channel);
        if (cancelled) return;
        setOrderId(res.order_id);
        setCodeUrl(res.code_url || null);
        setDevMode(!!res.dev_mode);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : "下单失败");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, offeringId, channel]);

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
    channel === "alipay" ? "请使用支付宝扫一扫完成支付" : "请使用微信扫一扫完成支付";

  return (
    <Modal
      open={open}
      title="扫码支付"
      onCancel={onClose}
      footer={null}
      width={440}
      destroyOnClose
    >
      <Typography.Paragraph>
        应付金额：<strong>¥{yuan}</strong>
      </Typography.Paragraph>
      <Segmented
        block
        value={channel}
        onChange={(v) => setChannel(v as PayChannel)}
        options={[
          {
            label: (
              <span>
                <WechatOutlined style={{ color: "#07c160", marginRight: 6 }} />
                微信
              </span>
            ),
            value: "wechat",
          },
          {
            label: (
              <span>
                <AlipayCircleOutlined style={{ color: "#1677ff", marginRight: 6 }} />
                支付宝
              </span>
            ),
            value: "alipay",
          },
        ]}
        style={{ marginBottom: 16 }}
      />
      {error && <Alert type="error" message={error} showIcon style={{ marginBottom: 12 }} />}
      {status === "paid" ? (
        <Alert type="success" message="支付成功，正在刷新课程…" showIcon />
      ) : loading ? (
        <Alert type="info" message={`正在生成${CHANNEL_LABEL[channel]}收款码…`} showIcon />
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
      ) : codeUrl && !codeUrl.startsWith("dev://") ? (
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
        <Alert type="warning" message="无法生成支付二维码" showIcon />
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
