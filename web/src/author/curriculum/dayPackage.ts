/** Authoring helpers for Day package_json — keep learner dual-read compatible. */

export type { DayResource } from "../../lib/curriculum/capsuleResources";
export { resolveCapsuleResources } from "../../lib/curriculum/capsuleResources";
import type { DayResource } from "../../lib/curriculum/capsuleResources";
import type { CapsuleLocalPrep, KnowledgeCard } from "../../lib/types";

export type AuthorNodeType = "learn" | "quiz" | "lab" | "project" | "review" | "unlock";

export type CapsuleEditorTab = "notes" | "practice" | "knowledge_cards" | "local_prep" | "resources" | "quiz" | "lab" | "advanced";

export const CAPSULE_EDITOR_TABS: { key: CapsuleEditorTab; label: string }[] = [
  { key: "notes", label: "讲义" },
  { key: "practice", label: "练习" },
  { key: "knowledge_cards", label: "知识卡片" },
  { key: "resources", label: "资源" },
  { key: "quiz", label: "节测验" },
  { key: "lab", label: "节实训" },
  { key: "advanced", label: "高级" },
];

export interface AuthorNodeSpec {
  type: AuthorNodeType;
  title: string;
}

export interface AuthorCapsuleMedia {
  kind: "video" | "audio";
  title?: string;
  object_key: string;
  poster_key?: string;
  duration_sec?: number;
  transcript?: string;
}

export interface AuthorQuizQuestion {
  q: string;
  options: string[];
  answer?: number;
  explain?: string;
}

export interface AuthorRubricCheck {
  check: string;
  args?: Record<string, unknown>;
  title_zh?: string;
  description_zh?: string;
  hint?: string;
}

export interface AuthorDayLab {
  runner?: string;
  sim_kind?: string;
  workspace_mode?: string;
  primary_files?: string[];
  inherited_files?: string[];
  agent?: { prompt_template?: string };
  rubric?: AuthorRubricCheck[];
  seed?: Record<string, unknown>;
  coach?: Record<string, unknown>;
}

export interface AuthorCapsule {
  id: string;
  title: string;
  minutes?: number;
  content?: string;
  practice?: string | { prompt: string; input_type?: string; required?: boolean };
  media?: AuthorCapsuleMedia[];
  resource_ids?: string[];
  resources?: DayResource[];
  quiz?: { questions?: AuthorQuizQuestion[]; pass_rate?: number };
  lab?: Partial<AuthorDayLab>;
  local_prep?: CapsuleLocalPrep;
  knowledge_cards?: KnowledgeCard[];
  glossary_terms?: KnowledgeCard[];
  advanced?: Record<string, unknown>;
}

export interface AuthorDayPackage {
  camp_version?: string;
  day: number;
  title: string;
  week?: number;
  project?: string | null;
  project_brief?: string | null;
  review_checklist?: string[];
  resources?: DayResource[];
  learn?: {
    require_capsules?: boolean;
    estimated_minutes?: number;
    lingzhi_tags?: string[];
    capsules?: AuthorCapsule[];
    steps?: string[];
  };
  quiz?: {
    questions?: AuthorQuizQuestion[];
    pass_rate?: number;
  };
  lab?: AuthorDayLab;
  nodes?: AuthorNodeSpec[];
  [key: string]: unknown;
}

export type EditorPane =
  | { kind: "meta" }
  | { kind: "capsule"; capsuleId: string; tab?: CapsuleEditorTab }
  | { kind: "capsuleOrder" }
  | { kind: "nodes" }
  | { kind: "quiz" }
  | { kind: "lab" }
  | { kind: "resources" }
  | { kind: "raw" };

