import { useLearnerSession } from "../lib/learnerSessionContext";

export function LearnerContextBar() {
  const session = useLearnerSession();
  if (!session?.displayDay) return null;

  const { displayDay, week, progressPct, studyMinutes } = session;

  return (
    <div className="learner-context-bar" aria-label="今日学习进度">
      <span className="learner-context-bar__weekday">
        第{week}周 · Day {displayDay}
      </span>
      <div className="learner-context-bar__progress">
        <strong>今日进度 {progressPct}%</strong>
        <span className="learner-context-bar__progress-track" role="progressbar" aria-valuenow={progressPct}>
          <i style={{ width: `${Math.min(100, Math.max(0, progressPct))}%` }} />
        </span>
      </div>
      <span className="learner-context-bar__time">已学习 {studyMinutes} 分钟</span>
    </div>
  );
}
