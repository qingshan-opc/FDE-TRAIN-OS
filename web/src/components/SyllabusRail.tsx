import type { Capsule, DayNodeSummary, DayPackage, DaySummary, NodeState } from "../lib/types";
import { dayLabel } from "../lib/dayLabel";
import { Tree } from "./Tree";

interface DayStatusEntry {
  passed: number;
  total: number;
  runner?: string | null;
  nodes?: DayNodeSummary[];
}

/** Left-rail syllabus: always the outer Week/Day tree; learn capsules nest under the active node. */
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
  locked?: boolean;
  onSelectDay: (day: number) => void;
  onSelectNode?: (day: number, nodeId: string) => void;
  onSelectCapsule: (id: string) => void;
}) {
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
        capsules={capsules}
        openCapsuleId={openCapsuleId}
        readCapsuleIds={readCapsuleIds}
        onSelectDay={onSelectDay}
        onSelectNode={onSelectNode}
        onSelectCapsule={onSelectCapsule}
      />
    </nav>
  );
}
