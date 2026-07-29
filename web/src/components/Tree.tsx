import { useEffect, useRef, useState, type MouseEvent } from "react";
import type { Capsule, DayNodeSummary, DaySummary } from "../lib/types";
import { dayLabel, dayUnlockHint } from "../lib/dayLabel";

interface DayStatusEntry {
  passed: number;
  total: number;
  runner?: string | null;
  nodes?: DayNodeSummary[];
}

interface TreeProps {
  days: DaySummary[];
  weeks: Record<string, number[]>;
  activeDay: number | null;
  activeNodeId?: string | null;
  onSelectDay: (day: number) => void;
  onSelectNode?: (day: number, nodeId: string) => void;
  dayStatuses?: Record<number, DayStatusEntry>;
  /** Capsules under the active learn node — shown nested in the outer tree. */
  capsules?: Capsule[];
  openCapsuleId?: string | null;
  readCapsuleIds?: Set<string>;
  onSelectCapsule?: (id: string) => void;
}

function kindLabel(kind: string) {
  if (kind === "learn") return "学习";
  if (kind === "quiz") return "测验";
  if (kind === "lab") return "Lab";
  if (kind === "project") return "项目";
  if (kind === "review") return "复盘";
  return kind;
}

function Chevron({ open, locked }: { open: boolean; locked?: boolean }) {
  if (locked) {
    return (
      <span className="syllabus-icon is-locked" aria-hidden>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="11" width="18" height="11" rx="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      </span>
    );
  }
  return (
    <span className={`syllabus-chevron-glyph${open ? " is-open" : ""}`} aria-hidden>
      ▸
    </span>
  );
}

function LeafIcon({
  locked,
  done,
  active,
}: {
  locked: boolean;
  done: boolean;
  active: boolean;
}) {
  if (locked) {
    return (
      <span className="syllabus-icon is-locked" aria-hidden>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="11" width="18" height="11" rx="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      </span>
    );
  }
  if (done && !active) {
    return (
      <span className="syllabus-icon is-done" aria-hidden>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </span>
    );
  }
  if (active) {
    return (
      <span className="syllabus-icon is-playing" aria-hidden>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M8 5v14l11-7z" />
        </svg>
      </span>
    );
  }
  return (
    <span className="syllabus-icon is-pending" aria-hidden>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="7" />
      </svg>
    </span>
  );
}

function toggleInSet<T>(prev: Set<T>, key: T): Set<T> {
  const next = new Set(prev);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  return next;
}

/**
 * Enterprise-style syllabus sidebar:
 * - Week / Day / Learn(folder) = expandable parents (click toggles)
 * - Capsule / quiz / lab / … = leaves (click navigates)
 */
