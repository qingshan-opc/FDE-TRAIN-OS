import { useRef, type ReactNode } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { Nav } from "./Nav";
import { scrollPageToTop } from "../lib/scrollPageToTop";
import {
  IconAccountBack,
  IconAccountCertificate,
  IconAccountIdentity,
  IconAccountInvite,
  IconAccountProfile,
  IconAccountVerify,
  IconExternal,
} from "./learnerAccountIcons";

const NAV_ITEMS: Array<{
  to: string;
  label: string;
  end?: boolean;
  Icon: typeof IconAccountProfile;
}> = [
  { to: "/app/profile", label: "个人中心", end: true, Icon: IconAccountProfile },
  { to: "/app/invite", label: "邀请分佣", Icon: IconAccountInvite },
  { to: "/app/identity", label: "实名认证", Icon: IconAccountIdentity },
  { to: "/app/certificates", label: "结业证书", Icon: IconAccountCertificate },
];

const PAGE_ICONS: Record<string, typeof IconAccountProfile> = {
  "/app/profile": IconAccountProfile,
  "/app/invite": IconAccountInvite,
  "/app/identity": IconAccountIdentity,
  "/app/certificates": IconAccountCertificate,
};

function navClass({ isActive }: { isActive: boolean }) {
  return `learner-account-nav__item${isActive ? " is-active" : ""}`;
}

export function LearnerAccountLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const { pathname } = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  const onNav = () => {
    scrollPageToTop();
    mainRef.current?.scrollTo({ top: 0, behavior: "instant" });
  };
  const PageIcon = PAGE_ICONS[pathname] || IconAccountProfile;

  return (
    <div className="app-shell app-page-shell learner-account-shell">
      <Nav />
      <div className="learner-account-frame">
        <div className="learner-account-layout">
          <aside className="learner-account-sidebar learner-account-card" aria-label="个人中心菜单">
          <p className="learner-account-sidebar__label">
            <IconAccountProfile className="learner-account-sidebar__label-icon" />
            账号与证书
          </p>
          <nav className="learner-account-nav">
            {NAV_ITEMS.map(({ to, label, end, Icon }) => (
              <NavLink key={to} to={to} end={end} className={navClass} onClick={onNav}>
                <Icon className="learner-account-nav__icon" />
                <span>{label}</span>
              </NavLink>
            ))}
            <a
              href="/verify"
              className="learner-account-nav__item learner-account-nav__item--external"
              target="_blank"
              rel="noreferrer"
            >
              <IconAccountVerify className="learner-account-nav__icon" />
              <span>证书核验</span>
              <IconExternal className="learner-account-nav__external" />
            </a>
          </nav>
          <div className="learner-account-sidebar__foot">
            <Link to="/app/courses" className="learner-account-nav__back" onClick={onNav}>
              <IconAccountBack className="learner-account-nav__icon" />
              <span>返回学习</span>
            </Link>
          </div>
          </aside>
          <main ref={mainRef} className="learner-account-main learner-account-card">
          <header className="learner-account-main__header">
            <div className="learner-account-main__title-row">
              <span className="learner-account-main__title-icon" aria-hidden>
                <PageIcon />
              </span>
              <h1>{title}</h1>
            </div>
            {subtitle ? <p className="muted">{subtitle}</p> : null}
          </header>
          <div className="learner-account-content">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
