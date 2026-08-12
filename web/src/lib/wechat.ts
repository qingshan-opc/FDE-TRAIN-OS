/** WeChat in-app browser helpers (MicroMessenger). */

export function isWeChatBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  return /MicroMessenger/i.test(navigator.userAgent || "");
}

/** Prefer long-press save UX on WeChat / narrow mobile viewports. */
export function prefersLongPressSavePoster(): boolean {
  if (typeof window === "undefined") return false;
  if (isWeChatBrowser()) return true;
  return window.matchMedia("(max-width: 720px)").matches;
}

/** Only allow same-origin relative app paths as OAuth/login next. */
export function sanitizeAppNext(raw: string | null | undefined, fallback = "/app/courses"): string {
  const path = (raw || "").trim() || fallback;
  if (!path.startsWith("/") || path.startsWith("//")) return fallback;
  if (path.includes("://") || path.includes("\\")) return fallback;
  if (
    path === "/app" ||
    path.startsWith("/app/") ||
    path === "/partner" ||
    path.startsWith("/partner/") ||
    path === "/author" ||
    path.startsWith("/author/") ||
    path === "/open" ||
    path.startsWith("/open/")
  ) {
    return path.split("#")[0].slice(0, 200);
  }
  return fallback;
}

/** Public MP OAuth entry — sets cookies then redirects into SPA. */
export function wechatMpEntryUrl(nextPath: string, invite?: string | null): string {
  const next = sanitizeAppNext(nextPath);
  const q = new URLSearchParams({ next });
  if (invite && invite.trim()) q.set("invite", invite.trim());
  return `/api/v1/auth/wechat/mp-entry?${q.toString()}`;
}
