/** Day 1 §1 professional-domain memory — reused when later lessons fill prompts. */

export const PROFESSIONAL_DOMAIN_DAY = 1;
export const PROFESSIONAL_DOMAIN_CAPSULE_ID = "c1";
export const PROFESSIONAL_DOMAIN_OTHER = "其他";
export const DEFAULT_DOMAIN_OPTIONS = ["财务", "HR", "运营", "销售", "教育"] as const;
export const DOMAIN_PLACEHOLDER = "〈财务 / HR / 运营 / 销售 / 教育 / 其他〉";
export const DOMAIN_PLACEHOLDER_COMPACT = "〈财务/HR/运营/销售/教育/其他〉";

export type ProfessionalDomainMemory = {
  option: string;
  other: string;
  label: string;
};

const STORAGE_PREFIX = "fde.learner.professional_domain.";

export function domainStorageKey(campId: string): string {
  return `${STORAGE_PREFIX}${campId}`;
}

export function resolveDomainLabel(option: string, other = ""): string {
  const opt = option.trim();
  if (!opt) return "";
  if (opt === PROFESSIONAL_DOMAIN_OTHER) return other.trim() || PROFESSIONAL_DOMAIN_OTHER;
  return opt;
}

export function memoryFromPracticeJson(
  json: Record<string, unknown> | null | undefined,
): ProfessionalDomainMemory | null {
  if (!json || typeof json !== "object") return null;
  const option = typeof json.professional_domain === "string" ? json.professional_domain.trim() : "";
  const other =
    typeof json.professional_domain_other === "string" ? json.professional_domain_other.trim() : "";
  const storedLabel =
    typeof json.professional_domain_label === "string" ? json.professional_domain_label.trim() : "";
  const label = storedLabel || resolveDomainLabel(option, other);
  if (!option && !label) return null;
  const known = new Set<string>(DEFAULT_DOMAIN_OPTIONS);
  let normalizedOption = option;
  if (!normalizedOption) {
    normalizedOption = known.has(label) ? label : PROFESSIONAL_DOMAIN_OTHER;
  }
  return { option: normalizedOption, other, label };
}

export function memoryToPracticeJson(mem: ProfessionalDomainMemory): Record<string, unknown> {
  return {
    professional_domain: mem.option,
    professional_domain_other: mem.other,
    professional_domain_label: mem.label,
  };
}

export function readCachedDomain(campId: string | null | undefined): ProfessionalDomainMemory | null {
  if (!campId || typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(domainStorageKey(campId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ProfessionalDomainMemory;
    if (!parsed || typeof parsed !== "object") return null;
    const label = resolveDomainLabel(String(parsed.option || ""), String(parsed.other || "")) || parsed.label;
    if (!label) return null;
    return { option: String(parsed.option || ""), other: String(parsed.other || ""), label };
  } catch {
    return null;
  }
}

export function writeCachedDomain(campId: string, mem: ProfessionalDomainMemory): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(domainStorageKey(campId), JSON.stringify(mem));
  } catch {
    /* private mode */
  }
}

export function pickDomainFromPractices(
  items: Array<{ capsule_id: string; response_json?: Record<string, unknown> }>,
): ProfessionalDomainMemory | null {
  const preferred = items.find((it) => it.capsule_id === PROFESSIONAL_DOMAIN_CAPSULE_ID);
  const fromPreferred = memoryFromPracticeJson(preferred?.response_json);
  if (fromPreferred) return fromPreferred;
  for (const it of items) {
    const mem = memoryFromPracticeJson(it.response_json);
    if (mem) return mem;
  }
  return null;
}

export const DOMAIN_EXAMPLES: Record<string, string> = {
  财务: "给部门负责人查看预算执行、费用趋势和异常支出",
  HR: "给招聘负责人查看招聘漏斗、岗位进度和超期节点",
  运营: "给活动负责人查看渠道转化、留存和异常波动",
  销售: "给销售主管查看客户阶段、跟进情况和业绩差距",
  教育: "把实验、调研或课程数据做成可筛选、可比较的分析页面",
};

export function domainExample(label: string): string {
  const key = label.trim();
  if (DOMAIN_EXAMPLES[key]) return DOMAIN_EXAMPLES[key];
  if (!key) return "给一类明确用户查看他们每天最常盯的数据和最痛的进度";
  return `给${key}一线同事查看他们每天反复打开的数据和最容易出错的进度`;
}

/** Fill Day 1 §4/§5 prompt placeholders with the saved domain label. */
export function fillProfessionalDomain(text: string, label: string | null | undefined): string {
  if (!text) return text;
  const value = (label || "").trim();
  const example = domainExample(value);
  if (!value) {
    return text.replaceAll("{{domain_example}}", example);
  }
  return text
    .replaceAll("{{professional_domain}}", value)
    .replaceAll(DOMAIN_PLACEHOLDER, value)
    .replaceAll(DOMAIN_PLACEHOLDER_COMPACT, value)
    .replaceAll("{{domain_example}}", example);
}

export function domainMemoryContent(mem: ProfessionalDomainMemory): { title: string; content: string; tags: string[] } {
  return {
    title: "我的专业领域",
    content: `学员最熟悉的专业领域是：${mem.label}。后续课程（Day 1 第 4 节）生成提示词时使用该领域。`,
    tags: ["professional-domain", "memory:professional_domain", "day:1"],
  };
}
