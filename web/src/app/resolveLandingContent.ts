/**
 * Resolve landing CMS body_json sections with inkCamp / landingShared code fallbacks.
 */

import type {
  LandingAbout,
  LandingFooterContent,
  LandingHomeContent,
  LandingPartner,
  LandingPayload,
  LandingSeo,
  LandingSeoByRoute,
} from "../lib/types";
import {
  ABOUT_PILLARS,
  LANDING_FOOTER_BUSINESS_EMAIL,
  LANDING_FOOTER_COMPANY,
  LANDING_FOOTER_OFFICE,
  LANDING_FOOTER_TAGLINE,
  LANDING_PARTNERS,
} from "./landingShared";
import {
  INK_FAQ,
  INK_FEATURES,
  INK_HERO,
  INK_PAIN_TURN,
  INK_PAINS,
  INK_PRICE_PERKS,
  INK_SEO,
  INK_SYLLABUS_WEEKS,
  INK_TRAE_ROLES,
  INK_VOICES,
  INK_WORKS,
} from "./inkCampContent";

/** Mirrors Landing.tsx TRUST (prefer over INK_HERO.trust) */
const TRUST = [
  { num: "21", unit: "天", label: "结构化训练" },
  { num: "3", unit: "周", label: "能力递进" },
  { num: "6", unit: "岗", label: "AI 岗位协作" },
  { num: "永久", unit: "", label: "课程回放" },
] as const;

/** Mirrors Landing.tsx FEAT_META */
const FEAT_META = [
  "ROLES: pm · ui · fe · be · qa · ops",
  "LOOP: plan → act → reflect",
  "SKILL: align · report · push",
  "EVIDENCE: gated milestones",
  "DELIVERABLE: running product",
  "ACCESS: lifetime replay",
] as const;

const DEFAULT_ABOUT_BODY =
  "青山在是新一代数字化人才训练品牌，由青山OPC & 灵栖智能运营。我们面向政府、高校与企业，交付可验收、可留痕、可核验的 FDE 训练营与机构培训项目。";

const STORY_BLOCKS = [
  "传统培训擅长讲知识与演示工具，却难以回答一个关键问题：学员回到岗位后，能否独立交付可验收的成果？青山在从第一天就把「交付物」写进课纲，把「证据链」写进过程，把「可核验证书」写进结业标准。",
  "FDE Learning OS 是我们的训练操作系统：任务编排、Agent 实训环境、Lab 证据采集与 Passport 能力雷达在同一平台闭环。组织看到的不是出勤率，而是每一位学员的真实产出与能力轨迹。",
  "我们已与浙江大学、武汉大学及青山湖科技城管委会等机构开展联合培养与园区人才项目，持续验证「培训即交付」这一模式在政企场景中的可落地性。",
];

const FOOTER_BLURB = "专注于培养前沿部署工程师人才，打通AI与业务的最后一公里。";

const DEFAULT_SEO: LandingSeo = {
  title: INK_SEO.title,
  description: INK_SEO.description,
  keywords: INK_SEO.keywords,
  og_image: "/landing/hero.png",
};

function asArray<T>(value: T[] | undefined | null, fallback: T[]): T[] {
  return value && value.length > 0 ? value : fallback;
}

function mergeSection<T extends Record<string, unknown>>(
  base: T,
  override?: Partial<T> | null,
): T {
  if (!override) return { ...base };
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(override)) {
    if (v === undefined || v === null) continue;
    if (Array.isArray(v)) {
      out[k] = v;
      continue;
    }
    const prev = out[k];
    if (
      v &&
      typeof v === "object" &&
      !Array.isArray(v) &&
      prev &&
      typeof prev === "object" &&
      !Array.isArray(prev)
    ) {
      out[k] = { ...(prev as object), ...(v as object) };
    } else {
      out[k] = v;
    }
  }
  return out as T;
}

