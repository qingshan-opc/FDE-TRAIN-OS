/** Shop landing copy — aligned with enterprise AI camp narrative. */

export const SHOP_HERO = {
  eyebrow: "ENTERPRISE AI CAMP",
  title: "企业AI项目实战训练营",
  subtitle: "从系统构建到组织落地。",
  chips: ["21 天", "3 周递进", "可核验证书"],
} as const;

export const SHOP_OUTCOMES = [
  "指挥六岗位做出可验收产品",
  "企业级 Agent：规划 · 执行 · 反思",
  "组织推动与沟通落地能力",
] as const;

export const SHOP_WEEKS = [
  {
    week: 1,
    title: "第一周",
    subtitle: "用 AI 做完整应用",
    dayFrom: 1,
    dayTo: 6,
  },
  {
    week: 2,
    title: "第二周",
    subtitle: "给应用装上大脑",
    dayFrom: 7,
    dayTo: 11,
  },
  {
    week: 3,
    title: "第三周",
    subtitle: "组织推动与 AI 落地",
    dayFrom: 12,
    dayTo: 21,
  },
] as const;

export const SHOP_FIT = {
  yes: ["想把 AI 真正做成可验收业务结果", "需要跨产品 / 工程 / 沟通一体推进"],
  no: ["只想听概念、不想动手交付", "期待「学完立刻成为算法专家」"],
} as const;

export const SHOP_TRUST = {
  cert: "结业证书公开可核验，过程与产出留痕，组织敢认。",
  quote: "三周之后，部门里那些重复流程第一次有了自动化抓手。",
  quoteBy: "往期学员 · 业务侧落地实践者",
} as const;

export const SHOP_DEFAULT_PITCH =
  "21 天任务驱动：从指挥 AI 做出产品，到企业级 Agent，再到组织推动落地，成为懂业务的技术落地者（FDE）。";

export const POSTER_DEFAULT_SLOGAN = "从系统构建到组织落地。";
export const POSTER_SELL_POINTS = ["21 天结构化训练", "产品 · Agent · 沟通递进", "结业可核验"] as const;
