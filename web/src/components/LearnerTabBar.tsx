import { useEffect, type ReactNode, type SVGProps } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation } from "react-router-dom";
import { LEARNER_TABS, learnerTabId } from "../lib/learnerTabs";
import { scrollPageToTop } from "../lib/scrollPageToTop";

const BODY_CLASS = "has-learner-tabbar";

type IconProps = SVGProps<SVGSVGElement>;

function TabIcon({ children, ...props }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={22}
      height={22}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      {children}
    </svg>
  );
}

function IconHome() {
  return (
    <TabIcon>
      {/* 青山剪影：首页用山，不用通用房子 */}
      <path d="M3 19h18L14 6.5 10.5 12 8 9.2 3 19z" />
      <path d="M14 6.5 16.2 4 21 10.2" />
    </TabIcon>
  );
}

function IconLearn() {
  return (
    <TabIcon>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </TabIcon>
  );
}

function IconInvite() {
  return (
    <TabIcon>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M19 8v6M22 11h-6" />
    </TabIcon>
  );
}

function IconMe() {
  return (
    <TabIcon>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </TabIcon>
  );
}

const ICONS: Record<(typeof LEARNER_TABS)[number]["id"], () => ReactNode> = {
  home: IconHome,
  learn: IconLearn,
  invite: IconInvite,
  me: IconMe,
};

export function LearnerTabBar() {
  const { pathname } = useLocation();
  const active = learnerTabId(pathname);

  useEffect(() => {
    document.body.classList.add(BODY_CLASS);
    return () => document.body.classList.remove(BODY_CLASS);
  }, []);

  if (typeof document === "undefined") return null;

  return createPortal(
    <nav className="learner-tabbar" aria-label="学员主导航">
      {LEARNER_TABS.map((tab) => {
        const Icon = ICONS[tab.id];
        const isActive = active === tab.id;
        return (
          <Link
            key={tab.id}
            to={tab.to}
            className={`learner-tabbar__item${isActive ? " is-active" : ""}`}
            aria-current={isActive ? "page" : undefined}
            onClick={() => scrollPageToTop()}
          >
            <span className="learner-tabbar__mark" aria-hidden />
            <Icon />
            <span className="learner-tabbar__label">{tab.label}</span>
          </Link>
        );
      })}
    </nav>,
    document.body,
  );
}