export function defaultHomeFromInk(): LandingHomeContent {
  return {
    hero: {
      eyebrow: INK_HERO.eyebrow,
      title_lead: INK_HERO.titleLead,
      title_em: INK_HERO.titleEm,
      title_line2: INK_HERO.titleLine2,
      pillars: [...INK_HERO.pillars],
      sub: INK_HERO.sub,
      cta_primary: INK_HERO.ctaPrimary,
      cta_secondary: INK_HERO.ctaSecondary,
      note: INK_HERO.note,
      trust: TRUST.map((t) => ({ ...t })),
    },
    pain: {
      tag: "// 你现在的处境",
      title_lines: ["AI 写代码的时代，", "你却卡在「会聊不会交」"],
      subtitle: "问题不是再买一门课，而是缺一套能交付、能落地、能沟通的 FDE 训练。",
      items: INK_PAINS.map((p) => ({ ...p })),
      turn: INK_PAIN_TURN,
    },
    features: {
      tag: "// 为什么不一样",
      title_before: "不是教你写代码，是教你",
      title_accent: "指挥交付",
      items: INK_FEATURES.map((f) => ({ ...f })),
      meta: [...FEAT_META],
    },
    outline: {
      tag: "// 三周路线图",
      title: "21 天，从交付到沟通",
      subtitle: "点开每一天，查看主题、产出与 GATE。前三周课纲均已开放预览。",
      weeks: INK_SYLLABUS_WEEKS.map((w) => ({
        ...w,
        days: w.days?.map((d) => ({ ...d, out: [...d.out] })),
        comingNotes: w.comingNotes ? [...w.comingNotes] : undefined,
      })),
    },
    method: {
      tag: "// 学习方式",
      title_line1: "你是指挥官，",
      title_line2: "六岗位 AI 是施工队",
      subtitle: "用 @岗位 交接任务，像真实软件团队一样协作；你负责判断、验收与推进。",
      roles: INK_TRAE_ROLES.map((r) => ({ ...r })),
    },
    works: {
      tag: "// 学员成果",
      title: "毕业带走可运行作品",
      subtitle: "不是练习题，是能写进述职与协作现场的真实交付。",
      items: INK_WORKS.map((w) => ({ ...w })),
    },
    voices: {
      tag: "// 学员评价",
      title: "他们怎么说",
      items: INK_VOICES.map((v) => ({ ...v })),
    },
    pricing: {
      tag: "// 定价",
      title: "一次报名，三周能力递进",
      subtitle: "登录后即可选购开通。含课纲、实训资源、答疑支持与永久回放。",
      perks: [...INK_PRICE_PERKS],
      price_label: "FDE CAMP · EARLY",
      price_amount: "¥1,980",
      price_unit: "/人",
      price_note: "FDE 训练营 · 开营名额有限",
    },
    faq: {
      tag: "// FAQ",
      title: "常见问题",
      items: INK_FAQ.map((f) => ({ ...f })),
    },
    final_cta: {
      title: "准备好当指挥官了吗？",
      body: "21 天完成产品交付、Agent 与企业沟通特训——把 AI 真正变成你的施工队。",
      secondary_cta: "先看三周大纲",
    },
  };
}

export function resolveHome(cms?: LandingHomeContent | null): LandingHomeContent {
  return mergeSection(defaultHomeFromInk() as Record<string, unknown>, cms as Record<string, unknown> | null) as LandingHomeContent;
}

export function defaultFooter(): LandingFooterContent {
  return {
    blurb: FOOTER_BLURB,
    company: LANDING_FOOTER_COMPANY,
    email: LANDING_FOOTER_BUSINESS_EMAIL,
    office: LANDING_FOOTER_OFFICE,
    tagline: LANDING_FOOTER_TAGLINE,
  };
}

export function resolveFooter(cms?: LandingFooterContent | null): LandingFooterContent {
  return { ...defaultFooter(), ...(cms || {}) };
}

export function defaultPartners(): LandingPartner[] {
  return LANDING_PARTNERS.map((p) => ({ ...p }));
}

export function resolvePartners(cms?: LandingPartner[] | null): LandingPartner[] {
  return asArray(cms, defaultPartners());
}

export function defaultAbout(): LandingAbout {
  return {
    title: "关于我们",
    body: DEFAULT_ABOUT_BODY,
    story: [...STORY_BLOCKS],
    pillars: ABOUT_PILLARS.map((p) => ({ ...p })),
    partners_title: "合作伙伴",
    partners_lead: "与政府、高校与园区同行，持续交付可验收的数字化人才训练项目",
  };
}

export function resolveAbout(cms?: LandingAbout | null): LandingAbout {
  const base = defaultAbout();
  if (!cms) return base;
  return {
    ...base,
    ...cms,
    story: asArray(cms.story, base.story || []),
    pillars: asArray(cms.pillars, base.pillars || []),
  };
}

export function defaultSeoByRoute(): LandingSeoByRoute {
  return {
    home: { ...DEFAULT_SEO },
    enterprise: {
      title: "企业与机构培训 · 青山在",
      description:
        "从课纲设计到结业验收，每一天都是可交付的真实工作任务。为政府、高校与企业交付可验收的数字化人才训练。",
      keywords: "青山在,企业培训,机构培训,数字化人才,Agent实训,结业证书",
      og_image: "/landing/hero.png",
    },
    about: {
      title: "关于我们 · 青山在",
      description: DEFAULT_ABOUT_BODY,
      keywords: "青山在,关于我们,FDE训练营,数字化人才,青山OPC,灵栖智能",
      og_image: "/landing/hero.png",
    },
    open: {
      title: "公开课 · 青山在",
      description:
        "免费公开课：用短视频看清 FDE 如何把老板语言翻译成可验收交付，再决定是否报名完整营期。",
      keywords: "青山在,公开课,FDE,数字化人才,入门课",
      og_image: "/landing/hero.png",
    },
  };
}

export function resolveRouteSeo(
  route: string,
  payload?: Pick<LandingPayload, "seo" | "seo_by_route"> | null,
): LandingSeo {
  const defaults = defaultSeoByRoute();
  const fromRoute = payload?.seo_by_route?.[route];
  const fallback =
    route === "home"
      ? { ...DEFAULT_SEO, ...(payload?.seo || {}) }
      : defaults[route] || DEFAULT_SEO;
  return { ...fallback, ...(fromRoute || {}) };
}
