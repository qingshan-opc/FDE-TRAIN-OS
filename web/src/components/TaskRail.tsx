import { useCallback, useEffect, useState } from "react";
import type { DayPackage, NodeState, Passport } from "../lib/types";
import type { TaskTarget } from "../lib/taskTargets";
import { dayLabel } from "../lib/dayLabel";
import { RubricList } from "./RubricList";
import { useLearnerSessionRequired } from "../lib/learnerSessionContext";
import { checklistItemsFromPrompt, normalizePractice } from "../lib/curriculum/normalizeCapsule";
import { progressApi } from "../lib/api";
import { useAuth } from "../lib/auth";
import {
  commandAcceptanceScore,
  dayCommandPassed,
  latestEvalChecksForDay,
  type EvidenceItem,
} from "../lib/capabilityRadar";

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
  onHomeContinue?: () => void;
  onPrimary?: () => void;
  primaryLabel?: string;
  primaryDisabled?: boolean;
  homeworkLabel?: string;
  homeworkDisabled?: boolean;
  onHomework?: () => void;
}) {
  const session = useLearnerSessionRequired();
  const { user } = useAuth();
  const [passport, setPassport] = useState<Passport | null>(null);
  const [evidence, setEvidence] = useState<EvidenceItem[]>([]);
  const rubric = (node?.refs?.rubric || day?.lab?.rubric || []) as import("../lib/types").RubricCheck[];
  const checklist = day?.review_checklist || [];
  const visibleNodes = (day?.nodes || []).filter((n) => n.kind !== "unlock");
  const nodePassed = node?.status === "passed";
  const commandScore = commandAcceptanceScore(passport, evidence);

  const refreshCommandEvidence = useCallback(() => {
    if (!user?.id) return;
    void Promise.all([
      progressApi.passport(user.id).catch(() => null),
      progressApi.evidence(user.id).then((r) => (r.items || []) as EvidenceItem[]).catch(() => []),
    ]).then(([p, items]) => {
      setPassport(p);
      setEvidence(items);
    });
  }, [user?.id]);

  useEffect(() => {
    refreshCommandEvidence();
  }, [refreshCommandEvidence, day?.day, node?.id]);

  useEffect(() => {
    const onUpdate = () => refreshCommandEvidence();
    window.addEventListener("fde:command-evidence-updated", onUpdate);
    return () => window.removeEventListener("fde:command-evidence-updated", onUpdate);
  }, [refreshCommandEvidence]);

  if (day && node?.kind === "learn" && session.activeCapsule) {
    const capsule = session.activeCapsule;
    const practiceSpec = normalizePractice(capsule.practice);
    const fallbackChecks =
      capsule.local_prep?.checklist?.length
        ? capsule.local_prep.checklist
        : practiceSpec
          ? checklistItemsFromPrompt(practiceSpec.prompt)
          : [];
    const deliverable =
      capsule.tools
        ?.map((tool) => tool.note?.match(/本节交付[：:]\s*(.+)$/)?.[1])
        .find(Boolean) || `${capsule.title}实操证据`;
    const commandPassed = dayCommandPassed(day.day, passport, evidence);
    const evalChecks = latestEvalChecksForDay(evidence, day.day);
    const evalOk = evalChecks.filter((c) => c.ok).length;
    const evalTotal = evalChecks.length;

    return (
      <aside aria-label="当前任务工作台" className="task-rail task-rail--workbench">
        <h2>当前任务工作台</h2>
        <section className="task-workbench-current">
          <span>本节交付物</span>
          <h3>{deliverable}</h3>
          <p>{capsule.tools?.[0]?.note || "按本节任务提示词完成实操，并用真实文件与运行结果验收。"}</p>
          <div className="task-workbench-statuses">
            <small>任务已领取</small>
            <small className={commandPassed ? "is-pass" : "is-pending"}>
              {commandPassed ? "指挥验收通过" : "待 Lab 机评（含指挥日志）"}
            </small>
          </div>
        </section>

        <section className="task-workbench-checks">
          <header>
            <strong>验收进度</strong>
            <span>
              {evalTotal > 0
                ? `${evalOk} / ${evalTotal}`
                : commandPassed
                  ? `${Math.max(1, fallbackChecks.length)} / ${Math.max(1, fallbackChecks.length)}`
                  : `0 / ${Math.max(1, fallbackChecks.length)}`}
            </span>
          </header>
          <ul>
            {evalChecks.length > 0
              ? evalChecks.slice(0, 6).map((item, index) => (
                  <li key={`${item.id}-${index}`} className={item.ok ? "is-pass" : ""}>
                    <span>{item.ok ? "✓" : index + 1}</span>
                    <div>
                      <strong>{item.title_zh || item.detail}</strong>
                      <small>{item.ok ? "已通过机评" : item.suggestion || "待补证据或修正工作区文件"}</small>
                    </div>
                  </li>
                ))
              : (fallbackChecks.length ? fallbackChecks : ["完成本节开发工具实操", "维护 docs/D*_command_log.md", "通过日级 Lab Rubric"])
                  .slice(0, 5)
                  .map((item, index) => (
                    <li key={item} className={commandPassed ? "is-pass" : ""}>
                      <span>{commandPassed ? "✓" : index + 1}</span>
                      <div>
                        <strong>{item}</strong>
                        <small>{commandPassed ? "已通过日级 Lab 机评" : "完成练习后去 Lab 提交评测"}</small>
                      </div>
                    </li>
                  ))}
          </ul>
          <button
            type="button"
            className="btn-primary"
            onClick={() => window.dispatchEvent(new CustomEvent("fde:open-learn-step", { detail: "submit" }))}
          >
            {commandPassed ? "查看练习提交" : "进入提交练习"}
          </button>
        </section>

        <section className="task-workbench-ability">
          <header>
            <strong>能力证据</strong>
            <span>{commandPassed ? "本日已计入" : "Lab 通过后更新"}</span>
          </header>
          <div>
            <strong>
              <span>AI 团队指挥与验收</span>
              <span>{commandScore}%</span>
            </strong>
            <span className="task-workbench-ability-bar">
              <i style={{ width: `${commandScore}%` }} />
            </span>
          </div>
        </section>

        <p className="task-workbench-note">
          平台只记录 Lab Rubric 机评通过的证据（含指挥日志 docs/D*_command_log.md）。课节练习提交不等于指挥验收通过。
        </p>
        <button type="button" className="task-workbench-mentor" onClick={() => session.setCoachOpen(true)}>
          ✦ 打开AI任务导师
        </button>
      </aside>
    );
  }

  if (!day) {
    const hasNext = Boolean(homeNextTarget);
    return (
      <aside aria-label="今日训练工作台" className="task-rail task-rail--workbench">
        <h2>今日训练工作台</h2>
        <section className="task-workbench-current">
          <span>下一项训练</span>
          <h3>{homeNextTarget?.label || "选择左侧课节开始"}</h3>
          <p>
            {hasNext
              ? "看完课程介绍后，可从下一项训练继续。"
              : "选择左侧课节，或点击下方按钮继续学习。"}
          </p>
          <div className="task-workbench-statuses">
            <small>{homeNextTarget ? `Day ${homeNextTarget.day}` : "待选择"}</small>
            <small className={hasNext ? "is-pending" : "is-pass"}>{hasNext ? "可继续" : "待选择"}</small>
          </div>
        </section>

        <section className="task-workbench-checks">
          <header>
            <strong>学习路径</strong>
            <span>{hasNext ? "1 / 1" : "0 / 0"}</span>
          </header>
          <ul>
            <li className={hasNext ? "" : "is-pass"}>
              <span>{hasNext ? "1" : "✓"}</span>
              <div>
                <strong>
                  {homeNextTarget
                    ? `${dayLabel(homeNextTarget.day)}${homeNextTarget.label ? ` · ${homeNextTarget.label}` : ""}`
                    : "从左侧进入任意可学习 Day"}
                </strong>
                <small>{hasNext ? "点击继续进入课节" : "可从左侧目录预览 Week 1"}</small>
              </div>
            </li>
          </ul>
          {onHomeContinue && (
            <button type="button" className="btn-primary" onClick={onHomeContinue}>
              {homeNextTarget?.label ? `继续：${homeNextTarget.label}` : "开始今日训练"}
            </button>
          )}
        </section>

        <section className="task-workbench-ability">
          <header>
            <strong>能力证据</strong>
            <span>{commandScore > 0 ? "Week1 累计" : "进入课节后更新"}</span>
          </header>
          <div>
            <strong>
              <span>AI 团队指挥与验收</span>
              <span>{commandScore}%</span>
            </strong>
            <span className="task-workbench-ability-bar">
              <i style={{ width: `${commandScore}%` }} />
            </span>
          </div>
        </section>

        <p className="task-workbench-note">
          外层目录可浏览全部周次课节；指挥验收证据来自 Day1–5 Lab 机评与指挥日志。
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
          <h3>本日任务</h3>
        </header>
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
      </section>

      {node && (primaryLabel || homeworkLabel) && (
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
          <p className="muted criteria-box-hint">完成本日 Lab 前请对照以下标准自检（含指挥日志）。</p>
          <RubricList rubric={rubric} passed={nodePassed || dayCommandPassed(day.day, passport, evidence)} />
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

      {day.day >= 1 && day.day <= 5 && (
        <section className="task-workbench-ability" style={{ marginTop: 12 }}>
          <header>
            <strong>能力证据</strong>
            <span>{commandScore}%</span>
          </header>
          <div>
            <strong>
              <span>AI 团队指挥与验收</span>
              <span>{dayCommandPassed(day.day, passport, evidence) ? "本日已通过" : "待 Lab"}</span>
            </strong>
            <span className="task-workbench-ability-bar">
              <i style={{ width: `${commandScore}%` }} />
            </span>
          </div>
        </section>
      )}
    </aside>
  );
}
