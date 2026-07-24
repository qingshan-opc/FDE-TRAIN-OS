import { useEffect } from "react";
import type { UseCoachResult } from "../../hooks/useCoach";
import { useCoach } from "../../hooks/useCoach";
import { CoachAskPanel } from "./CoachAskPanel";
import { MemoriesUploader } from "./MemoriesUploader";
import type { DayPackage, NodeState } from "../../lib/types";

/**
 * Slide-over AI-coach drawer — opened from the global floating FAB.
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
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="coach-drawer-overlay" role="presentation" onClick={onClose}>
      <aside
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
        <div className="coach-drawer-body stack">
          <CoachAskPanel
            day={day}
            node={node}
            compact
            coach={coach}
            suggestedQuestions={suggestedQuestions}
            onPickSuggestion={onPickSuggestion}
          />
          <MemoriesUploader dayLabel={day ? String(day.day) : undefined} />
        </div>
      </aside>
    </div>
  );
}
