import { Layout, Menu, Typography, theme, Select, Button, Dropdown, Space, Avatar } from "antd";
import type { MenuProps } from "antd";
import {
  DashboardOutlined,
  GlobalOutlined,
  FolderOpenOutlined,
  ReadOutlined,
  TeamOutlined,
  SettingOutlined,
  UserOutlined,
  LogoutOutlined,
  SwapOutlined,
  BookOutlined,
  ProfileOutlined,
  HomeOutlined,
  PlaySquareOutlined,
  MailOutlined,
  FileTextOutlined,
  VideoCameraOutlined,
  AppstoreOutlined,
  BranchesOutlined,
  InboxOutlined,
  KeyOutlined,
} from "@ant-design/icons";
import { App as AntApp } from "antd";
import { useMemo, useRef, useState, type ReactNode } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { BrandLogo } from "../components/BrandLogo";
import { AuthorLayoutProvider } from "../lib/authorLayoutContext";
import { useAuth } from "../lib/auth";

const { Header, Sider, Content } = Layout;

type MenuItem = Required<MenuProps>["items"][number];

const leafIcon = (icon: ReactNode) => <span style={{ fontSize: 16 }}>{icon}</span>;

const MENU_ITEMS: MenuItem[] = [
  { key: "/author", icon: <DashboardOutlined style={{ fontSize: 18 }} />, label: "概览" },
  {
    key: "site",
    icon: <GlobalOutlined style={{ fontSize: 18 }} />,
    label: "网站维护",
    children: [
      { key: "/author/site/settings", icon: leafIcon(<ProfileOutlined />), label: "站点信息" },
      { key: "/author/site/home", icon: leafIcon(<HomeOutlined />), label: "首页内容" },
      { key: "/author/site/open-courses", icon: leafIcon(<PlaySquareOutlined />), label: "站点公开课" },
      { key: "/author/site/enterprise", icon: leafIcon(<TeamOutlined />), label: "导师与企业" },
      { key: "/author/site/leads", icon: leafIcon(<MailOutlined />), label: "联系线索" },
    ],
  },
  {
    key: "resources",
    icon: <FolderOpenOutlined style={{ fontSize: 18 }} />,
    label: "资源",
    children: [
      { key: "/author/resources/documents", icon: leafIcon(<FileTextOutlined />), label: "文档库" },
      { key: "/author/resources/videos", icon: leafIcon(<VideoCameraOutlined />), label: "视频库" },
      { key: "/author/resources/packs", icon: leafIcon(<AppstoreOutlined />), label: "素材包" },
    ],
  },
  {
    key: "curriculum",
    icon: <ReadOutlined style={{ fontSize: 18 }} />,
    label: "课程设计",
    children: [
      { key: "/author/curriculum/courses", icon: leafIcon(<BookOutlined />), label: "课程与大纲" },
      { key: "/author/curriculum/versions", icon: leafIcon(<BranchesOutlined />), label: "课程版本" },
    ],
  },
  {
    key: "learners",
    icon: <TeamOutlined style={{ fontSize: 18 }} />,
    label: "学员中心",
    children: [
      { key: "/author/learners", icon: leafIcon(<UserOutlined />), label: "学员与课程" },
      { key: "/author/learners/submissions", icon: leafIcon(<InboxOutlined />), label: "提交资料" },
    ],
  },
  {
    key: "settings",
    icon: <SettingOutlined style={{ fontSize: 18 }} />,
    label: "系统设置",
    children: [{ key: "/author/settings/camp-key", icon: leafIcon(<KeyOutlined />), label: "营期 Key" }],
  },
];

function findSelectedKey(pathname: string): string {
  const leafKeys = [
    "/author/site/settings",
    "/author/site/home",
    "/author/site/open-courses",
    "/author/site/enterprise",
    "/author/site/leads",
    "/author/resources/documents",
    "/author/resources/videos",
    "/author/resources/packs",
    "/author/curriculum/courses",
    "/author/curriculum/versions",
    "/author/learners/submissions",
    "/author/learners",
    "/author/settings/camp-key",
    "/author",
  ];
  const hit = leafKeys
    .slice()
    .sort((a, b) => b.length - a.length)
    .find((k) => (k === "/author" ? pathname === "/author" : pathname.startsWith(k)));
  return hit || "/author";
}

function openKeysFor(pathname: string): string[] {
  if (pathname.startsWith("/author/site")) return ["site"];
  if (pathname.startsWith("/author/resources")) return ["resources"];
  if (pathname.startsWith("/author/curriculum") || pathname.startsWith("/author/courses/")) return ["curriculum"];
  if (pathname.startsWith("/author/learners")) return ["learners"];
  if (pathname.startsWith("/author/settings")) return ["settings"];
  return [];
}

