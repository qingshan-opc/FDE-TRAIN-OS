import { useEffect } from "react";
import { createPortal } from "react-dom";
import type { UseCoachResult } from "../../hooks/useCoach";
import { useCoach } from "../../hooks/useCoach";
import { CoachAskPanel } from "./CoachAskPanel";
import type { DayPackage, NodeState } from "../../lib/types";

/**
 * Centered AI-coach modal (Codex/Claude-style) — portal to document.body
 * so left/right rails cannot offset or clip the dialog.
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

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="coach-drawer-overlay" role="presentation" onClick={onClose}>
      <div
        className="coach-drawer"
        role="dialog"
        aria-label={title}
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="coach-drawer-head">
          <strong>{title}</strong>
          <button type="button" aria-label="关闭" onClick={onClose}>
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
    </div>,
    document.body,
  );
}