export function normalizeDayPackage(raw: Record<string, unknown>, day: number): AuthorDayPackage {
  const pkg = { ...raw } as AuthorDayPackage;
  pkg.day = Number(pkg.day ?? day) || day;
  pkg.title = String(pkg.title || `第 ${pkg.day} 课`);
  pkg.week = Number(pkg.week ?? (pkg.day <= 5 ? 1 : 2)) || 1;
  pkg.project = pkg.project ?? "";
  pkg.project_brief = pkg.project_brief ?? "";
  pkg.review_checklist = Array.isArray(pkg.review_checklist) ? pkg.review_checklist.map(String) : [];
  pkg.resources = Array.isArray(pkg.resources) ? pkg.resources : [];

  const learn = { ...(pkg.learn || {}) };
  learn.require_capsules = learn.require_capsules !== false;
  learn.capsules = (Array.isArray(learn.capsules) ? learn.capsules : []).map((c) => ({
    ...c,
    resource_ids: Array.isArray(c.resource_ids) ? c.resource_ids.map(String) : [],
    resources: Array.isArray(c.resources) ? c.resources : [],
    quiz: c.quiz
      ? {
          ...(c.quiz || {}),
          questions: Array.isArray(c.quiz?.questions) ? c.quiz.questions : [],
          pass_rate: typeof c.quiz?.pass_rate === "number" ? c.quiz.pass_rate : 0.8,
        }
      : undefined,
    lab: c.lab && typeof c.lab === "object" ? c.lab : undefined,
    advanced: c.advanced && typeof c.advanced === "object" ? c.advanced : undefined,
  }));
  learn.steps = Array.isArray(learn.steps) ? learn.steps : [];
  learn.lingzhi_tags = Array.isArray(learn.lingzhi_tags) ? learn.lingzhi_tags.map(String) : [];
  pkg.learn = learn;

  const quiz = { ...(pkg.quiz || {}) };
  quiz.questions = Array.isArray(quiz.questions) ? quiz.questions : [];
  quiz.pass_rate = typeof quiz.pass_rate === "number" ? quiz.pass_rate : 0.8;
  pkg.quiz = quiz;

  const lab = { ...(pkg.lab || {}) };
  lab.runner = lab.runner || "agent";
  lab.primary_files = Array.isArray(lab.primary_files) ? lab.primary_files.map(String) : [];
  lab.rubric = Array.isArray(lab.rubric) ? lab.rubric : [];
  lab.agent = lab.agent || { prompt_template: "" };
  pkg.lab = lab;

  const nodes = Array.isArray(pkg.nodes) ? pkg.nodes : [];
  pkg.nodes = nodes
    .map((n) => {
      const type = String((n as AuthorNodeSpec).type || (n as { kind?: string }).kind || "learn") as AuthorNodeType;
      return { type, title: String((n as AuthorNodeSpec).title || type) };
    })
    .filter((n) => n.type !== "unlock");

  if (!pkg.nodes.length) {
    pkg.nodes = [
      { type: "learn", title: "学习" },
      { type: "quiz", title: "小测" },
      { type: "lab", title: "实训" },
      { type: "project", title: "企业任务" },
      { type: "review", title: "自检" },
    ];
  }

  return pkg;
}

export function validateDayPackage(pkg: AuthorDayPackage): string[] {
  const errors: string[] = [];
  if (!pkg.title.trim()) errors.push("课次标题不能为空");
  if (!pkg.day || pkg.day < 1) errors.push("课次编号无效");
  if (!pkg.nodes?.length) errors.push("至少需要一个学习流程节点");
  const types = (pkg.nodes || []).map((n) => n.type);
  if (new Set(types).size !== types.length) errors.push("学习流程节点类型不可重复");
  if (types.includes("learn") && !(pkg.learn?.capsules || []).length) {
    errors.push("含学习节点时至少需要一课节");
  }
  const dayResourceIdSet = new Set((pkg.resources || []).map((r) => r.id).filter(Boolean));
  for (const c of pkg.learn?.capsules || []) {
    if (!c.id?.trim()) errors.push("存在未设置 id 的课节");
    if (!c.title?.trim()) errors.push(`课节 ${c.id || "?"} 标题为空`);
    for (const rid of c.resource_ids || []) {
      if (!dayResourceIdSet.has(rid)) {
        errors.push(`课节 ${c.id || "?"} 引用了不存在的资源 id：${rid}`);
      }
    }
    const inlineIds = (c.resources || []).map((r) => r.id).filter(Boolean);
    if (new Set(inlineIds).size !== inlineIds.length) {
      errors.push(`课节 ${c.id || "?"} 内联资源 id 不可重复`);
    }
    for (const m of c.media || []) {
      if (!m.object_key?.trim()) {
        errors.push(`课节 ${c.id || "?"} 存在缺少 object_key 的媒体条目`);
      } else if (!m.object_key.startsWith("documents/")) {
        errors.push(`课节 ${c.id || "?"} 媒体 object_key 应以 documents/ 开头（当前：${m.object_key}）`);
      }
    }
    if (c.quiz?.questions?.length) {
      for (const [i, q] of c.quiz.questions.entries()) {
        if (!q.q?.trim()) errors.push(`课节 ${c.id} 节测验第 ${i + 1} 题题干为空`);
        if (!q.options?.length) errors.push(`课节 ${c.id} 节测验第 ${i + 1} 题缺少选项`);
      }
    }
  }
  const ids = (pkg.learn?.capsules || []).map((c) => c.id);
  if (new Set(ids).size !== ids.length) errors.push("课节 id 不可重复");
  if (types.includes("quiz")) {
    for (const [i, q] of (pkg.quiz?.questions || []).entries()) {
      if (!q.q?.trim()) errors.push(`整日测验第 ${i + 1} 题题干为空`);
      if (!q.options?.length) errors.push(`整日测验第 ${i + 1} 题缺少选项`);
    }
  }
  const resourceIds = (pkg.resources || []).map((r) => r.id).filter((id) => !!id?.trim());
  if (new Set(resourceIds).size !== resourceIds.length) errors.push("本课资源 id 不可重复");
  return errors;
}

export function newCapsuleId(existing: AuthorCapsule[]): string {
  let i = existing.length + 1;
  const ids = new Set(existing.map((c) => c.id));
  while (ids.has(`c${i}`)) i += 1;
  return `c${i}`;
}

export function practiceToText(practice: AuthorCapsule["practice"]): string {
  if (!practice) return "";
  if (typeof practice === "string") return practice;
  return practice.prompt || "";
}
