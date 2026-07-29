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

const { Header, Content } = Layout;

type MenuItem = Required<MenuProps>["items"][number];

const leafIcon = (icon: ReactNode) => <span style={{ fontSize: 15 }}>{icon}</span>;

type MenuGroup = { label: string; items: MenuItem[] };

const MENU_GROUPS: MenuGroup[] = [
  {
    label: "工作台",
    items: [{ key: "/author", icon: <DashboardOutlined />, label: "概览" }],
  },
  {
    label: "网站维护",
    items: [
      { key: "/author/site/settings", icon: leafIcon(<ProfileOutlined />), label: "站点信息" },
      { key: "/author/site/home", icon: leafIcon(<HomeOutlined />), label: "首页内容" },
      { key: "/author/site/open-courses", icon: leafIcon(<PlaySquareOutlined />), label: "站点公开课" },
      { key: "/author/site/enterprise", icon: leafIcon(<TeamOutlined />), label: "导师与企业" },
      { key: "/author/site/leads", icon: leafIcon(<MailOutlined />), label: "联系线索" },
    ],
  },
  {
    label: "资源",
    items: [
      { key: "/author/resources/documents", icon: leafIcon(<FileTextOutlined />), label: "文档库" },
      { key: "/author/resources/videos", icon: leafIcon(<VideoCameraOutlined />), label: "视频库" },
      { key: "/author/resources/packs", icon: leafIcon(<AppstoreOutlined />), label: "素材包" },
    ],
  },
  {
    label: "课程设计",
    items: [
      { key: "/author/curriculum/courses", icon: leafIcon(<BookOutlined />), label: "课程与大纲" },
      { key: "/author/curriculum/versions", icon: leafIcon(<BranchesOutlined />), label: "课程版本" },
    ],
  },
  {
    label: "学员中心",
    items: [
      { key: "/author/learners", icon: leafIcon(<UserOutlined />), label: "学员与课程" },
      { key: "/author/learners/submissions", icon: leafIcon(<InboxOutlined />), label: "提交资料" },
      { key: "/author/learners/reviews", icon: leafIcon(<TeamOutlined />), label: "导师复核" },
    ],
  },
  {
    label: "系统设置",
    items: [
      { key: "/author/settings/camp-key", icon: leafIcon(<KeyOutlined />), label: "营期 Key" },
      { key: "/author/settings/channels", icon: leafIcon(<TeamOutlined />), label: "渠道与分账" },
    ],
  },
];

const GROUP_ICONS: Record<string, ReactNode> = {
  网站维护: <GlobalOutlined />,
  资源: <FolderOpenOutlined />,
  课程设计: <ReadOutlined />,
  学员中心: <TeamOutlined />,
  系统设置: <SettingOutlined />,
};

function findSelectedKey(pathname: string): string {
  const leafKeys = MENU_GROUPS.flatMap((g) =>
    (g.items || []).map((it) => String((it as { key?: string }).key || "")),
  ).filter(Boolean);
  const hit = leafKeys
    .slice()
    .sort((a, b) => b.length - a.length)
    .find((k) => (k === "/author" ? pathname === "/author" : pathname.startsWith(k)));
  return hit || "/author";
}

export function AuthorHome() {
  const loc = useLocation();
  const nav = useNavigate();
  const { token } = theme.useToken();
  const { message } = AntApp.useApp();
  const { user, campId, camps, logout, switchCamp } = useAuth();
  const [switching, setSwitching] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const siderRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLElement>(null);

  const selected = findSelectedKey(loc.pathname);
  const allItems = useMemo(() => MENU_GROUPS.flatMap((g) => g.items), []);

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
      <div className="author-shell">
        <aside className="author-sider" ref={siderRef}>
          <div className="author-sider-brand">
            <BrandLogo to="/" name="青山在" showText={false} />
            <div className="author-sider-brand-text">
              <strong>青山在</strong>
              <span>教研台</span>
            </div>
          </div>
          <div className="author-sider-nav">
            {MENU_GROUPS.map((group) => (
              <div key={group.label} className="author-nav-group">
                <div className="author-nav-section">
                  {GROUP_ICONS[group.label] ? (
                    <span className="author-nav-section-icon">{GROUP_ICONS[group.label]}</span>
                  ) : null}
                  {group.label}
                </div>
                <Menu
                  mode="inline"
                  selectedKeys={[selected]}
                  items={group.items}
                  className="author-side-menu"
                  getPopupContainer={() => siderRef.current || document.body}
                  onClick={({ key }) => {
                    if (String(key).startsWith("/")) nav(String(key));
                  }}
                />
              </div>
            ))}
          </div>
          <div className="author-sider-footer">
            <Menu
              mode="inline"
              className="author-side-menu"
              getPopupContainer={() => siderRef.current || document.body}
              items={[
                {
                  key: "logout",
                  icon: <LogoutOutlined />,
                  label: "退出登录",
                  onClick: () => void onLogout(),
                },
              ]}
            />
          </div>
        </aside>

        <div className="author-main">
          <Header ref={headerRef} className="author-topbar">
            <div className="author-topbar__left">
              <Typography.Text type="secondary" className="author-topbar-hint">
                {allItems.find((it) => String((it as { key?: string }).key) === selected)
                  ? String((allItems.find((it) => String((it as { key?: string }).key) === selected) as { label?: string })?.label || "")
                  : "教研台"}
              </Typography.Text>
            </div>
            <div className="author-topbar__right">
              {campOptions.length > 1 ? (
                <Select
                  aria-label="切换营期"
                  value={campId || undefined}
                  options={campOptions}
                  loading={switching}
                  onChange={(v) => void onSwitchCamp(v)}
                  style={{ minWidth: 140 }}
                  size="middle"
                  popupMatchSelectWidth={false}
                  getPopupContainer={() => headerRef.current || document.body}
                  className="author-camp-select"
                />
              ) : (
                campId && <Typography.Text code>{campId}</Typography.Text>
              )}
              <Button size="middle" icon={<SwapOutlined />} onClick={() => nav("/app/courses")}>
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
                <Button type="text" className="author-user-btn">
                  <Space>
                    <Avatar size="small" style={{ backgroundColor: token.colorPrimary }}>
                      {(user?.display_name || user?.email || "?")[0]?.toUpperCase()}
                    </Avatar>
                    <span>{user?.display_name || user?.email}</span>
                  </Space>
                </Button>
              </Dropdown>
            </div>
          </Header>
          <Content ref={contentRef} className="author-content">
            <Outlet />
          </Content>
        </div>
      </div>
    </AuthorLayoutProvider>
  );
}
