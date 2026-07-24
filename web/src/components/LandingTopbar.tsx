import { Link } from "react-router-dom";
import { BrandLogo } from "./BrandLogo";
import { ABOUT_PATH, OPEN_COURSES_PATH, VERIFY_PATH, resolveLandingTabs } from "../app/landingShared";
import { scrollPageToTop } from "../lib/scrollPageToTop";
import type { LandingTab } from "../lib/types";

export function LandingTopbar({
  activeTab,
  headerSolid,
  brandName,
  loginHref,
  appHref,
  user,
  tabs,
  onSectionClick,
}: {
  activeTab: string;
  headerSolid: boolean;
  brandName: string;
  loginHref: string;
  appHref: string;
  user: { role: string } | null;
  tabs?: LandingTab[];
  onSectionClick?: (id: string) => void;
}) {
  const navTabs = resolveLandingTabs(tabs);

  const onTabNavigate = () => {
    scrollPageToTop();
  };

  const onHomeTab = () => {
    scrollPageToTop();
    onSectionClick?.("enterprise");
  };

  return (
    <header className={`landing-topbar${headerSolid ? " is-scrolled" : " is-over-hero"}`}>
      <div className="landing-topbar-inner">
        <BrandLogo
          name={brandName}
          variant={headerSolid ? "default" : "light"}
          className="landing-brand"
        />
        <nav className="landing-tabnav" aria-label="页面导航">
          {navTabs.map((t) =>
            t.id === "open" ? (
              <Link
                key={t.id}
                to={OPEN_COURSES_PATH}
                className={activeTab === t.id ? "active" : ""}
                onClick={onTabNavigate}
              >
                {t.label}
              </Link>
            ) : t.id === "about" ? (
              <Link
                key={t.id}
                to={ABOUT_PATH}
                className={activeTab === t.id ? "active" : ""}
                onClick={onTabNavigate}
              >
                {t.label}
              </Link>
            ) : t.id === "verify" ? (
              <Link
                key={t.id}
                to={VERIFY_PATH}
                className={activeTab === t.id ? "active" : ""}
                onClick={onTabNavigate}
              >
                {t.label}
              </Link>
            ) : t.id === "enterprise" && onSectionClick ? (
              <button
                key={t.id}
                type="button"
                className={activeTab === t.id ? "active" : ""}
                onClick={onHomeTab}
              >
                {t.label}
              </button>
            ) : t.id === "enterprise" ? (
              <Link
                key={t.id}
                to="/"
                className={activeTab === t.id ? "active" : ""}
                onClick={onTabNavigate}
              >
                {t.label}
              </Link>
            ) : onSectionClick ? (
              <button
                key={t.id}
                type="button"
                className={activeTab === t.id ? "active" : ""}
                onClick={() => {
                  scrollPageToTop();
                  onSectionClick(t.id);
                }}
              >
                {t.label}
              </button>
            ) : (
              <Link
                key={t.id}
                to="/"
                className={activeTab === t.id ? "active" : ""}
                onClick={onTabNavigate}
              >
                {t.label}
              </Link>
            ),
          )}
        </nav>
        <div className="landing-topbar-actions">
          {user ? (
            <Link to={appHref} className="landing-topbar-btn landing-topbar-btn--primary">
              学习平台
            </Link>
          ) : (
            <Link to={loginHref} className="landing-topbar-btn landing-topbar-btn--ghost">
              登录
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
