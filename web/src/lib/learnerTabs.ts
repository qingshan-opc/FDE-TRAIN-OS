export const LEARNER_TABS = [
  { id: "home", to: "/app/shop", label: "首页" },
  { id: "learn", to: "/app/courses", label: "学习" },
  { id: "invite", to: "/app/invite", label: "邀请" },
  { id: "me", to: "/app/profile", label: "我的" },
] as const;

export type LearnerTabId = (typeof LEARNER_TABS)[number]["id"];

/** Which bottom tab should highlight for the current learner path. */
export function learnerTabId(pathname: string): LearnerTabId | null {
  const path = pathname.split("?")[0] || "/";
  if (path.startsWith("/app/shop")) return "home";
  if (path.startsWith("/app/invite")) return "invite";
  if (
    path.startsWith("/app/profile") ||
    path.startsWith("/app/identity") ||
    path.startsWith("/app/certificates")
  ) {
    return "me";
  }
  if (
    path === "/app" ||
    path.startsWith("/app/courses") ||
    path.startsWith("/app/day") ||
    path.startsWith("/app/sim")
  ) {
    return "learn";
  }
  return null;
}
