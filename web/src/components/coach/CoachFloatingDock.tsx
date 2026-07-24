import { useMemo } from "react";
import { buildCoachSuggestions } from "../../lib/coachSuggestions";
import { useLearnerSessionRequired } from "../../lib/learnerSessionContext";
import { useCoach } from "../../hooks/useCoach";
import { CoachDrawer } from "./CoachDrawer";

/** Global bottom-right AI task mentor — one entry for learn / lab / project. */
export function CoachFloatingDock() {
  const session = useLearnerSessionRequired();
  const { dayPkg, activeNode, activeCapsule, coachOpen, setCoachOpen } = session;

  const suggestions = useMemo(
    () =>
      buildCoachSuggestions({
        day: dayPkg,
        node: activeNode,
        capsule: activeCapsule,
      }),
    [dayPkg, activeNode, activeCapsule],
  );

  const coach = useCoach(dayPkg, activeNode);

  const onPickSuggestion = (q: string) => {
    void coach.ask(q);
  };

  return (
    <>
      <button
        type="button"
        className="coach-floating-fab"
        aria-label="AI 任务导师"
        aria-expanded={coachOpen}
        onClick={() => setCoachOpen(true)}
      >
        <span className="coach-floating-fab__icon" aria-hidden>
          ✦
        </span>
        AI 任务导师
      </button>
      <CoachDrawer
        day={dayPkg}
        node={activeNode}
        open={coachOpen}
        onClose={() => setCoachOpen(false)}
        title="AI 任务导师"
        suggestedQuestions={suggestions}
        onPickSuggestion={onPickSuggestion}
        coach={coach}
      />
    </>
  );
}