export function AuthorHome() {
  const loc = useLocation();
  const nav = useNavigate();
  const { token } = theme.useToken();
  const { message } = AntApp.useApp();
  const { user, campId, camps, logout, switchCamp } = useAuth();
  const [switching, setSwitching] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const siderRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLElement>(null);

  const selected = findSelectedKey(loc.pathname);
  const defaultOpen = useMemo(() => openKeysFor(loc.pathname), [loc.pathname]);
  const [openKeys, setOpenKeys] = useState<string[]>(defaultOpen);

  const onSwitchCamp = async (nextCampId: string) => {
    if (!nextCampId || nextCampId === campId) return;
    setSwitching(true);
    try {
      await switchCamp(nextCampId);
      message.success("已切换营期");
      nav("/author");
    } catch (err) {
      message.error(err instanceof Error ? err.message : "切换营期失败");
    } finally {
      setSwitching(false);
    }
  };

  const onLogout = async () => {
    await logout();
    nav("/login");
  };

  const campOptions = (camps || []).map((c) => ({ value: c.id, label: c.name || c.id }));

  return (
    <AuthorLayoutProvider headerRef={headerRef} siderRef={siderRef} contentRef={contentRef}>
    <Layout className="author-shell" style={{ minHeight: "100vh", background: token.colorBgLayout }}>
      <Header ref={headerRef} className="author-topbar">
        <Space size="middle">
          <BrandLogo to="/" name="青山在" />
          <span className="author-topbar-badge">教研台</span>
        </Space>
        <Space size="middle">
          {campOptions.length > 1 ? (
            <Select
              aria-label="切换营期"
              value={campId || undefined}
              options={campOptions}
              loading={switching}
              onChange={(v) => void onSwitchCamp(v)}
              style={{ minWidth: 140 }}
              size="small"
              getPopupContainer={() => headerRef.current || document.body}
            />
          ) : (
            campId && <Typography.Text code>{campId}</Typography.Text>
          )}
          <Button size="small" icon={<SwapOutlined />} onClick={() => nav("/app/courses")}>
            学员台
          </Button>
          <Dropdown
            getPopupContainer={() => headerRef.current || document.body}
            menu={{
              items: [
                { key: "profile", icon: <UserOutlined />, label: "个人中心", onClick: () => nav("/app/profile") },
                { key: "certs", icon: <BookOutlined />, label: "结业证书", onClick: () => nav("/app/certificates") },
                { type: "divider" },
                { key: "logout", icon: <LogoutOutlined />, label: "退出登录", danger: true, onClick: () => void onLogout() },
              ],
            }}
          >
            <Button type="text" style={{ height: 40 }}>
              <Space>
                <Avatar size="small" style={{ backgroundColor: token.colorPrimary }}>
                  {(user?.display_name || user?.email || "?")[0]?.toUpperCase()}
                </Avatar>
                <span>{user?.display_name || user?.email}</span>
              </Space>
            </Button>
          </Dropdown>
        </Space>
      </Header>
      <Layout>
        <Sider
          ref={siderRef}
          breakpoint="lg"
          collapsedWidth={72}
          width={236}
          collapsible
          collapsed={collapsed}
          onCollapse={(nextCollapsed) => {
            setCollapsed(nextCollapsed);
            if (!nextCollapsed) {
              setOpenKeys((prev) => (prev.length ? prev : defaultOpen));
            }
          }}
          className="author-sider"
          style={{ background: "transparent", borderRight: "none" }}
        >
          <div className="author-sider-inner">
            <Menu
              mode="inline"
              selectedKeys={[selected]}
              openKeys={collapsed ? [] : openKeys.length ? openKeys : defaultOpen}
              onOpenChange={(keys) => setOpenKeys(keys as string[])}
              items={MENU_ITEMS}
              style={{ height: "100%", borderInlineEnd: 0, paddingTop: 8, background: "transparent" }}
              onClick={({ key }) => {
                if (String(key).startsWith("/")) nav(String(key));
              }}
              className="author-side-menu"
              getPopupContainer={() => siderRef.current || document.body}
            />
          </div>
        </Sider>
        <Content
          ref={contentRef}
          className="author-content"
          style={{
            padding: typeof window !== "undefined" && window.innerWidth < 768 ? 16 : 24,
            maxWidth: 1280,
            overflow: "auto",
          }}
        >
          <Outlet />
        </Content>
      </Layout>
    </Layout>
    </AuthorLayoutProvider>
  );
}
