import { useEffect, useRef, useState } from "react";
import { Alert, Button, Modal, QRCode, Space, Typography } from "antd";
import { billingApi, ApiError } from "../lib/api";

type Props = {
  open: boolean;
  orderId: string | null;
  codeUrl: string | null;
  amountFen: number;
  devMode?: boolean;
  onClose: () => void;
  onPaid: () => void;
};

export function PaymentModal({ open, orderId, codeUrl, amountFen, devMode, onClose, onPaid }: Props) {
  const [status, setStatus] = useState<string>("pending");
  const [error, setError] = useState<string | null>(null);
  const [devLoading, setDevLoading] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (!open || !orderId) return;
    setStatus("pending");
    setError(null);
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

  return (
    <Modal open={open} title="微信扫码支付" onCancel={onClose} footer={null} width={420}>
      <Typography.Paragraph>
        应付金额：<strong>¥{yuan}</strong>
      </Typography.Paragraph>
      {error && <Alert type="error" message={error} showIcon style={{ marginBottom: 12 }} />}
      {status === "paid" ? (
        <Alert type="success" message="支付成功，正在刷新课程…" showIcon />
      ) : devMode ? (
        <Space direction="vertical" style={{ width: "100%" }}>
          <Alert type="info" message="开发模式：微信支付未配置，可点击下方模拟支付" showIcon />
          <Button type="primary" block loading={devLoading} onClick={() => void onDevPay()}>
            模拟支付成功
          </Button>
        </Space>
      ) : codeUrl && !codeUrl.startsWith("dev://") ? (
        <div style={{ textAlign: "center" }}>
          <QRCode value={codeUrl} size={220} />
          <Typography.Paragraph type="secondary" style={{ marginTop: 12 }}>
            请使用微信扫一扫完成支付
          </Typography.Paragraph>
        </div>
      ) : (
        <Alert type="warning" message="无法生成支付二维码" showIcon />
      )}
      {status === "pending" && !devMode && (
        <Typography.Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0, fontSize: 12 }}>
          支付完成后将自动刷新，请勿关闭此窗口
        </Typography.Paragraph>
      )}
    </Modal>
  );
}
