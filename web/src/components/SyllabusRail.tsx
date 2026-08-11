import type { Capsule, DayNodeSummary, DayPackage, DaySummary, NodeState } from "../lib/types";
import { Tree } from "./Tree";

interface DayStatusEntry {
  passed: number;
  total: number;
  runner?: string | null;
  nodes?: DayNodeSummary[];
}

/**
 * Left-rail syllabus:
 * Week → Day → capsules (no「今日课节」folder) + weekly 概念验收
 */
export function SyllabusRail({
  days,
  weeks,
  activeDay,
  activeNodeId,
  dayStatuses,
  dayPkg,
  capsules,
  openCapsuleId,
  readCapsuleIds,
  onSelectDay,
  onSelectNode,
  onSelectWeekQuiz,
  onSelectCapsule,
}: {
  days: DaySummary[];
  weeks: Record<string, number[]>;
  activeDay: number | null;
  activeNodeId?: string | null;
  dayStatuses?: Record<number, DayStatusEntry>;
  dayPkg: DayPackage | null;
  activeNode?: NodeState | null;
  capsules: Capsule[];
  openCapsuleId: string | null;
  readCapsuleIds: Set<string>;
  acceptedCapsuleIds: Set<string>;
  locked?: boolean;
  onSelectDay: (day: number) => void;
  onSelectNode?: (day: number, nodeId: string) => void;
  onSelectWeekQuiz?: (week: number, anchorDay: number) => void;
  onSelectCapsule: (id: string) => void;
}) {
  const inDay = Boolean(activeDay && dayPkg);

  return (
    <nav className="syllabus-rail syllabus-rail--daily" aria-label="课程大纲">
      <header className="syllabus-head">
        <h2 className="syllabus-title">用 AI 做出完整应用</h2>
        <p className="syllabus-subtitle">
          {inDay && dayPkg && activeDay
            ? `Day ${activeDay} · ${dayPkg.title}`
            : "选择一天开始今日训练"}
        </p>
      </header>

      <Tree
        days={days}
        weeks={weeks}
        activeDay={activeDay}
        activeNodeId={activeNodeId}
        dayStatuses={dayStatuses}
        capsules={capsules}
        openCapsuleId={openCapsuleId}
        readCapsuleIds={readCapsuleIds}
        onSelectDay={onSelectDay}
        onSelectNode={onSelectNode}
        onSelectWeekQuiz={onSelectWeekQuiz}
        onSelectCapsule={onSelectCapsule}
      />
    </nav>
  );
}
