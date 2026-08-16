import { useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Space, Typography, message } from "antd";
import { DesktopOutlined, CopyOutlined, ShoppingOutlined } from "@ant-design/icons";
import { Nav } from "../components/Nav";
import { isMobilePhoneUa, LEARN_DESKTOP_URL } from "../lib/device";

/**
 * Blocks phone browsers from learning routes only.
 * Shop / profile / invite remain available on mobile.
 */
export function RequireDesktopLearn({ children }: { children: ReactNode }) {
  const mobile = useMemo(() => isMobilePhoneUa(), []);
  if (!mobile) return <>{children}</>;
  return <DesktopLearnGuide />;
}

function DesktopLearnGuide() {
  const nav = useNavigate();
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(LEARN_DESKTOP_URL);
      setCopied(true);
      message.success("已复制电脑端学习地址");
    } catch {
      message.error("复制失败，请手动在电脑浏览器打开");
    }
  };

  return (
    <div className="course-picker-shell desktop-learn-gate-shell">
      <Nav variant="learner" />
      <div className="desktop-learn-gate">
        <div className="desktop-learn-gate__card">
          <div className="desktop-learn-gate__icon" aria-hidden>
            <DesktopOutlined />
          </div>
          <Typography.Title level={3} className="desktop-learn-gate__title">
            学习请用电脑打开
          </Typography.Title>
          <Typography.Paragraph type="secondary" className="desktop-learn-gate__desc">
            视频讲解与实操练习需要电脑浏览器。手机仍可继续选购、支付、查看账号与邀请。
          </Typography.Paragraph>
          <Space direction="vertical" size="middle" style={{ width: "100%" }}>
            <Button
              type="primary"
              size="large"
              block
              icon={<ShoppingOutlined />}
              onClick={() => nav("/app/shop")}
            >
              去选购课程
            </Button>
            <Button size="large" block icon={<CopyOutlined />} onClick={() => void onCopy()}>
              {copied ? "已复制学习地址" : "复制电脑端学习地址"}
            </Button>
          </Space>
          <Typography.Paragraph type="secondary" className="desktop-learn-gate__hint">
            电脑打开 {LEARN_DESKTOP_URL}，用同一微信账号登录即可学习。
          </Typography.Paragraph>
        </div>
      </div>
    </div>
  );
}
