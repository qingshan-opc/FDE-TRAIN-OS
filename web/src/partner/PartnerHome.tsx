import { Layout, Menu, Button, Space } from "antd";
import { LogoutOutlined } from "@ant-design/icons";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { BrandLogo } from "../components/BrandLogo";

const { Header, Content } = Layout;

function cleanLabel(raw: string | null | undefined): string {
  return (raw || "").replace(/^\[disabled\]\s*/i, "").trim();
}

export function PartnerHome() {
  const nav = useNavigate();
  const loc = useLocation();
  const { user, logout } = useAuth();
  const selected = loc.pathname.startsWith("/partner/posters")
    ? "/partner/posters"
    : loc.pathname.startsWith("/partner/shares")
      ? "/partner/shares"
      : "/partner";
  const userLabel = cleanLabel(user?.display_name) || cleanLabel(user?.email);

  return (
    <Layout className="partner-shell">
      <Header className="partner-topbar">
        <div className="partner-topbar__brand">
          <BrandLogo to="/partner" name="青山在" className="partner-topbar__logo" />
          <div className="partner-topbar__titles">
            <strong>青山在机构管理后台</strong>
            <span>渠道看板 · 课程海报 · 分账明细</span>
          </div>
        </div>
        <Menu
          mode="horizontal"
          selectedKeys={[selected]}
          items={[
            { key: "/partner", label: "看板" },
            { key: "/partner/posters", label: "课程海报" },
            { key: "/partner/shares", label: "分账明细" },
          ]}
          onClick={({ key }) => nav(key)}
          className="partner-topbar__menu"
        />
        <Space className="partner-topbar__user" size={10}>
          <span className="partner-topbar__email" title={userLabel}>
            {userLabel}
          </span>
          <Button
            size="middle"
            icon={<LogoutOutlined />}
            onClick={() => void logout().then(() => nav("/partner/login"))}
          >
            退出
          </Button>
        </Space>
      </Header>
      <Content className="partner-content">
        <Outlet />
      </Content>
    </Layout>
  );
}
