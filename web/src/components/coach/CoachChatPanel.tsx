import { useCallback, useEffect, useRef } from "react";
import type { UseCoachResult } from "../../hooks/useCoach";
import type { DayPackage, NodeState } from "../../lib/types";
import { CoachMessage } from "./CoachMessage";

function IconSend() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4.5 12h9M13.5 12L20 5.5 4.5 12 20 18.5 13.5 12z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Split-modal chat surface for AI task mentor (DeepSeek SSE).
 * Message list scrolls; composer footer stays pinned.
 */
export function CoachChatPanel({
  day,
  node,
  coach,
  suggestedQuestions,
  onPickSuggestion,
}: {
  day: DayPackage | null;
  node?: NodeState | null;
  coach: UseCoachResult;
  suggestedQuestions?: string[];
  onPickSuggestion?: (question: string) => void;
}) {
  const {
    input,
    setInput,
    messages,
    busy,
    error,
    ask,
    handoffBusy,
    handoffMsg,
    mentorReview,
    requestMentorReview,
    showMentorCta,
    diagnostics,
  } = coach;

  const scrollRef = useRef<HTMLDivElement>(null);
  const shortcuts = suggestedQuestions ?? [];

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, busy]);

  const submit = useCallback(
    (q?: string) => {
      const text = (q ?? input).trim();
      if (!text || busy) return;
      void ask(text);
    },
    [ask, busy, input],
  );

  const pick = (q: string) => {
    if (onPickSuggestion) onPickSuggestion(q);
    else void ask(q);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="coach-chat-panel">
      <div className="coach-chat-scroll" ref={scrollRef}>
        {messages.length === 0 && !busy && (
          <div className="coach-chat-empty">
            <div className="coach-chat-brand" aria-hidden>
              AI
            </div>
            <h3>AI 任务导师</h3>
            <p>围绕当前任务提问，我会帮你拆解步骤与验收标准。</p>
            {shortcuts.length > 0 && (
              <div className="coach-quick-block">
                <div className="coach-quick-label">快捷问题</div>
                <div className="coach-chat-examples">
                  {shortcuts.map((q) => (
                    <button
                      key={q}
                      type="button"
                      className="coach-chat-example"
                      disabled={busy}
                      onClick={() => pick(q)}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {messages.map((m) => (
          <CoachMessage key={m.id} message={m} />
        ))}

        {busy && messages.length > 0 && messages[messages.length - 1]?.streaming && (
          <p className="coach-streaming-hint muted">正在流式生成…</p>
        )}

        {diagnostics && showMentorCta && (
          <div className="coach-diagnostics panel">
            <p className="muted">
              建议下一步：
              <strong>{diagnostics.next_action_zh || diagnostics.next_action || "—"}</strong>
            </p>
            <button
              type="button"
              className="btn-primary"
              style={{ width: "100%", marginTop: 8 }}
              disabled={handoffBusy}
              onClick={() => void requestMentorReview()}
            >
              {handoffBusy ? "提交中…" : "申请导师复核"}
            </button>
          </div>
        )}

        {handoffMsg && <p className="muted coach-handoff-msg">{handoffMsg}</p>}
        {mentorReview?.mentor_feedback && (
          <div className="coach-mentor-feedback">
            <strong>导师复核反馈</strong>
            <p className="muted">{mentorReview.mentor_feedback}</p>
          </div>
        )}
      </div>

      <div className="coach-chat-footer">
        {shortcuts.length > 0 && messages.length > 0 && (
          <div className="coach-quick-bar" aria-label="快捷问题">
            <div className="coach-quick-label">快捷问题</div>
            <div className="coach-suggest-list">
              {shortcuts.map((q) => (
                <button
                  key={q}
                  type="button"
                  className="coach-suggest-chip"
                  disabled={busy}
                  onClick={() => pick(q)}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="coach-composer">
          <textarea
            id="coach-q"
            rows={1}
            className="coach-composer-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={
              day ? "输入问题，按 Enter 发送；支持追问上下文..." : "先选择一日课程，再提问"
            }
            disabled={busy}
            aria-label="向导师提问"
          />
          <button
            type="button"
            className="coach-send-btn btn-primary"
            disabled={busy || !input.trim()}
            onClick={() => submit()}
            aria-label="发送"
          >
            {busy ? "…" : <IconSend />}
          </button>
        </div>

        {error && <p className="coach-chat-error">{error}</p>}
      </div>

      {node?.id ? <span className="sr-only">当前节点 {node.id}</span> : null}
    </div>
  );
}
