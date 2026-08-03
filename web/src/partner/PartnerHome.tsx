import { Layout, Menu, Typography, Button } from "antd";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";

const { Header, Content } = Layout;

export function PartnerHome() {
  const nav = useNavigate();
  const loc = useLocation();
  const { user, logout } = useAuth();
  const selected = loc.pathname.startsWith("/partner/posters")
    ? "/partner/posters"
    : loc.pathname.startsWith("/partner/shares")
      ? "/partner/shares"
      : "/partner";

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Header style={{ display: "flex", alignItems: "center", gap: 24, background: "#0f172a" }}>
        <Typography.Text style={{ color: "#fff", fontWeight: 600 }}>FDE 机构后台</Typography.Text>
        <Menu
          theme="dark"
          mode="horizontal"
          selectedKeys={[selected]}
          items={[
            { key: "/partner", label: "看板" },
            { key: "/partner/posters", label: "课程海报" },
            { key: "/partner/shares", label: "分账明细" },
          ]}
          onClick={({ key }) => nav(key)}
          style={{ flex: 1, minWidth: 0, background: "transparent" }}
        />
        <Typography.Text style={{ color: "rgba(255,255,255,0.75)" }}>{user?.email}</Typography.Text>
        <Button size="small" onClick={() => void logout().then(() => nav("/partner/login"))}>
          退出
        </Button>
      </Header>
      <Content style={{ padding: 24, maxWidth: 960, margin: "0 auto", width: "100%" }}>
        <Outlet />
      </Content>
    </Layout>
  );
}
