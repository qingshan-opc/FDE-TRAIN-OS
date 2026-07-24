import type { Passport } from "./types";

export type RadarAxis = {
  key: string;
  label: string;
  score: number;
};

export type EvidenceItem = {
  ts?: string;
  day?: number;
  node_id?: string;
  kind?: string;
  capability_tags?: string[];
};

const AXES: { key: string; label: string }[] = [
  { key: "agent", label: "Agent 实训" },
  { key: "sim", label: "Sim 仿真" },
  { key: "data", label: "数据/SQL" },
  { key: "learn", label: "理论学习" },
  { key: "delivery", label: "项目交付" },
  { key: "consistency", label: "学习连续性" },
];

function clamp(n: number, max = 100): number {
  return Math.max(0, Math.min(max, Math.round(n)));
}

function collectTags(passport: Passport | null, evidence: EvidenceItem[]): Set<string> {
  const tags = new Set<string>(passport?.capability_tags || []);
  for (const row of evidence) {
    for (const t of row.capability_tags || []) tags.add(String(t));
  }
  return tags;
}

function tagScore(tags: Set<string>, pred: (t: string) => boolean, base: number, step: number, cap: number): number {
  let score = base;
  for (const t of tags) {
    if (pred(t)) score += step;
  }
  return clamp(score, cap);
}

function kindCount(evidence: EvidenceItem[], kinds: string[]): number {
  const set = new Set(kinds);
  return evidence.filter((e) => set.has(String(e.kind || ""))).length;
}

function uniqueLearningDays(evidence: EvidenceItem[]): number {
  return new Set(evidence.map((e) => e.day).filter((d) => typeof d === "number")).size;
}

/** Map passport + evidence into six learner-facing capability axes (0–100). */
export function buildCapabilityRadar(passport: Passport | null, evidence: EvidenceItem[]): RadarAxis[] {
  const tags = collectTags(passport, evidence);
  const labish = kindCount(evidence, ["lab", "agent", "eval", "submission"]);
  const quizish = kindCount(evidence, ["quiz", "practice"]);
  const learnish = kindCount(evidence, ["learn", "capsule", "node"]);

  const scores: Record<string, number> = {
    agent: tagScore(
      tags,
      (t) => t === "agent" || t.startsWith("agent:"),
      passport?.tracks.agent ? 55 : 10,
      8,
      100,
    ),
    sim: tagScore(tags, (t) => t === "sim" || t.startsWith("sim") || t.includes("sandbox"), passport?.tracks.sim ? 55 : 10, 10, 100),
    data: tagScore(tags, (t) => t.includes("sql") || t.includes("data"), 8, 12, 100),
    learn: clamp(
      12 +
        quizish * 8 +
        learnish * 6 +
        [...tags].filter((t) => t.startsWith("capsule:")).length * 5,
      100,
    ),
    delivery: clamp(10 + labish * 12 + (passport?.evidence_count || 0) * 2, 100),
    consistency: clamp(8 + uniqueLearningDays(evidence) * 10 + Math.min(evidence.length, 12) * 3, 100),
  };

  return AXES.map(({ key, label }) => ({ key, label, score: scores[key] ?? 0 }));
}

export type ActivityItem = {
  id: string;
  title: string;
  subtitle: string;
  at: string;
  href?: string;
};

const KIND_LABEL: Record<string, string> = {
  lab: "完成 Lab 实训",
  agent: "Agent 生成作业",
  eval: "通过评测",
  quiz: "提交测验",
  practice: "完成随堂练习",
  learn: "学习节点",
  capsule: "打开课节",
  submission: "提交作业",
};

/** Human-readable label for raw capability tags shown on the passport. */
export function formatCapabilityTag(tag: string): string {
  const KNOWN: Record<string, string> = {
    pass: "评测通过",
    k8s: "Kubernetes 部署",
    sim: "仿真环境",
    agent: "Agent 交付",
    sql: "SQL 与数据",
  };
  if (KNOWN[tag]) return KNOWN[tag];
  if (tag.startsWith("day:")) return `第 ${tag.slice(4)} 课`;
  if (tag.startsWith("agent:")) return `Agent · ${tag.slice(6).replace(/_/g, " ")}`;
  if (tag.startsWith("coach:")) return `教练 · ${tag.slice(6).replace(/_/g, " ")}`;
  if (tag.startsWith("eval:")) return `评测 · ${tag.slice(5)}`;
  if (tag.startsWith("capsule:")) return `课节 · ${tag.slice(8)}`;
  return tag.replace(/_/g, " ").replace(/:/g, " · ");
}

export function groupCapabilityTags(tags: string[]): { title: string; items: string[] }[] {
  const groups: Record<string, string[]> = {
    认证与评测: [],
    学习进度: [],
    平台技能: [],
    其他: [],
  };
  for (const raw of tags) {
    const label = formatCapabilityTag(raw);
    if (raw.startsWith("day:") || raw.startsWith("capsule:")) groups["学习进度"].push(label);
    else if (raw.startsWith("eval:") || raw === "pass" || raw.startsWith("coach:")) groups["认证与评测"].push(label);
    else if (raw.startsWith("agent:") || raw.startsWith("sim") || raw === "k8s" || raw.includes("sql")) groups["平台技能"].push(label);
    else groups["其他"].push(label);
  }
  return Object.entries(groups)
    .filter(([, items]) => items.length > 0)
    .map(([title, items]) => ({ title, items }));
}

function relTime(iso?: string): string {
  if (!iso) return "刚刚";
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return iso;
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "刚刚";
  if (mins < 60) return `${mins} 分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "昨天";
  if (days < 7) return `${days} 天前`;
  return new Date(ts).toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
}

export function buildRecentActivity(evidence: EvidenceItem[], limit = 6): ActivityItem[] {
  return evidence.slice(0, limit).map((row, i) => {
    const kind = String(row.kind || "learn");
    const day = typeof row.day === "number" ? row.day : undefined;
    const node = row.node_id ? String(row.node_id) : undefined;
    const title = KIND_LABEL[kind] || "学习记录";
    const subtitle = day ? `第 ${day} 课${node ? ` · ${node}` : ""}` : node || "学习平台";
    const href = day && node ? `/app/day/${day}?node=${encodeURIComponent(node)}` : day ? `/app/day/${day}` : undefined;
    return {
      id: String(row.ts || i),
      title,
      subtitle,
      at: relTime(row.ts),
      href,
    };
  });
}
