import { useState } from "react";
import type { Capsule, DayNodeSummary, DayPackage, DaySummary, NodeState } from "../lib/types";
import { dayLabel } from "../lib/dayLabel";
import { Tree } from "./Tree";
import { Link } from "react-router-dom";

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
  acceptedCapsuleIds,
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
  acceptedCapsuleIds: Set<string>;
  locked?: boolean;
  onSelectDay: (day: number) => void;
  onSelectNode?: (day: number, nodeId: string) => void;
  onSelectCapsule: (id: string) => void;
}) {
  const [expandedDays, setExpandedDays] = useState<Set<number>>(() => new Set([1, 2, 3, 4, 5]));

  const toggleDay = (day: number) => {
    setExpandedDays((prev) => {
      const next = new Set(prev);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return next;
    });
  };

  if (activeDay && dayPkg) {
    const completeCount = capsules.filter((c) => acceptedCapsuleIds.has(c.id)).length;
    const progress = capsules.length ? Math.round((completeCount * 100) / capsules.length) : 0;
    const releaseLabel = ["V0.1", "V0.5", "V0.8", "RC1", "V1.0"][Math.min(activeDay - 1, 4)] || `D${activeDay}`;
    return (
      <nav className="syllabus-rail syllabus-rail--daily" aria-label="第一周 Day1 到 Day5 课程目录">
        <header className="syllabus-head">
          <Link className="syllabus-back" to="/app">
            ← 返回今日训练
          </Link>
          <h2 className="syllabus-title">用 AI 做出完整应用</h2>
          <p className="syllabus-subtitle">
            Day {activeDay} · {dayPkg.title}
          </p>
        </header>

        <section className="syllabus-delivery-card">
          <div>
            <strong>今日最终交付</strong>
            <strong>{releaseLabel}</strong>
          </div>
          <p>{dayPkg.project || dayPkg.project_brief || "完成今日项目交付"}</p>
          <span className="syllabus-delivery-progress" aria-label={`今日课节进度 ${progress}%`}>
            <i style={{ width: `${progress}%` }} />
          </span>
        </section>

        <section className="syllabus-week-outline" aria-label="第一周 Day1 到 Day5">
          {[1, 2, 3, 4, 5].map((dayNumber) => {
            const summary = days.find((item) => item.day === dayNumber);
            const current = dayNumber === activeDay;
            const locked = Boolean(summary?.locked) && !current;
            const expanded = expandedDays.has(dayNumber);
            const menuCapsules = current ? capsules : summary?.capsules || [];
            const learnPassed = summary?.nodes?.some((item) => item.kind === "learn" && item.status === "passed") || false;

            return (
              <article
                key={dayNumber}
                className={`syllabus-day-group${current ? " is-current" : ""}${locked ? " is-locked" : ""}`}
              >
                <div className="syllabus-day-group-head">
                  <button
                    type="button"
                    className="syllabus-day-group-toggle"
                    aria-label={expanded ? `收起 Day ${dayNumber}` : `展开 Day ${dayNumber}`}
                    aria-expanded={expanded}
                    onClick={() => toggleDay(dayNumber)}
                  >
                    <span className={expanded ? "is-open" : ""}>›</span>
                  </button>
                  <button
                    type="button"
                    className="syllabus-day-group-title"
                    disabled={locked || current}
                    onClick={() => onSelectDay(dayNumber)}
                  >
                    <span>
                      <strong>Day {dayNumber}</strong>
                      <small>{current ? "正在学习" : locked ? "未解锁" : learnPassed ? "已完成" : "可学习"}</small>
                    </span>
                    <em>{current ? dayPkg.title : summary?.title || `第 ${dayNumber} 天`}</em>
                  </button>
                </div>

                {expanded && (
                  <ol className="syllabus-daily-lessons syllabus-daily-lessons--nested">
                    {menuCapsules.map((capsule, index) => {
                      const active = current && capsule.id === openCapsuleId;
                      const read = current && readCapsuleIds.has(capsule.id);
                      const accepted = current ? acceptedCapsuleIds.has(capsule.id) : learnPassed;
                      return (
                        <li key={`${dayNumber}-${capsule.id}`}>
                          <button
                            type="button"
                            disabled={!current}
                            className={`syllabus-daily-lesson${active ? " is-active" : ""}${accepted ? " is-read" : ""}`}
                            onClick={() => current && onSelectCapsule(capsule.id)}
                          >
                            <span className="syllabus-daily-dot">{accepted && !active ? "✓" : index + 1}</span>
                            <span>
                              <strong>{capsule.title}</strong>
                              <small>
                                {active
                                  ? "正在学习"
                                  : accepted
                                    ? "验收通过"
                                    : read
                                      ? "已浏览"
                                      : locked
                                        ? "未解锁"
                                        : current
                                          ? "未开始"
                                          : "目录预览"} · {capsule.minutes || 20}分钟
                              </small>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </article>
            );
          })}
        </section>
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
