import type { DayNodeSummary, DayPackage, DaySummary, NodeKind, NodeStatus } from "./types";
import { dayLabel } from "./dayLabel";

export interface TaskTarget {
  day: number;
  nodeId: string;
  label?: string;
}

export interface TaskCard {
  id: string;
  day: number;
  dayTitle: string;
  nodeId: string;
  nodeTitle: string;
  kind: NodeKind | string;
  status: NodeStatus | string;
  done: boolean;
  locked: boolean;
  urgent: boolean;
}

export interface ProgressSummary {
  passed: number;
  total: number;
  pending: number;
  pct: number;
  weekPassed: number;
  weekTotal: number;
  weekLabel: string;
}

const KIND_LABEL: Record<string, string> = {
  learn: "学习",
  quiz: "测验",
  lab: "Lab",
  project: "项目",
  review: "复盘",
};

export function kindLabel(kind: string): string {
  return KIND_LABEL[kind] || kind;
}

export function dayTaskPath(day: number, nodeId: string): string {
  return `/app/day/${day}?node=${encodeURIComponent(nodeId)}`;
}

function visibleNodes(nodes?: DayNodeSummary[]): DayNodeSummary[] {
  return (nodes || []).filter((n) => n.kind !== "unlock");
}

function isDone(status: string): boolean {
  return status === "passed";
}

function isActionable(status: string): boolean {
  return status === "available" || status === "in_progress";
}

function defaultNodeId(day: number, kind = "learn"): string {
  return `d${day}-${kind}`;
}

function pickInDayTarget(day: number, nodes: DayNodeSummary[], preferLab = true): TaskTarget | null {
  const visible = visibleNodes(nodes);
  if (!visible.length) return { day, nodeId: defaultNodeId(day) };

  if (preferLab) {
    const lab = visible.find((n) => n.kind === "lab");
    if (lab && String(lab.status) !== "locked" && !isDone(String(lab.status))) {
      return { day, nodeId: lab.id, label: lab.title };
    }
  }

  const next =
    visible.find((n) => isActionable(String(n.status))) ||
    visible.find((n) => !isDone(String(n.status)) && String(n.status) !== "locked");
  if (next) return { day, nodeId: next.id, label: next.title };
  return null;
}

/** Resolve the best next jump target for CTAs and deep links. */
export function resolveNextTarget(
  days: DaySummary[],
  ctx?: { dayPkg?: DayPackage | null },
): TaskTarget | null {
  if (ctx?.dayPkg) {
    const inDay = pickInDayTarget(ctx.dayPkg.day, ctx.dayPkg.nodes as DayNodeSummary[]);
    if (inDay) return inDay;
  }

  for (const d of days) {
    if (d.locked) continue;
    const nodes = visibleNodes(d.nodes);
    if (!nodes.length) {
      if ((d.passed ?? 0) < (d.total ?? 6)) {
        return { day: d.day, nodeId: defaultNodeId(d.day), label: d.title };
      }
      continue;
    }
    if (nodes.every((n) => isDone(String(n.status)))) continue;
    const target = pickInDayTarget(d.day, nodes, true);
    if (target) return target;
  }

  const first = days[0];
  if (!first) return null;
  const firstNodes = visibleNodes(first.nodes);
  return {
    day: first.day,
    nodeId: firstNodes[0]?.id ?? defaultNodeId(first.day),
    label: firstNodes[0]?.title ?? first.title,
  };
}

/** Resolve the next actionable node within a specific day (syllabus day pick). */
export function resolveTargetForDay(days: DaySummary[], day: number): TaskTarget | null {
  const d = days.find((x) => x.day === day);
  if (!d) return { day, nodeId: defaultNodeId(day) };
  if (d.locked) return null;
  return (
    pickInDayTarget(day, visibleNodes(d.nodes), false) ?? {
      day,
      nodeId: defaultNodeId(day),
      label: d.title,
    }
  );
}

/** Label for home / mobile primary CTA from the resolved next target. */
export function primaryCtaLabel(
  target: TaskTarget | null,
  fallback = "继续学习",
): string {
  if (!target?.label) return fallback;
  return `继续：${target.label}`;
}

/** Flatten list-days node summaries into task cards for the home dashboard. */
export function buildTaskCards(days: DaySummary[]): TaskCard[] {
  const cards: TaskCard[] = [];
  let markedUrgent = false;

  for (const d of days) {
    for (const n of visibleNodes(d.nodes)) {
      const status = String(n.status);
      const done = isDone(status);
      const locked = Boolean(d.locked) || status === "locked";
      const urgent = !markedUrgent && !done && !locked && isActionable(status);
      if (urgent) markedUrgent = true;

      cards.push({
        id: `${d.day}-${n.id}`,
        day: d.day,
        dayTitle: d.title,
        nodeId: n.id,
        nodeTitle: n.title,
        kind: n.kind,
        status,
        done,
        locked,
        urgent,
      });
    }
  }
  return cards;
}

function currentWeekDays(weeks: Record<string, number[]>, days: DaySummary[]): number[] {
  const dayNums = days.map((d) => d.day);
  for (const nums of Object.values(weeks)) {
    if (nums.some((d) => dayNums.includes(d))) return nums;
  }
  return dayNums.slice(0, 5);
}

/** One-line progress summary for TaskHome header. */
export function summarizeProgress(days: DaySummary[], weeks: Record<string, number[]>): ProgressSummary {
  let passed = 0;
  let total = 0;
  let pending = 0;

  for (const d of days) {
    passed += d.passed ?? 0;
    total += d.total ?? 0;
    for (const n of visibleNodes(d.nodes)) {
      const s = String(n.status);
      if (!isDone(s) && s !== "locked" && !d.locked) pending += 1;
    }
  }

  const weekNums = currentWeekDays(weeks, days);
  let weekPassed = 0;
  let weekTotal = 0;
  for (const d of days) {
    if (!weekNums.includes(d.day)) continue;
    weekPassed += d.passed ?? 0;
    weekTotal += d.total ?? 0;
  }

  const pct = total > 0 ? Math.round((passed / total) * 100) : 0;
  const weekStart = weekNums[0];
  const weekEnd = weekNums[weekNums.length - 1];

  return {
    passed,
    total,
    pending,
    pct,
    weekPassed,
    weekTotal,
    weekLabel:
      weekStart && weekEnd
        ? `${dayLabel(weekStart)}–${dayLabel(weekEnd)} ${weekPassed}/${weekTotal}`
        : `${weekPassed}/${weekTotal}`,
  };
}
