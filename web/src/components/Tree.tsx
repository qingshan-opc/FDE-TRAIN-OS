import { useEffect, useState, type MouseEvent } from "react";
import type { DayNodeSummary, DaySummary } from "../lib/types";
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
}

function kindLabel(kind: string) {
  if (kind === "learn") return "学习";
  if (kind === "quiz") return "测验";
  if (kind === "lab") return "Lab";
  if (kind === "project") return "项目";
  if (kind === "review") return "复盘";
  return kind;
}

function NodeIcon({
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

export function Tree({
  days,
  weeks,
  activeDay,
  activeNodeId = null,
  onSelectDay,
  onSelectNode,
  dayStatuses = {},
}: TreeProps) {
  const byDay = new Map(days.map((d) => [d.day, d]));
  const weekEntries = Object.entries(weeks).sort(([a], [b]) => Number(a) - Number(b));
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set(activeDay ? [activeDay] : []));

  useEffect(() => {
    if (activeDay == null) return;
    setExpanded((prev) => (prev.has(activeDay) ? prev : new Set(prev).add(activeDay)));
  }, [activeDay]);

  const toggle = (day: number, e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return next;
    });
  };

  const selectDay = (n: number, locked: boolean, nodes: DayNodeSummary[]) => {
    if (locked) return;
    onSelectDay(n);
    if (nodes.length) {
      setExpanded((prev) => (prev.has(n) ? prev : new Set(prev).add(n)));
    }
  };

  return (
    <div className="syllabus-tree">
      {weekEntries.map(([week, dayNums]) => (
        <section key={week} className="syllabus-week">
          <h3 className="syllabus-week-label">第{week}周</h3>
          <ul className="syllabus-day-list">
            {dayNums.map((n) => {
              const d = byDay.get(n);
              const st = dayStatuses[n];
              const locked = !d || Boolean(d.locked);
              const selected = activeDay === n;
              const isOpen = expanded.has(n) && !locked;
              const nodes: DayNodeSummary[] = d?.nodes ?? st?.nodes ?? [];
              const progress = st && st.total > 0 ? `${st.passed}/${st.total}` : d ? "—" : "";
              const title = locked && d ? dayUnlockHint(n - 1) : d?.title || "暂无课程包";

              return (
                <li key={n} className={`syllabus-day${selected ? " is-selected" : ""}${locked ? " is-locked" : ""}`}>
                  <div className={`syllabus-day-row${selected ? " is-active" : ""}`}>
                    <button
                      type="button"
                      className="syllabus-chevron"
                      aria-label={isOpen ? `收起${dayLabel(n)}` : `展开${dayLabel(n)}`}
                      disabled={locked || nodes.length === 0}
                      onClick={(e) => toggle(n, e)}
                    >
                      {locked ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                          <rect x="3" y="11" width="18" height="11" rx="2" />
                          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        </svg>
                      ) : (
                        <span className={`syllabus-chevron-glyph${isOpen ? " is-open" : ""}`} aria-hidden>
                          ▸
                        </span>
                      )}
                    </button>

                    <button
                      type="button"
                      className="syllabus-day-hit"
                      disabled={locked}
                      aria-current={selected ? "page" : undefined}
                      onClick={() => selectDay(n, locked, nodes)}
                    >
                      <span className="syllabus-day-line">
                        <span className="syllabus-day-name">{dayLabel(n)}</span>
                        {progress ? <span className="syllabus-day-progress">{progress}</span> : null}
                      </span>
                      <span className="syllabus-day-title">{title}</span>
                    </button>
                  </div>

                  {isOpen && nodes.length > 0 && (
                    <ul className="syllabus-node-list">
                      {nodes.map((node) => {
                        const nodeLocked = node.status === "locked";
                        const nodeSelected = selected && activeNodeId === node.id;
                        const nodeDone = node.status === "passed";
                        return (
                          <li key={node.id}>
                            <button
                              type="button"
                              className={`syllabus-item${nodeSelected ? " is-active" : ""}${nodeDone ? " is-read" : ""}`}
                              onClick={() => !nodeLocked && onSelectNode?.(n, node.id)}
                              disabled={nodeLocked}
                              aria-current={nodeSelected ? "step" : undefined}
                            >
                              <NodeIcon locked={nodeLocked} done={nodeDone} active={nodeSelected} />
                              <span className="syllabus-item-body">
                                <span className="syllabus-item-title">{node.title || node.kind}</span>
                                <span className="syllabus-item-meta">
                                  {kindLabel(String(node.kind))}
                                  {nodeSelected ? " · 进行中" : nodeDone ? " · 已完成" : ""}
                                </span>
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
