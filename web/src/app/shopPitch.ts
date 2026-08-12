/** Shop landing copy — aligned with enterprise AI camp narrative. */

export const SHOP_HERO = {
  eyebrow: "FDE ACADEMY",
  title: "21天，跑通企业AI项目全流程",
  subtitle: "工程能力让系统跑起来，组织推动让项目真正落地",
  chips: ["3周线上训练", "企业项目实战", "3个月入职教练陪跑"],
} as const;

export const SHOP_OUTCOMES = [
  "1 套企业部门 AI 系统",
  "1 套老板 AI 经营驾驶舱",
  "1 个专业 Agent + 3 个岗位 Skill",
] as const;

export const SHOP_WEEKS = [
  {
    week: 1,
    title: "第一周",
    subtitle: "AI 增强型全栈原型",
    dayFrom: 1,
    dayTo: 6,
  },
  {
    week: 2,
    title: "第二周",
    subtitle: "企业需求诊断与 AI 项目实操",
    dayFrom: 7,
    dayTo: 11,
  },
  {
    week: 3,
    title: "第三周",
    subtitle: "组织推动与 AI 落地",
    dayFrom: 12,
    dayTo: 17,
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

export const POSTER_DEFAULT_SLOGAN = "工程能力让系统跑起来，组织推动让项目真正落地";
export const POSTER_SELL_POINTS = ["3 周线上训练", "企业项目实战", "3 个月入职教练陪跑"] as const;
