import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BrandLogo } from "./BrandLogo";
import {
  ABOUT_PATH,
  ENTERPRISE_PATH,
  OPEN_COURSES_PATH,
  VERIFY_PATH,
  resolveLandingTabs,
} from "../app/landingShared";
import { applyMkTheme, readMkTheme, writeMkTheme, type MkTheme } from "../lib/mkTheme";
import { scrollPageToTop } from "../lib/scrollPageToTop";
import type { LandingTab } from "../lib/types";

/** 未登录进登录页，已登录进课程选购 */
export const PURCHASE_PATH = "/app/shop";
export const LOGIN_PATH = "/login";

function tabHref(id: string): string {
  if (id === "home") return "/";
  if (id === "open") return OPEN_COURSES_PATH;
  if (id === "about") return ABOUT_PATH;
  if (id === "verify") return VERIFY_PATH;
  if (id === "enterprise") return ENTERPRISE_PATH;
  return "/";
}

function ThemeToggle({ theme, onToggle }: { theme: MkTheme; onToggle: () => void }) {
  const isLight = theme === "light";
  return (
    <button
      type="button"
      className="mk-theme-toggle"
      onClick={onToggle}
      aria-label={isLight ? "切换到深色模式" : "切换到浅色模式"}
      title={isLight ? "深色模式" : "浅色模式"}
    >
      {isLight ? (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path d="M21 14.5A8.5 8.5 0 1 1 9.5 3 7 7 0 0 0 21 14.5z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path
            d="M12 2v2.2M12 19.8V22M4.9 4.9l1.6 1.6M17.5 17.5l1.6 1.6M2 12h2.2M19.8 12H22M4.9 19.1l1.6-1.6M17.5 6.5l1.6-1.6"
            strokeLinecap="round"
          />
        </svg>
      )}
    </button>
  );
}

export function LandingTopbar({
  activeTab,
  headerSolid,
  brandName,
  loginHref = LOGIN_PATH,
  appHref,
  user,
  tabs,
  purchaseHref,
}: {
  activeTab: string;
  headerSolid: boolean;
  brandName: string;
  loginHref?: string;
  appHref: string;
  user: { role: string } | null;
  tabs?: LandingTab[];
  /** 选购入口：已登录 /app/shop，未登录 /login */
  purchaseHref?: string;
}) {
  const navTabs = resolveLandingTabs(tabs);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [theme, setTheme] = useState<MkTheme>(() =>
    typeof window === "undefined" ? "dark" : readMkTheme(),
  );
  const buyHref = purchaseHref || (user ? PURCHASE_PATH : LOGIN_PATH);

  useEffect(() => {
    applyMkTheme(theme);
  }, [theme]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const closeMobile = () => setMobileOpen(false);

  const onTabNavigate = () => {
    scrollPageToTop();
    closeMobile();
  };

  const toggleTheme = () => {
    setTheme((prev) => {
      const next: MkTheme = prev === "dark" ? "light" : "dark";
      writeMkTheme(next);
      return next;
    });
  };

  return (
    <>
      <header className={`ink-topbar${headerSolid ? " is-scrolled" : " is-over-hero"}`}>
        <div className="ink-topbar-inner">
          <div className="ink-topbar-brand">
            <BrandLogo name={brandName} variant="default" className="landing-brand" />
          </div>

          <nav className="ink-tabnav" aria-label="页面导航">
            {navTabs.map((t) => (
              <Link
                key={t.id}
                to={tabHref(t.id)}
                className={activeTab === t.id ? "active" : ""}
                onClick={onTabNavigate}
              >
                {t.label}
              </Link>
            ))}
          </nav>

          <div className="ink-topbar-actions">
            <Link to={buyHref} className="ink-btn ink-btn--nav" onClick={closeMobile}>
              立即选购
            </Link>
            {user ? (
              <Link to={appHref} className="ink-btn ink-btn--nav">
                学习平台
              </Link>
            ) : (
              <Link to={loginHref} className="ink-btn ink-btn--ghost ink-btn--nav">
                登录
              </Link>
            )}
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
            <button
              type="button"
              className={`ink-hamburger${mobileOpen ? " open" : ""}`}
              aria-label={mobileOpen ? "关闭菜单" : "打开菜单"}
              onClick={() => setMobileOpen((v) => !v)}
            >
              <span />
              <span />
              <span />
            </button>
          </div>
        </div>
      </header>

      <div className={`ink-mobile-menu${mobileOpen ? " open" : ""}`} aria-hidden={!mobileOpen}>
        {navTabs.map((t) => (
          <Link key={t.id} to={tabHref(t.id)} onClick={onTabNavigate}>
            {t.label}
          </Link>
        ))}
        <button
          type="button"
          className="mk-theme-toggle mk-theme-toggle--menu"
          onClick={toggleTheme}
          aria-label={theme === "light" ? "切换到深色模式" : "切换到浅色模式"}
        >
          {theme === "light" ? (
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path d="M21 14.5A8.5 8.5 0 1 1 9.5 3 7 7 0 0 0 21 14.5z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <circle cx="12" cy="12" r="4" />
              <path
                d="M12 2v2.2M12 19.8V22M4.9 4.9l1.6 1.6M17.5 17.5l1.6 1.6M2 12h2.2M19.8 12H22M4.9 19.1l1.6-1.6M17.5 6.5l1.6-1.6"
                strokeLinecap="round"
              />
            </svg>
          )}
        </button>
        <Link to={buyHref} className="ink-btn" onClick={closeMobile}>
          立即选购
        </Link>
        {user ? (
          <Link to={appHref} className="ink-btn" onClick={closeMobile}>
            学习平台
          </Link>
        ) : (
          <Link to={loginHref} className="ink-btn ink-btn--ghost" onClick={closeMobile}>
            登录
          </Link>
        )}
      </div>
    </>
  );
}
