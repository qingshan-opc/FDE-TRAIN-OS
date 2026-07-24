import type { Capsule, DayNodeSummary, DayPackage, DaySummary, NodeState } from "../lib/types";
import { dayLabel } from "../lib/dayLabel";
import { Tree } from "./Tree";

interface DayStatusEntry {
  passed: number;
  total: number;
  runner?: string | null;
  nodes?: DayNodeSummary[];
}

function StatusIcon({
  locked,
  active,
  done,
}: {
  locked?: boolean;
  active?: boolean;
  done?: boolean;
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
        <circle cx="12" cy="12" r="8" />
      </svg>
    </span>
  );
}

function formatMinutes(m?: number) {
  if (m == null) return null;
  const mins = Math.max(0, Math.round(m));
  const mm = String(mins % 60).padStart(2, "0");
  const hh = String(Math.floor(mins / 60)).padStart(2, "0");
  return mins >= 60 ? `${hh}:${mm}` : `00:${String(mins).padStart(2, "0")}`;
}

/** Left-rail syllabus: Week/Day tree, or capsule list when a learn node is active. */
export function SyllabusRail({
  mode,
  days,
  weeks,
  activeDay,
  activeNodeId,
  dayStatuses,
  dayPkg,
  activeNode,
  capsules,
  openCapsuleId,
  readCapsuleIds,
  locked,
  onSelectDay,
  onSelectNode,
  onSelectCapsule,
  onBackToTree,
}: {
  mode: "tree" | "capsules";
  days: DaySummary[];
  weeks: Record<string, number[]>;
  activeDay: number | null;
  activeNodeId?: string | null;
  dayStatuses?: Record<number, DayStatusEntry>;
  dayPkg: DayPackage | null;
  activeNode: NodeState | null;
  capsules: Capsule[];
  openCapsuleId: string | null;
  readCapsuleIds: Set<string>;
  locked?: boolean;
  onSelectDay: (day: number) => void;
  onSelectNode?: (day: number, nodeId: string) => void;
  onSelectCapsule: (id: string) => void;
  onBackToTree: () => void;
}) {
  if (mode === "capsules" && dayPkg && capsules.length > 0) {
    return (
      <nav className="syllabus-rail" aria-label="课程大纲">
        <header className="syllabus-head">
          <button type="button" className="syllabus-back" onClick={onBackToTree}>
            ← 返回课表
          </button>
          <h2 className="syllabus-title">课程大纲</h2>
          <p className="syllabus-subtitle">
            {dayLabel(dayPkg.day)}：{dayPkg.title}
            {activeNode ? ` · ${activeNode.title}` : ""}
          </p>
        </header>
        <ol className="syllabus-list">
          {capsules.map((c, i) => {
            const selected = (openCapsuleId || capsules[0]?.id) === c.id;
            const done = readCapsuleIds.has(c.id);
            const duration = formatMinutes(c.minutes);
            return (
              <li key={c.id}>
                <button
                  type="button"
                  className={`syllabus-item ${selected ? "is-active" : ""} ${done ? "is-read" : ""}`}
                  onClick={() => onSelectCapsule(c.id)}
                  disabled={locked}
                  aria-current={selected ? "page" : undefined}
                >
                  <StatusIcon locked={locked} active={selected} done={done} />
                  <span className="syllabus-item-body">
                    <span className="syllabus-item-title">
                      {i + 1}. {c.title}
                    </span>
                    <span className="syllabus-item-meta">
                      {selected ? "正在学习" : duration ? duration : `第 ${i + 1} 节`}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>
    );
  }

  return (
    <nav className="syllabus-rail" aria-label="课程大纲">
      <header className="syllabus-head">
        <h2 className="syllabus-title">课程大纲</h2>
        <p className="syllabus-subtitle">
          {activeDay && dayPkg
            ? `${dayLabel(activeDay)}：${dayPkg.title}`
            : "选择一天开始学习"}
        </p>
      </header>
      <Tree
        days={days}
        weeks={weeks}
        activeDay={activeDay}
        activeNodeId={activeNodeId}
        dayStatuses={dayStatuses}
        onSelectDay={onSelectDay}
        onSelectNode={onSelectNode}
      />
    </nav>
  );
}
