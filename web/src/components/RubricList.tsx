import { rubricTitle } from "../lib/rubricDisplay";
import type { RubricCheck } from "../lib/types";

/** Learner-facing criteria — titles only; hide raw check keys. */
export function RubricList({ rubric, passed }: { rubric: RubricCheck[]; passed?: boolean }) {
  if (!rubric.length) return null;
  return (
    <ul className="criteria-list">
      {rubric.map((r, i) => {
        const title = r.title_zh || rubricTitle(r.check);
        const done = Boolean(passed);
        return (
          <li key={i} className={`criteria-item ${done ? "is-done" : "is-pending"}`}>
            <span className="criteria-icon" aria-hidden>
              {done ? "✓" : "…"}
            </span>
            <div className="criteria-body">
              <div className="criteria-title">{title}</div>
              {r.expectation && <div className="criteria-expectation">{r.expectation}</div>}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
