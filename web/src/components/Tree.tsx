import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import type { Capsule, DayNodeSummary, DaySummary } from "../lib/types";
import { dayLabel, dayUnlockHint } from "../lib/dayLabel";

export const WEEK_QUIZ_PREFIX = "week-";
export const WEEK_QUIZ_SUFFIX = "-quiz";

export function weekQuizNodeId(week: number): string {
  return `${WEEK_QUIZ_PREFIX}${week}${WEEK_QUIZ_SUFFIX}`;
}

export function parseWeekQuizNodeId(nodeId: string | null | undefined): number | null {
  if (!nodeId?.startsWith(WEEK_QUIZ_PREFIX) || !nodeId.endsWith(WEEK_QUIZ_SUFFIX)) return null;
  const n = Number(nodeId.slice(WEEK_QUIZ_PREFIX.length, -WEEK_QUIZ_SUFFIX.length));
  return Number.isFinite(n) && n > 0 ? n : null;
}

const WEEK_CN: Record<number, string> = {
  1: "第一周",
  2: "第二周",
  3: "第三周",
  4: "第四周",
};

function weekLabel(week: number): string {
  return WEEK_CN[week] || `第${week}周`;
}

/** Day-level nodes hidden from the simplified syllabus. */
const HIDDEN_DAY_KINDS = new Set(["quiz", "project", "review", "unlock"]);

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
  onSelectWeekQuiz?: (week: number, anchorDay: number) => void;
  dayStatuses?: Record<number, DayStatusEntry>;
  /** Capsules under the active day's learn node. */
  capsules?: Capsule[];
  openCapsuleId?: string | null;
  readCapsuleIds?: Set<string>;
  onSelectCapsule?: (id: string) => void;
}

