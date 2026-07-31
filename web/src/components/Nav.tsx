import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { BrandLogo } from "./BrandLogo";
import { LearnerContextBar } from "./LearnerContextBar";
import { useToast } from "./Toast";

function navUserLabel(user: { display_name?: string; email?: string } | null | undefined): string {
  if (!user) return "学员";
  const name = user.display_name?.trim();
  if (name && /[\u4e00-\u9fff]/.test(name)) return name;
  return "学员";
}

export function Nav({
  variant = "learner",
  onHomework,
  onPassport,
}: {
  variant?: "learner" | "author" | "learner-workbench";
  onHomework?: () => void;
  onPassport?: () => void;
}) {
  const { user, campId, camps, logout, switchCamp } = useAuth();
  const nav = useNavigate();
  const toast = useToast();
  const [switching, setSwitching] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const onLogout = async () => {
    setMenuOpen(false);
    await logout();
    nav("/login");
  };

  const onSwitchCamp = async (nextCampId: string) => {
    if (!nextCampId || nextCampId === campId) return;
    setSwitching(true);
    try {
      await switchCamp(nextCampId);
      toast.push("已切换营期", "success");
      nav("/app");
    } catch (err) {
      toast.push(err instanceof Error ? err.message : "切换营期失败", "error");
    } finally {
      setSwitching(false);
    }
  };

  const goTo = (path: string) => {
    setMenuOpen(false);
    nav(path);
  };

  const userLabel = navUserLabel(user);

  return (
    <header
      className={`sticky top-0 z-[100] flex h-[var(--nav-h)] items-center border-b border-fde-border bg-white/90 px-4 backdrop-blur-md${
        variant === "learner-workbench" ? " nav-workbench" : " justify-between"
      }`}
    >
      <div className="flex items-center gap-3 nav-workbench__brand">
        <BrandLogo to={variant === "author" ? "/author" : "/app/courses"} name="青山在" />
        {variant !== "learner-workbench" && (
          <span className="rounded-full bg-fde-accent/10 px-2 py-0.5 text-xs font-medium text-fde-accent">
            {variant === "author" ? "教研台" : "学习平台"}
          </span>
        )}
      </div>
      {variant === "learner-workbench" && (
        <div className="nav-workbench__center">
          <LearnerContextBar />
        </div>
      )}
      <div className="flex items-center gap-3 text-xs text-fde-muted nav-workbench__actions">
        {camps && camps.length > 1 && (
          <select
            aria-label="切换营期"
            value={campId || ""}
            disabled={switching}
            onChange={(e) => void onSwitchCamp(e.target.value)}
            className="rounded-md border border-fde-border bg-white px-2 py-1 text-xs text-fde-ink"
          >
            {camps.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name || c.id}
              </option>
            ))}
          </select>
        )}
        {variant !== "learner-workbench" && campId && camps?.length <= 1 && <span className="font-mono">{campId}</span>}
        {(user?.role === "author" || user?.role === "admin") && (
          <button
            type="button"
            className="rounded-md px-2 py-1 hover:bg-fde-bg"
            onClick={() => nav(variant === "author" ? "/app/courses" : "/author")}
          >
            {variant === "author" ? "学员台" : "教研台"}
          </button>
        )}
        <div className="app-nav-user" ref={menuRef}>
          <button
            type="button"
            className={`app-nav-user-trigger${menuOpen ? " is-open" : ""}`}
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
          >
            <span className="app-nav-user-avatar" aria-hidden>
              {userLabel[0]?.toUpperCase() || "学"}
            </span>
            <span className="app-nav-user-name">{userLabel}</span>
            <svg className="app-nav-user-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
          {menuOpen && (
            <div className="app-nav-user-menu" role="menu">
              <div className="app-nav-user-head">
                <span className="app-nav-user-head-avatar" aria-hidden>
                  {userLabel[0]?.toUpperCase() || "学"}
                </span>
                <div className="app-nav-user-head-text">
                  <strong>{userLabel}</strong>
                  {user?.email && <span>{user.email}</span>}
                </div>
              </div>
              <div className="app-nav-user-items">
                {variant === "learner" && onPassport && (
                  <button
                    type="button"
                    role="menuitem"
                    className="app-nav-user-item"
                    onClick={() => {
                      setMenuOpen(false);
                      onPassport();
                    }}
                  >
                    <NavIconPassport />
                    能力护照
                  </button>
                )}
                {variant === "learner" && onHomework && (
                  <button
                    type="button"
                    role="menuitem"
                    className="app-nav-user-item"
                    onClick={() => {
                      setMenuOpen(false);
                      onHomework();
                    }}
                  >
                    <NavIconHomework />
                    去做作业
                  </button>
                )}
                <button type="button" role="menuitem" className="app-nav-user-item" onClick={() => goTo("/app/profile")}>
                  <NavIconUser />
                  个人中心
                </button>
                <button type="button" role="menuitem" className="app-nav-user-item" onClick={() => goTo("/app/identity")}>
                  <NavIconIdentity />
                  实名认证
                </button>
                <button type="button" role="menuitem" className="app-nav-user-item" onClick={() => goTo("/app/certificates")}>
                  <NavIconCertificate />
                  结业证书
                </button>
              </div>
              <div className="app-nav-user-divider" role="separator" />
              <button type="button" role="menuitem" className="app-nav-user-item app-nav-user-item--danger" onClick={() => void onLogout()}>
                <NavIconLogout />
                退出登录
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function NavIconUser() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  );
}

function NavIconIdentity() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="9" cy="11" r="2" />
      <path d="M15 9h4M15 13h3M7 17c0-2 1.5-3 4-3s4 1 4 3" />
    </svg>
  );
}

function NavIconCertificate() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M12 15l-2 1 1-2-1-2 2 1 2-1-1 2 1 2-2-1z" />
      <path d="M7 4h10v8a5 5 0 0 1-10 0V4z" />
    </svg>
  );
}

function NavIconLogout() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  );
}

function NavIconHomework() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
      <rect x="9" y="3" width="6" height="4" rx="1" />
      <path d="M9 12h6M9 16h4" />
    </svg>
  );
}

function NavIconPassport() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="9" cy="10" r="2" />
      <path d="M15 8h4M15 12h4M7 16c0-2 1.5-3 4-3s4 1 4 3" />
    </svg>
  );
}
