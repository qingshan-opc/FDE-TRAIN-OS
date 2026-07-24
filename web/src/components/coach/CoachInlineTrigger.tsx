import { useState } from "react";
import { CoachAskPanel } from "./CoachAskPanel";
import type { DayPackage, NodeState } from "../../lib/types";

/**
 * Small 「问导师」 button that reveals an inline `CoachAskPanel` popover.
 * Meant for headers (e.g. `CapsuleReader`) where a full drawer would be
 * overkill — clicking again, pressing Escape, or clicking outside closes it.
 */
export function CoachInlineTrigger({ day, node }: { day: DayPackage | null; node?: NodeState | null }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="coach-inline-trigger">
      <button type="button" className="coach-inline-btn" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        问导师
      </button>
      {open && (
        <>
          <div className="coach-inline-backdrop" onClick={() => setOpen(false)} />
          <div className="coach-inline-popover" role="dialog" aria-label="AI 导师">
            <CoachAskPanel day={day} node={node} compact />
          </div>
        </>
      )}
    </div>
  );
}
