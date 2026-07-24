import type { LandingPayload, LandingTab } from "../lib/types";

export const OPEN_COURSES_PATH = "/open";
export const ABOUT_PATH = "/about";
export const VERIFY_PATH = "/verify";

/** 官网页脚统一信息（全站 Landing 子页复用） */
export const LANDING_FOOTER_BUSINESS_EMAIL = "admin@lingqicloud.com";
export const LANDING_FOOTER_TRAINING_EMAIL = "training@qingshanzai.local";
export const LANDING_FOOTER_OFFICE =
  "浙江省杭州市临安区青山湖科技城滨河路17号LinkPark产业园区1号楼4楼";
export const LANDING_FOOTER_COMPANY = "杭州灵梧智能科技有限公司";
export const LANDING_FOOTER_TAGLINE = "万物有灵，梧与青山";

export const LANDING_SCROLL_SECTIONS = new Set(["enterprise"]);

export const FALLBACK_LANDING_TABS: LandingTab[] = [
  { id: "enterprise", label: "企业培训" },
  { id: "open", label: "公开课" },
  { id: "verify", label: "证书核验" },
  { id: "about", label: "关于我们" },
];

const LANDING_TAB_ORDER = ["enterprise", "open", "verify", "about"];

export function resolveLandingTabs(raw?: LandingTab[] | null): LandingTab[] {
  const base = (raw && raw.length > 0 ? raw : FALLBACK_LANDING_TABS).filter(
    (t) => t.id !== "contact" && t.id !== "partners",
  );
  const verifyTab = FALLBACK_LANDING_TABS.find((t) => t.id === "verify");
  if (verifyTab && !base.some((t) => t.id === "verify")) {
    base.push(verifyTab);
  }
  const aboutTab = FALLBACK_LANDING_TABS.find((t) => t.id === "about");
  if (aboutTab && !base.some((t) => t.id === "about")) {
    base.push(aboutTab);
  }
  const seen = new Set<string>();
  const deduped = base.filter((t) => {
    if (seen.has(t.id)) return false;
    seen.add(t.id);
    return true;
  });
  return deduped.sort((a, b) => {
    const ia = LANDING_TAB_ORDER.indexOf(a.id);
    const ib = LANDING_TAB_ORDER.indexOf(b.id);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });
}

export const LANDING_PARTNERS = [
  {
    id: "zju",
    name: "浙江大学",
    tag: "高校联合培养",
    logo: "/landing/partners/zju.svg",
    logoAlt: "浙江大学标识",
  },
  {
    id: "whu",
    name: "武汉大学",
    tag: "高校联合培养",
    logo: "/landing/partners/whu.svg",
    logoAlt: "武汉大学标识",
  },
  {
    id: "qingshanhu",
    name: "青山湖科技城管委会",
    tag: "政府与园区",
    logo: "/landing/partners/qingshanhu.svg",
    logoAlt: "青山湖科技城管委会标识",
  },
] as const;

export const ABOUT_PILLARS = [
  {
    n: "01",
    title: "任务驱动课纲",
    desc: "每一天围绕一个可验收交付展开，学员在真实工作场景中完成产出，而不是被动听课。",
  },
  {
    n: "02",
    title: "Agent 实训环境",
    desc: "隔离工作区 + 全程留痕，学员使用真实 Agent 完成交付，组织能核验真实能力。",
  },
  {
    n: "03",
    title: "可核验结业证书",
    desc: "结业证书公开可查，附带证据链摘要，组织能验证每一位学员的真实产出。",
  },
] as const;

export const LANDING_FALLBACK_OPEN_COURSES: NonNullable<LandingPayload["open_courses"]> = [
  {
    id: "fde-intro",
    title: "FDE 是谁：懂业务的技术落地者",
    minutes: 2,
    level: "入门",
    summary: "用两分钟看清 FDE 如何把老板语言翻译成可验收交付。",
    stream_url: "/api/v1/site/open-courses/fde-intro/stream",
    poster_url: "/api/v1/site/open-courses/fde-intro/stream?asset=poster",
    published: true,
  },
];