function Chevron({ open, locked }: { open: boolean; locked?: boolean }) {
  if (locked) {
    return (
      <span className="syllabus-icon is-locked" aria-hidden>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="11" width="18" height="11" rx="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      </span>
    );
  }
  if (done && !active) {
    return (
      <span className="syllabus-icon is-done" aria-hidden>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </span>
    );
  }
  if (active) {
    return (
      <span className="syllabus-icon is-playing" aria-hidden>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M8 5v14l11-7z" />
        </svg>
      </span>
    );
  }
  return (
    <span className="syllabus-icon is-pending" aria-hidden>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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

function learnerDayNodes(nodes: DayNodeSummary[]): DayNodeSummary[] {
  return nodes.filter((n) => !HIDDEN_DAY_KINDS.has(String(n.kind)));
}

function learnNodeId(nodes: DayNodeSummary[], day: number): string | null {
  return nodes.find((n) => n.kind === "learn")?.id || `d${day}-learn`;
}

/**
 * Syllabus sidebar:
 * Week → Day → capsules (no「今日课节」folder)
 *         ↘ week-level 概念验收
 */
export function Tree({
  days,
  weeks,
  activeDay,
  activeNodeId = null,
  onSelectDay,
  onSelectNode,
  onSelectWeekQuiz,
  dayStatuses = {},
  capsules = [],
  openCapsuleId = null,
  readCapsuleIds,
  onSelectCapsule,
}: TreeProps) {
  const byDay = useMemo(() => new Map(days.map((d) => [d.day, d])), [days]);
  const weekEntries = useMemo(() => {
    const entries = Object.entries(weeks)
      .map(([w, nums]) => ({ week: Number(w), days: [...nums] }))
      .filter((e) => Number.isFinite(e.week) && e.days.length)
      .sort((a, b) => a.week - b.week);
    if (entries.length) return entries;
    const nums = days.map((d) => d.day).sort((a, b) => a - b);
    return nums.length ? [{ week: 1, days: nums }] : [];
  }, [weeks, days]);

  const activeWeek = useMemo(() => {
    if (activeDay == null) return weekEntries[0]?.week ?? 1;
    for (const e of weekEntries) {
      if (e.days.includes(activeDay)) return e.week;
    }
    return weekEntries[0]?.week ?? 1;
  }, [activeDay, weekEntries]);

  const weekQuizWeek = parseWeekQuizNodeId(activeNodeId);

  const [expandedWeeks, setExpandedWeeks] = useState<Set<number>>(
    () => new Set([activeWeek]),
  );
  const [expandedDays, setExpandedDays] = useState<Set<number>>(
    () => new Set(activeDay ? [activeDay] : []),
  );

  const prevDayRef = useRef<number | null>(null);
  const prevWeekRef = useRef<number | null>(null);

  useEffect(() => {
    if (prevWeekRef.current === activeWeek) return;
    prevWeekRef.current = activeWeek;
    setExpandedWeeks((prev) => (prev.has(activeWeek) ? prev : new Set(prev).add(activeWeek)));
  }, [activeWeek]);

  useEffect(() => {
    if (activeDay == null) return;
    if (prevDayRef.current === activeDay) return;
    prevDayRef.current = activeDay;
    setExpandedDays((prev) => (prev.has(activeDay) ? prev : new Set(prev).add(activeDay)));
  }, [activeDay]);

  const onWeekToggle = (week: number, e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setExpandedWeeks((prev) => toggleInSet(prev, week));
  };

  const onDayChevron = (day: number, e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setExpandedDays((prev) => toggleInSet(prev, day));
  };

  const onDayClick = (n: number, locked: boolean) => {
    if (locked) return;
    if (activeDay === n) {
      setExpandedDays((prev) => toggleInSet(prev, n));
      return;
    }
    onSelectDay(n);
    setExpandedDays((prev) => new Set(prev).add(n));
  };

  return (
    <div className="syllabus-tree">
      {weekEntries.map(({ week, days: dayNums }) => {
        const weekOpen = expandedWeeks.has(week);
        const weekQuizActive = weekQuizWeek === week;
        const weekQuizDone = dayNums.every((n) => {
          const nodes = byDay.get(n)?.nodes ?? dayStatuses[n]?.nodes ?? [];
          const q = nodes.find((x) => x.kind === "quiz");
          return q?.status === "passed";
        });
        const weekLocked = dayNums.every((n) => {
          const d = byDay.get(n);
          return !d || d.locked;
        });
        const anchorDay = dayNums.find((n) => {
          const d = byDay.get(n);
          return d && !d.locked;
        }) ?? dayNums[0];

        return (
          <section key={week} className={`syllabus-week${weekOpen ? " is-open" : ""}`}>
            <button
              type="button"
              className="syllabus-week-toggle"
              aria-expanded={weekOpen}
              onClick={(e) => onWeekToggle(week, e)}
            >
              <Chevron open={weekOpen} />
              <span className="syllabus-week-label">{weekLabel(week)}</span>
            </button>

            {weekOpen ? (
              <ul className="syllabus-day-list">
                {dayNums.map((n) => {
                  const d = byDay.get(n);
                  const st = dayStatuses[n];
                  const locked = !d || Boolean(d.locked);
                  const selected = activeDay === n && !weekQuizActive;
                  const rawNodes: DayNodeSummary[] = d?.nodes ?? st?.nodes ?? [];
                  const nodes = learnerDayNodes(rawNodes);
                  const learnId = learnNodeId(rawNodes, n);
                  // Flatten capsules under the open day (no「今日课节」folder).
                  const showCapsules =
                    activeDay === n &&
                    Boolean(learnId) &&
                    capsules.length > 0 &&
                    Boolean(onSelectCapsule);
                  const isOpen = expandedDays.has(n) && !locked;
                  const progress =
                    st && st.total > 0
                      ? `${st.passed}/${st.total}`
                      : d
                        ? "—"
                        : "";
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
                          disabled={locked}
                          onClick={(e) => onDayChevron(n, e)}
                        >
                          <Chevron open={isOpen} locked={locked} />
                        </button>

                        <button
                          type="button"
                          className="syllabus-day-hit"
                          disabled={locked}
                          aria-current={selected ? "page" : undefined}
                          aria-expanded={isOpen}
                          onClick={() => onDayClick(n, locked)}
                        >
                          <span className="syllabus-day-line">
                            <span className="syllabus-day-name">{dayLabel(n)}</span>
                            {progress ? <span className="syllabus-day-progress">{progress}</span> : null}
                          </span>
                          <span className="syllabus-day-title">{title}</span>
                        </button>
                      </div>

                      {isOpen ? (
                        <ul className="syllabus-node-list syllabus-capsule-list" aria-label="本日课件">
                          {showCapsules ? (
                            capsules.map((c, i) => {
                              const capSelected = (openCapsuleId || capsules[0]?.id) === c.id;
                              const capDone = readCapsuleIds?.has(c.id) ?? false;
                              return (
                                <li key={c.id}>
                                  <button
                                    type="button"
                                    className={`syllabus-item syllabus-capsule-item${capSelected ? " is-active" : ""}${capDone ? " is-read" : ""}`}
                                    onClick={() => {
                                      if (learnId) onSelectNode?.(n, learnId);
                                      onSelectCapsule?.(c.id);
                                    }}
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
                            })
                          ) : (
                            nodes
                              .filter((node) => node.kind === "learn" || node.kind === "lab")
                              .map((node) => {
                                const nodeLocked = node.status === "locked";
                                const nodeSelected =
                                  selected && activeNodeId === node.id && !showCapsules;
                                const nodeDone = node.status === "passed";
                                return (
                                  <li key={node.id}>
                                    <button
                                      type="button"
                                      className={`syllabus-item${nodeSelected ? " is-active" : ""}${nodeDone ? " is-read" : ""}`}
                                      onClick={() => onSelectNode?.(n, node.id)}
                                      disabled={nodeLocked}
                                      aria-current={nodeSelected ? "step" : undefined}
                                    >
                                      <LeafIcon
                                        locked={nodeLocked}
                                        done={nodeDone}
                                        active={nodeSelected}
                                      />
                                      <span className="syllabus-item-body">
                                        <span className="syllabus-item-title">
                                          {node.kind === "learn" ? "进入课件" : node.title || "Lab"}
                                        </span>
                                        <span className="syllabus-item-meta">
                                          {node.kind === "lab" ? "Lab" : "课件"}
                                          {nodeDone ? " · 已完成" : ""}
                                        </span>
                                      </span>
                                    </button>
                                  </li>
                                );
                              })
                          )}
                        </ul>
                      ) : null}
                    </li>
                  );
                })}

                <li className="syllabus-week-quiz">
                  <button
                    type="button"
                    className={`syllabus-item syllabus-week-quiz-item${weekQuizActive ? " is-active" : ""}${weekQuizDone ? " is-read" : ""}`}
                    disabled={weekLocked || !anchorDay}
                    onClick={() => {
                      if (anchorDay != null) onSelectWeekQuiz?.(week, anchorDay);
                    }}
                    aria-current={weekQuizActive ? "step" : undefined}
                  >
                    <LeafIcon locked={weekLocked} done={weekQuizDone} active={weekQuizActive} />
                    <span className="syllabus-item-body">
                      <span className="syllabus-item-title">{weekLabel(week)}概念验收</span>
                      <span className="syllabus-item-meta">
                        周测
                        {weekQuizActive ? " · 进行中" : weekQuizDone ? " · 已完成" : ""}
                      </span>
                    </span>
                  </button>
                </li>
              </ul>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
