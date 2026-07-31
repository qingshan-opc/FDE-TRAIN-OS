import type { UseCoachResult } from "../../hooks/useCoach";
import { useCoach } from "../../hooks/useCoach";
import type { DayPackage, NodeState } from "../../lib/types";
import { CoachChatPanel } from "./CoachChatPanel";

/** AI coach surface — delegates to DeepSeek chat panel. */
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
  const coach = externalCoach ?? internalCoach;

  return (
    <div className={compact ? "coach-ask-panel compact" : "panel coach-panel coach-ask-panel"} aria-label="AI 导师">
      {!compact && <h3 style={{ marginBottom: 8 }}>AI 导师</h3>}
      <CoachChatPanel
        day={day}
        node={node}
        coach={coach}
        suggestedQuestions={suggestedQuestions}
        onPickSuggestion={onPickSuggestion}
      />
    </div>
  );
}