export function Tree({
  days,
  weeks,
  activeDay,
  activeNodeId = null,
  onSelectDay,
  onSelectNode,
  dayStatuses = {},
  capsules = [],
  openCapsuleId = null,
  readCapsuleIds,
  onSelectCapsule,
}: TreeProps) {
  const byDay = new Map(days.map((d) => [d.day, d]));
  const weekEntries = Object.entries(weeks).sort(([a], [b]) => Number(a) - Number(b));

  const activeWeek =
    activeDay == null
      ? null
      : weekEntries.find(([, nums]) => nums.includes(activeDay))?.[0] ?? null;

  const [expandedWeeks, setExpandedWeeks] = useState<Set<string>>(
    () => new Set(activeWeek ? [activeWeek] : weekEntries.map(([w]) => w)),
  );
  const [expandedDays, setExpandedDays] = useState<Set<number>>(
    () => new Set(activeDay ? [activeDay] : []),
  );
  /** Learn-node folders that show nested capsules. */
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(() => new Set());

  const prevDayRef = useRef<number | null>(null);
  const prevNodeRef = useRef<string | null>(null);

  // Navigate to a new day → open its week + day (manual collapse of same day still sticks).
  useEffect(() => {
    if (activeDay == null) return;
    if (prevDayRef.current === activeDay) return;
    prevDayRef.current = activeDay;
    const week = Object.entries(weeks).find(([, nums]) => nums.includes(activeDay))?.[0];
    if (week) {
      setExpandedWeeks((prev) => (prev.has(week) ? prev : new Set(prev).add(week)));
    }
    setExpandedDays((prev) => (prev.has(activeDay) ? prev : new Set(prev).add(activeDay)));
  }, [activeDay, weeks]);

  // Enter a learn node (or capsules finish loading) → open folder once; user can collapse after.
  useEffect(() => {
    if (!activeNodeId || capsules.length === 0) return;
    if (prevNodeRef.current === activeNodeId) return;
    prevNodeRef.current = activeNodeId;
    setExpandedFolders((prev) =>
      prev.has(activeNodeId) ? prev : new Set(prev).add(activeNodeId),
    );
  }, [activeNodeId, capsules.length]);

  const onWeekClick = (week: string) => {
    setExpandedWeeks((prev) => toggleInSet(prev, week));
  };

  const onDayChevron = (day: number, e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setExpandedDays((prev) => toggleInSet(prev, day));
  };

  const onDayClick = (n: number, locked: boolean, nodes: DayNodeSummary[]) => {
    if (locked) return;
    const hasChildren = nodes.length > 0;
    if (activeDay === n) {
      if (hasChildren) setExpandedDays((prev) => toggleInSet(prev, n));
      return;
    }
    onSelectDay(n);
    if (hasChildren) {
      setExpandedDays((prev) => new Set(prev).add(n));
    }
  };

  const onNodeClick = (day: number, node: DayNodeSummary, hasCapsules: boolean) => {
    if (node.status === "locked") return;
    const selected = activeDay === day && activeNodeId === node.id;
    onSelectNode?.(day, node.id);
    if (!hasCapsules) return;
    if (selected) {
      setExpandedFolders((prev) => toggleInSet(prev, node.id));
    } else {
      setExpandedFolders((prev) => new Set(prev).add(node.id));
    }
  };

  const onFolderChevron = (nodeId: string, e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setExpandedFolders((prev) => toggleInSet(prev, nodeId));
  };

  return (
    <div className="syllabus-tree">
      {weekEntries.map(([week, dayNums]) => {
        const weekOpen = expandedWeeks.has(week);
        return (
          <section key={week} className="syllabus-week">
            <button
              type="button"
              className="syllabus-week-toggle"
              aria-expanded={weekOpen}
              onClick={() => onWeekClick(week)}
            >
              <span className="syllabus-week-label">第{week}周</span>
              <Chevron open={weekOpen} />
            </button>

            {weekOpen ? (
              <ul className="syllabus-day-list">
                {dayNums.map((n) => {
                  const d = byDay.get(n);
                  const st = dayStatuses[n];
                  const locked = !d || Boolean(d.locked);
                  const selected = activeDay === n;
                  const nodes: DayNodeSummary[] = d?.nodes ?? st?.nodes ?? [];
                  const hasChildren = nodes.length > 0;
                  const isOpen = expandedDays.has(n) && !locked && hasChildren;
                  const progress = st && st.total > 0 ? `${st.passed}/${st.total}` : d ? "—" : "";
                  const title = locked && d ? dayUnlockHint(n - 1) : d?.title || "暂无课程包";

                  return (
                    <li
                      key={n}
                      className={`syllabus-day${selected ? " is-selected" : ""}${locked ? " is-locked" : ""}`}
                    >
                      <div className={`syllabus-day-row${selected ? " is-active" : ""}`}>
                        <button
                          type="button"
                          className="syllabus-chevron"
                          aria-label={isOpen ? `收起${dayLabel(n)}` : `展开${dayLabel(n)}`}
                          disabled={locked || !hasChildren}
                          onClick={(e) => onDayChevron(n, e)}
                        >
                          <Chevron open={isOpen} locked={locked} />
                        </button>

                        <button
                          type="button"
                          className="syllabus-day-hit"
                          disabled={locked}
                          aria-current={selected ? "page" : undefined}
                          aria-expanded={hasChildren ? isOpen : undefined}
                          onClick={() => onDayClick(n, locked, nodes)}
                        >
                          <span className="syllabus-day-line">
                            <span className="syllabus-day-name">{dayLabel(n)}</span>
                            {progress ? <span className="syllabus-day-progress">{progress}</span> : null}
                          </span>
                          <span className="syllabus-day-title">{title}</span>
                        </button>
                      </div>

                      {isOpen ? (
                        <ul className="syllabus-node-list">
                          {nodes.map((node) => {
                            const nodeLocked = node.status === "locked";
                            const nodeSelected = selected && activeNodeId === node.id;
                            const nodeDone = node.status === "passed";
                            const hasCapsules =
                              nodeSelected &&
                              node.kind === "learn" &&
                              capsules.length > 0 &&
                              Boolean(onSelectCapsule);
                            const folderOpen = hasCapsules && expandedFolders.has(node.id);

                            return (
                              <li key={node.id} className={folderOpen ? "is-folder-open" : undefined}>
                                <div className="syllabus-node-row">
                                  {hasCapsules ? (
                                    <button
                                      type="button"
                                      className="syllabus-chevron syllabus-chevron-nested"
                                      aria-label={folderOpen ? "收起课件" : "展开课件"}
                                      onClick={(e) => onFolderChevron(node.id, e)}
                                    >
                                      <Chevron open={folderOpen} />
                                    </button>
                                  ) : null}
                                  <button
                                    type="button"
                                    className={`syllabus-item${nodeSelected ? " is-active" : ""}${nodeDone ? " is-read" : ""}${hasCapsules ? " is-folder" : ""}`}
                                    onClick={() => onNodeClick(n, node, hasCapsules)}
                                    disabled={nodeLocked}
                                    aria-current={nodeSelected ? "step" : undefined}
                                    aria-expanded={hasCapsules ? folderOpen : undefined}
                                  >
                                    {hasCapsules ? null : (
                                      <LeafIcon locked={nodeLocked} done={nodeDone} active={nodeSelected} />
                                    )}
                                    <span className="syllabus-item-body">
                                      <span className="syllabus-item-title">{node.title || node.kind}</span>
                                      <span className="syllabus-item-meta">
                                        {kindLabel(String(node.kind))}
                                        {nodeSelected ? " · 进行中" : nodeDone ? " · 已完成" : ""}
                                      </span>
                                    </span>
                                  </button>
                                </div>

                                {folderOpen ? (
                                  <ul className="syllabus-capsule-list" aria-label="本节课件">
                                    {capsules.map((c, i) => {
                                      const capSelected = (openCapsuleId || capsules[0]?.id) === c.id;
                                      const capDone = readCapsuleIds?.has(c.id) ?? false;
                                      return (
                                        <li key={c.id}>
                                          <button
                                            type="button"
                                            className={`syllabus-item syllabus-capsule-item${capSelected ? " is-active" : ""}${capDone ? " is-read" : ""}`}
                                            onClick={() => onSelectCapsule?.(c.id)}
                                            aria-current={capSelected ? "page" : undefined}
                                          >
                                            <LeafIcon
                                              locked={false}
                                              done={capDone && !capSelected}
                                              active={capSelected}
                                            />
                                            <span className="syllabus-item-body">
                                              <span className="syllabus-item-title">
                                                {i + 1}. {c.title}
                                              </span>
                                              <span className="syllabus-item-meta">
                                                {capSelected ? "正在学习" : capDone ? "已读" : "课件"}
                                              </span>
                                            </span>
                                          </button>
                                        </li>
                                      );
                                    })}
                                  </ul>
                                ) : null}
                              </li>
                            );
                          })}
                        </ul>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
