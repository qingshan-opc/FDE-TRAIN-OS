/** 业务状态 → 中文（展示用；接口仍传英文枚举） */
const STATUS_ZH: Record<string, string> = {
  // 报名 / 开课 / 课程（active 默认「活跃」；报名场景用 domain=enrollment →「在读」）
  active: "活跃",
  dropped: "已停用",
  completed: "已结业",
  enrolled: "已报名",
  invited: "已邀请",

  // 提交 / 评测 / 节点
  submitted: "已提交",
  pending: "待处理",
  needs_review: "待复核",
  in_review: "复核中",
  resolved: "已处理",
  passed: "已通过",
  failed: "未通过",
  in_progress: "进行中",
  available: "可开始",
  locked: "未解锁",
  skipped: "已跳过",

  // 课程 / 版本
  draft: "草稿",
  published: "已发布",
  archived: "已归档",

  // 文档入库
  queued: "排队中",
  scanning: "扫描中",
  ready: "可用",
  processing: "处理中",
  uploading: "上传中",

  // 实名
  unverified: "未认证",
  verified: "已认证",
  rejected: "未通过",

  // 证书
  issued: "已颁发",
  revoked: "已吊销",
  pending_issue: "待颁发",

  // 布尔式发布（个别页面用字符串）
  true: "已发布",
  false: "未发布",
};

const STATUS_COLOR: Record<string, string> = {
  active: "processing",
  dropped: "default",
  completed: "success",
  submitted: "processing",
  pending: "orange",
  needs_review: "orange",
  in_review: "processing",
  resolved: "success",
  passed: "success",
  failed: "error",
  in_progress: "processing",
  available: "blue",
  locked: "default",
  draft: "default",
  published: "success",
  archived: "default",
  queued: "default",
  scanning: "processing",
  ready: "success",
  processing: "processing",
  unverified: "default",
  verified: "success",
  rejected: "error",
  issued: "success",
  revoked: "error",
};

const DOMAIN_ZH: Record<string, Record<string, string>> = {
  enrollment: { active: "在读", dropped: "已停用", completed: "已结业" },
  course: { active: "活跃", draft: "草稿", archived: "已归档" },
  version: { draft: "草稿", published: "已发布", archived: "已归档" },
  submission: {
    submitted: "已提交",
    pending: "待处理",
    needs_review: "待复核",
    passed: "已通过",
    failed: "未通过",
    resolved: "已处理",
  },
  document: { queued: "排队中", scanning: "扫描中", ready: "可用", failed: "失败" },
};

export type StatusDomain = keyof typeof DOMAIN_ZH;

export function statusLabel(
  status: string | null | undefined,
  fallback = "—",
  domain?: StatusDomain,
): string {
  if (status == null || status === "") return fallback;
  const key = String(status).trim();
  const lower = key.toLowerCase();
  if (domain && DOMAIN_ZH[domain]?.[lower]) return DOMAIN_ZH[domain][lower];
  return STATUS_ZH[key] || STATUS_ZH[lower] || key;
}

export function statusColor(status: string | null | undefined): string | undefined {
  if (status == null || status === "") return undefined;
  const key = String(status).trim();
  return STATUS_COLOR[key] || STATUS_COLOR[key.toLowerCase()];
}

/** 筛选项：value 仍为英文枚举，label 为中文 */
export function statusOptions(
  values: string[],
  domain?: StatusDomain,
): Array<{ value: string; label: string }> {
  return values.map((value) => ({ value, label: statusLabel(value, value, domain) }));
}
