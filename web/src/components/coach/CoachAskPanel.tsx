import type { UseCoachResult } from "../../hooks/useCoach";
import { useCoach } from "../../hooks/useCoach";
import type { DayPackage, NodeState } from "../../lib/types";
import { dayLabel } from "../../lib/dayLabel";

/**
 * The "ask the AI coach" conversation surface — question box, streamed
 * reply, citations and the offline diagnostics block with a mentor-handoff
 * CTA.
 */
export function CoachAskPanel({
  day,
  node,
  compact,
  coach: externalCoach,
  suggestedQuestions,
  onPickSuggestion,
}: {
  day: DayPackage | null;
  node?: NodeState | null;
  compact?: boolean;
  coach?: UseCoachResult;
  suggestedQuestions?: string[];
  onPickSuggestion?: (question: string) => void;
}) {
  const internalCoach = useCoach(day, node);
  const {
    question,
    setQuestion,
    reply,
    level,
    mode,
    citations,
    diagnostics,
    busy,
    error,
    ask,
    handoffBusy,
    handoffMsg,
    mentorReview,
    requestMentorReview,
    showMentorCta,
    coachCfg,
  } = externalCoach ?? internalCoach;

  const pick = (q: string) => {
    if (onPickSuggestion) onPickSuggestion(q);
    else {
      setQuestion(q);
      void ask(q);
    }
  };

  return (
    <div className={compact ? "coach-ask-panel compact" : "panel coach-panel coach-ask-panel"} aria-label="AI 导师">
      {!compact && <h3 style={{ marginBottom: 8 }}>AI 导师</h3>}
      <p className="muted" style={{ fontSize: 12, marginBottom: 10 }}>
        anyCode Skill · LEVEL 分层 · 流式回复
        {coachCfg?.skill_id && <span className="mono"> · {coachCfg.skill_id}</span>}
        {node?.id && <span className="mono"> · {node.id}</span>}
        {level != null && (
          <>
            {" "}
            · 当前 <span className="mono">LEVEL{level}</span>
            {mode && <span className="mono"> / {mode}</span>}
          </>
        )}
      </p>
      {suggestedQuestions && suggestedQuestions.length > 0 && (
        <div className="coach-suggest-chips">
          <span className="coach-suggest-label">推荐问题</span>
          <div className="coach-suggest-list">
            {suggestedQuestions.map((q) => (
              <button key={q} type="button" className="coach-suggest-chip" disabled={busy} onClick={() => pick(q)}>
                {q}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="field">
        <label htmlFor="coach-q">向导师提问</label>
        <textarea
          id="coach-q"
          rows={3}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder={day ? `例如：${dayLabel(day.day)}这一步怎么验收？` : "先选择一日课程，再提问"}
          disabled={busy}
        />
      </div>
      <button type="button" className="btn-primary" style={{ width: "100%" }} disabled={busy || !question.trim()} onClick={() => void ask()}>
        {busy ? "思考中…" : "提问"}
      </button>
      {error && (
        <p className="muted" style={{ color: "var(--color-danger)", marginTop: 8 }}>
          {error}
        </p>
      )}
      {reply != null && reply !== "" && (
        <div className="coach-reply" style={{ marginTop: 12 }}>
          <pre className="log-box" style={{ maxHeight: 280, whiteSpace: "pre-wrap" }}>
            {reply}
          </pre>
          {citations.length > 0 && (
            <ul style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: 12 }}>
              {citations.slice(0, 5).map((c, i) => (
                <li key={i}>{c.title || c.id || "citation"}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {diagnostics && (
        <div className="panel" style={{ marginTop: 12, background: "var(--color-bg-soft, transparent)" }}>
          <h4 style={{ marginBottom: 6, fontSize: 13 }}>诊断</h4>
          <p style={{ fontSize: 13, marginBottom: 6 }}>{diagnostics.diagnosis_zh || "暂无诊断信息"}</p>
          {diagnostics.error_tags && diagnostics.error_tags.length > 0 && (
            <p className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
              问题标签：
              {diagnostics.error_tags.map((t) => (
                <span key={t} className="mono" style={{ marginRight: 6 }}>
                  {t}
                </span>
              ))}
            </p>
          )}
          <p className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
            建议下一步：<strong>{diagnostics.next_action_zh || diagnostics.next_action || "—"}</strong>
            {diagnostics.next_node_hint && <span className="mono"> ({diagnostics.next_node_hint})</span>}
          </p>
          {diagnostics.reproducible && (
            <p className="muted" style={{ fontSize: 11 }}>
              model: {diagnostics.reproducible.model || "—"} · prompt: {diagnostics.reproducible.prompt_version || "—"}
            </p>
          )}
          {showMentorCta && (
            <button
              type="button"
              className="btn-primary"
              style={{ width: "100%", marginTop: 8 }}
              disabled={handoffBusy}
              onClick={() => void requestMentorReview()}
            >
              {handoffBusy ? "提交中…" : "申请导师复核"}
            </button>
          )}
        </div>
      )}
      {!diagnostics && (
        <button type="button" style={{ width: "100%", marginTop: 8 }} disabled={handoffBusy} onClick={() => void requestMentorReview()}>
          {handoffBusy ? "提交中…" : "申请导师复核"}
        </button>
      )}
      {handoffMsg && (
        <p className="muted" style={{ marginTop: 8, fontSize: 12 }}>
          {handoffMsg}
        </p>
      )}
      {mentorReview?.mentor_feedback && (
        <div className="coach-mentor-feedback" style={{ marginTop: 10 }}>
          <strong style={{ fontSize: 12 }}>导师复核反馈</strong>
          <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>
            {mentorReview.mentor_feedback}
            {mentorReview.mentor_score != null && (
              <>
                {" "}
                · 评分 <span className="num">{mentorReview.mentor_score}</span>
              </>
            )}
          </p>
        </div>
      )}
      {mentorReview?.status === "pending" && !mentorReview.mentor_feedback && (
        <p className="muted" style={{ marginTop: 8, fontSize: 12 }}>
          导师复核处理中，请稍后再看。
        </p>
      )}
    </div>
  );
}
