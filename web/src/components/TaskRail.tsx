import type { DayPackage, NodeState } from "../lib/types";
import type { TaskTarget } from "../lib/taskTargets";
import { dayLabel } from "../lib/dayLabel";
import { RubricList } from "./RubricList";

function TaskIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
      <rect x="9" y="3" width="6" height="4" rx="1" />
    </svg>
  );
}

/** Right-hand task panel — rubric / checklist only. AI coach lives in
 * per-lesson 「问导师」 (CapsuleReader / Lab drawer), not here. */
export function TaskRail({
  day,
  node,
  homeNextTarget,
  homePendingCount,
  onHomeContinue,
  onPrimary,
  primaryLabel,
  primaryDisabled,
  homeworkLabel,
  homeworkDisabled,
  onHomework,
}: {
  day: DayPackage | null;
  node: NodeState | null;
  homeNextTarget?: TaskTarget | null;
  homePendingCount?: number;
  onHomeContinue?: () => void;
  onPrimary?: () => void;
  primaryLabel?: string;
  primaryDisabled?: boolean;
  homeworkLabel?: string;
  homeworkDisabled?: boolean;
  onHomework?: () => void;
}) {
  const rubric = (node?.refs?.rubric || day?.lab?.rubric || []) as import("../lib/types").RubricCheck[];
  const checklist = day?.review_checklist || [];
  const visibleNodes = (day?.nodes || []).filter((n) => n.kind !== "unlock");
  const nodePassed = node?.status === "passed";

  return (
    <aside aria-label="任务面板" className="task-rail">
      <section className="task-rail-section">
        <header className="task-rail-section-head">
          <TaskIcon />
          <h3>{day ? "本日任务" : "任务概览"}</h3>
        </header>
        {!day ? (
          <>
            <p className="muted">
              {homePendingCount != null && homePendingCount > 0
                ? `你有 ${homePendingCount} 项待办，从下一项开始继续。`
                : "选择左侧课程或点击下方按钮继续学习。"}
            </p>
            {homeNextTarget && (
              <div className="task-rail-home-next">
                <p className="task-rail-home-next-label">
                  下一项 · {dayLabel(homeNextTarget.day)}
                  {homeNextTarget.label ? ` · ${homeNextTarget.label}` : ""}
                </p>
                {onHomeContinue && (
                  <button type="button" className="btn-primary" style={{ width: "100%" }} onClick={onHomeContinue}>
                    {homeNextTarget.label ? `继续：${homeNextTarget.label}` : "继续学习"}
                  </button>
                )}
              </div>
            )}
          </>
        ) : (
          <>
            {(day.project || day.project_brief) && (
              <p className="task-rail-brief muted">
                {(day.project_brief || day.project || "").length > 120
                  ? `${(day.project_brief || day.project || "").slice(0, 120)}…`
                  : day.project_brief || day.project}
              </p>
            )}
            <ul className="task-card-list">
              {visibleNodes.map((n) => {
                const done = n.status === "passed";
                const current = node?.id === n.id;
                const locked = n.status === "locked";
                return (
                  <li
                    key={n.id}
                    className={`task-card ${done ? "is-done" : ""} ${current ? "is-current" : ""} ${locked ? "is-locked" : ""}`}
                  >
                    <span className={`task-card-check ${done ? "is-checked" : ""}`} aria-hidden>
                      {done ? "✓" : ""}
                    </span>
                    <div className="task-card-body">
                      <span className={`task-card-title ${done ? "is-struck" : ""}`}>{n.title}</span>
                      <span className={`task-card-due ${current && !done ? "is-urgent" : ""}`}>
                        {done ? "已完成" : locked ? "未解锁" : current ? "进行中" : "待完成"}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>

      {(node || (!day && homeNextTarget && onHomeContinue)) && (primaryLabel || homeworkLabel) && (
        <section className="task-rail-actions">
          {primaryLabel && onPrimary && (
            <button
              type="button"
              className="btn-primary"
              style={{ width: "100%" }}
              disabled={primaryDisabled}
              onClick={onPrimary}
            >
              {primaryLabel}
            </button>
          )}
          {homeworkLabel && onHomework && (
            <button type="button" style={{ width: "100%" }} disabled={homeworkDisabled} onClick={onHomework}>
              {homeworkLabel}
            </button>
          )}
        </section>
      )}

      {rubric.length > 0 && (
        <section className="criteria-box">
          <h3>验收标准</h3>
          <p className="muted criteria-box-hint">完成本日 Lab 前请对照以下标准自检。</p>
          <RubricList rubric={rubric} passed={nodePassed} />
        </section>
      )}

      {checklist.length > 0 && (
        <section className="criteria-box criteria-box-checklist">
          <h3>自检清单</h3>
          <ul className="checklist">
            {checklist.map((item, i) => (
              <li key={i}>
                <label>
                  <input type="checkbox" /> {item}
                </label>
              </li>
            ))}
          </ul>
        </section>
      )}
    </aside>
  );
}
