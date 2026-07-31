import { useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import type { UseCoachResult } from "../../hooks/useCoach";
import { useCoach } from "../../hooks/useCoach";
import { CoachAskPanel } from "./CoachAskPanel";
import type { DayPackage, NodeState } from "../../lib/types";

function IconTrash() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m2 0v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V7h12zM10 11v6M14 11v6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconSearch() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M16 16l4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Centered AI-coach modal — left session history + right chat (DeepSeek SSE).
 */
export function CoachDrawer({
  day,
  node,
  open,
  onClose,
  title = "AI 任务导师",
  suggestedQuestions,
  onPickSuggestion,
  coach: externalCoach,
}: {
  day: DayPackage | null;
  node?: NodeState | null;
  open: boolean;
  onClose: () => void;
  title?: string;
  suggestedQuestions?: string[];
  onPickSuggestion?: (question: string) => void;
  coach?: UseCoachResult;
}) {
  const internalCoach = useCoach(day, node);
  const coach = externalCoach ?? internalCoach;
  const {
    sessions,
    activeSessionId,
    sessionQuery,
    setSessionQuery,
    newSession,
    switchSession,
    deleteSession,
  } = coach;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  const visibleSessions = useMemo(() => {
    const q = sessionQuery.trim().toLowerCase();
    if (!q) return sessions;
    return sessions.filter((s) => s.title.toLowerCase().includes(q));
  }, [sessions, sessionQuery]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="coach-drawer-overlay" role="presentation" onClick={onClose}>
      <div
        className="coach-drawer coach-drawer--split"
        role="dialog"
        aria-label={title}
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <aside className="coach-drawer-sidebar" aria-label="对话记录">
          <p className="coach-sidebar-welcome">围绕当前任务提问，或从历史会话继续</p>
          <button type="button" className="coach-new-chat-btn" onClick={newSession}>
            <span aria-hidden>+</span>
            新建对话
          </button>
          <label className="coach-session-search">
            <span className="coach-session-search-icon">
              <IconSearch />
            </span>
            <input
              type="search"
              value={sessionQuery}
              onChange={(e) => setSessionQuery(e.target.value)}
              placeholder="搜索会话..."
              aria-label="搜索会话"
            />
          </label>
          <div className="coach-session-section-label">历史会话</div>
          <ul className="coach-session-list">
            {visibleSessions.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  className={`coach-session-item${s.id === activeSessionId ? " is-active" : ""}`}
                  onClick={() => switchSession(s.id)}
                >
                  <span className="coach-session-item-title">{s.title}</span>
                </button>
                <button
                  type="button"
                  className="coach-session-delete"
                  aria-label={`删除 ${s.title}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteSession(s.id);
                  }}
                >
                  <IconTrash />
                </button>
              </li>
            ))}
            {visibleSessions.length === 0 && (
              <li className="coach-session-empty muted">暂无会话</li>
            )}
          </ul>
        </aside>

        <div className="coach-drawer-main">
          <header className="coach-drawer-head">
            <div className="coach-drawer-head-titles">
              <strong>与 {title}</strong>
              <span className="coach-drawer-topic muted">DeepSeek · 流式对话</span>
            </div>
            <button type="button" className="coach-drawer-close" aria-label="关闭" onClick={onClose}>
              ✕
            </button>
          </header>
          <div className="coach-drawer-body coach-drawer-body--chat">
            <CoachAskPanel
              day={day}
              node={node}
              compact
              coach={coach}
              suggestedQuestions={suggestedQuestions}
              onPickSuggestion={onPickSuggestion}
            />
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
