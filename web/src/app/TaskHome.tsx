import { useMemo, useState, type CSSProperties } from "react";
import type { DaySummary } from "../lib/types";
import { dayLabel } from "../lib/dayLabel";
import {
  buildTaskCards,
  kindLabel,
  resolveNextTarget,
  summarizeProgress,
  type TaskCard,
} from "../lib/taskTargets";

type TaskTab = "pending" | "done";

export function TaskHome({
  days,
  weeks,
  loading,
  error,
  onOpenTask,
  onContinue,
}: {
  days: DaySummary[];
  weeks: Record<string, number[]>;
  loading?: boolean;
  error?: string | null;
  onOpenTask: (day: number, nodeId: string) => void;
  onContinue: () => void;
}) {
  const [tab, setTab] = useState<TaskTab>("pending");
  const summary = useMemo(() => summarizeProgress(days, weeks), [days, weeks]);
  const cards = useMemo(() => buildTaskCards(days), [days]);
  const next = useMemo(() => resolveNextTarget(days), [days]);

  const pending = cards.filter((c) => !c.done);
  const done = cards.filter((c) => c.done);
  const visible = tab === "pending" ? pending : done;

  if (loading && !days.length) {
    return (
      <div className="task-home">
        <p className="muted">加载任务列表…</p>
      </div>
    );
  }

  if (error && !days.length) {
    return null;
  }

  return (
    <div className="task-home" aria-label="任务首页">
      <header className="task-home-head anim-rise" style={{ "--i": 0 } as CSSProperties}>
        <div>
          <h1>今日任务</h1>
          <p className="task-home-sub muted">打开即可看到待办，一键进入对应学习节点</p>
        </div>
        {next && (
          <button type="button" className="btn-primary task-home-continue" onClick={onContinue}>
            {next.label ? `继续：${next.label}` : "继续学习"}
          </button>
        )}
      </header>

      <div className="task-home-summary anim-rise" style={{ "--i": 1 } as CSSProperties}>
        <div className="task-home-summary-row">
          <span>
            整体进度 {summary.passed}/{summary.total}（{summary.pct}%）
          </span>
          <span className="muted">本周 {summary.weekLabel} · 待办 {summary.pending}</span>
        </div>
        <div
          className="task-home-progress"
          role="progressbar"
          aria-label={`学习进度 ${summary.pct}%`}
          aria-valuenow={summary.pct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className="task-home-progress-fill" style={{ width: `${summary.pct}%` }} />
        </div>
      </div>

      <div className="task-home-tabs anim-rise" role="tablist" style={{ "--i": 2 } as CSSProperties}>
        {(
          [
            ["pending", `待办 (${pending.length})`],
            ["done", `已完成 (${done.length})`],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            className={tab === id ? "active" : ""}
            aria-selected={tab === id}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="task-home-empty muted">
          {tab === "pending" ? "暂无待办，全部完成！" : "还没有已完成的任务"}
        </p>
      ) : (
        <ul className="task-home-list">
          {visible.map((card, i) => (
            <TaskHomeCard
              key={card.id}
              card={card}
              index={i}
              onOpen={() => onOpenTask(card.day, card.nodeId)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function TaskHomeCard({ card, index, onOpen }: { card: TaskCard; index: number; onOpen: () => void }) {
  const statusText = card.done
    ? "已完成"
    : card.locked
      ? "未解锁"
      : card.urgent
        ? "进行中"
        : "待完成";

  return (
    <li className="anim-rise" style={{ "--i": 3 + Math.min(index, 6) } as CSSProperties}>
      <button
        type="button"
        className={`task-home-card ${card.urgent ? "is-urgent" : ""} ${card.done ? "is-done" : ""} ${card.locked ? "is-locked" : ""}`}
        disabled={card.locked}
        onClick={onOpen}
      >
        <span className="task-home-card-meta">
          <span className="task-home-card-day">{dayLabel(card.day)}</span>
          <span className="task-home-card-kind">{kindLabel(String(card.kind))}</span>
        </span>
        <span className="task-home-card-title">{card.nodeTitle}</span>
        <span className="task-home-card-brief muted">{card.dayTitle}</span>
        <span className={`task-home-card-status ${card.urgent ? "is-urgent" : ""}`}>{statusText}</span>
      </button>
    </li>
  );
}
