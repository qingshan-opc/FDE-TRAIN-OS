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
 * + week-1 作业 · 驾驶舱（under 概念验收）
 */
export function SyllabusRail({
  days,
  weeks,
  activeDay,
  activeNodeId,
  dayStatuses,
  capsules,
  openCapsuleId,
  readCapsuleIds,
  week1CockpitHomeworkDone,
  onSelectDay,
  onSelectNode,
  onSelectWeekQuiz,
  onSelectWeekCockpitHomework,
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
  week1CockpitHomeworkDone?: boolean;
  locked?: boolean;
  onSelectDay: (day: number) => void;
  onSelectNode?: (day: number, nodeId: string) => void;
  onSelectWeekQuiz?: (week: number, anchorDay: number) => void;
  onSelectWeekCockpitHomework?: (week: number, anchorDay: number) => void;
  onSelectCapsule: (id: string) => void;
}) {
  return (
    <nav className="syllabus-rail syllabus-rail--daily" aria-label="课程大纲">
      <header className="syllabus-head">
        <h2 className="syllabus-title">从0到1入门FDE</h2>
        <p className="syllabus-subtitle">几百个学习节点，助你在AI时代翱翔！</p>
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
        week1CockpitHomeworkDone={week1CockpitHomeworkDone}
        onSelectDay={onSelectDay}
        onSelectNode={onSelectNode}
        onSelectWeekQuiz={onSelectWeekQuiz}
        onSelectWeekCockpitHomework={onSelectWeekCockpitHomework}
        onSelectCapsule={onSelectCapsule}
      />
    </nav>
  );
}
