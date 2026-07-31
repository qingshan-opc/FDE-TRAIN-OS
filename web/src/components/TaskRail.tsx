import { useEffect, useState } from "react";
import type { DayPackage, NodeState } from "../lib/types";
import type { TaskTarget } from "../lib/taskTargets";
import { dayLabel } from "../lib/dayLabel";
import { RubricList } from "./RubricList";
import { useLearnerSessionRequired } from "../lib/learnerSessionContext";
import { checklistItemsFromPrompt, normalizePractice } from "../lib/curriculum/normalizeCapsule";

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
  const session = useLearnerSessionRequired();
  const [acceptedCapsules, setAcceptedCapsules] = useState<Set<string>>(() => new Set());
  const rubric = (node?.refs?.rubric || day?.lab?.rubric || []) as import("../lib/types").RubricCheck[];
  const checklist = day?.review_checklist || [];
  const visibleNodes = (day?.nodes || []).filter((n) => n.kind !== "unlock");
  const nodePassed = node?.status === "passed";

  useEffect(() => {
    const onAccepted = (event: Event) => {
      const capsuleId = (event as CustomEvent<{ capsuleId?: string }>).detail?.capsuleId;
      if (!capsuleId) return;
      setAcceptedCapsules((prev) => new Set(prev).add(capsuleId));
    };
    window.addEventListener("fde:lesson-accepted", onAccepted);
    return () => window.removeEventListener("fde:lesson-accepted", onAccepted);
  }, []);

  if (day && node?.kind === "learn" && session.activeCapsule) {
    const capsule = session.activeCapsule;
    const practiceSpec = normalizePractice(capsule.practice);
    const checks =
      capsule.local_prep?.checklist?.length
        ? capsule.local_prep.checklist
        : practiceSpec
          ? checklistItemsFromPrompt(practiceSpec.prompt)
          : [];
    const deliverable =
      capsule.tools
        ?.map((tool) => tool.note?.match(/本节交付[：:]\s*(.+)$/)?.[1])
        .find(Boolean) || `${capsule.title}实操证据`;
    const accepted = acceptedCapsules.has(capsule.id) || node.status === "passed";
    const score = accepted ? 60 : 20;

    return (
      <aside aria-label="当前任务工作台" className="task-rail task-rail--workbench">
        <h2>当前任务工作台</h2>
        <section className="task-workbench-current">
          <span>本节交付物</span>
          <h3>{deliverable}</h3>
          <p>{capsule.tools?.[0]?.note || "按本节任务提示词完成实操，并用真实文件与运行结果验收。"}</p>
          <div className="task-workbench-statuses">
            <small>任务已领取</small>
            <small className={accepted ? "is-pass" : "is-pending"}>{accepted ? "验收通过" : "成果未提交"}</small>
          </div>
        </section>

        <section className="task-workbench-checks">
          <header>
            <strong>验收进度</strong>
            <span>{accepted ? `${Math.max(1, checks.length)} / ${Math.max(1, checks.length)}` : `0 / ${Math.max(1, checks.length)}`}</span>
          </header>
          <ul>
            {(checks.length ? checks : ["完成本节开发工具实操", "检查真实文件与运行证据", "明确批准或要求返工"])
              .slice(0, 5)
              .map((item, index) => (
                <li key={item} className={accepted ? "is-pass" : ""}>
                  <span>{accepted ? "✓" : index + 1}</span>
                  <div>
                    <strong>{item}</strong>
                    <small>{accepted ? "已通过本节验收" : "等待提交后检查"}</small>
                  </div>
                </li>
              ))}
          </ul>
          <button
            type="button"
            className="btn-primary"
            onClick={() => window.dispatchEvent(new CustomEvent("fde:open-learn-step", { detail: "submit" }))}
          >
            {accepted ? "查看验收结果" : "进入提交验收"}
          </button>
        </section>

        <section className="task-workbench-ability">
          <header>
            <strong>能力证据</strong>
            <span>{accepted ? "本节已更新" : "通过后更新"}</span>
          </header>
          <div>
            <strong>
              <span>AI 团队指挥与验收</span>
              <span>{score}%</span>
            </strong>
            <span className="task-workbench-ability-bar">
              <i style={{ width: `${score}%` }} />
            </span>
          </div>
        </section>

        <p className="task-workbench-note">
          平台只记录通过验收的成果。浏览讲义或只看 AI 生成结果，不会自动增加能力等级。
        </p>
        <button type="button" className="task-workbench-mentor" onClick={() => session.setCoachOpen(true)}>
          ✦ 打开AI任务导师
        </button>
      </aside>
    );
  }

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
