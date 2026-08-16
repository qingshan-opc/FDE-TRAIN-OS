/** Learner-facing day ordinal: 1 → 「第一天」, 12 → 「第十二天」.
 * Day 6 is the Saturday intercalary lesson between Day 5 and the former Day 6
 * (now Day 7); labels for day≥7 shift so 「第六天」仍指原 LLM 理论日。
 */
const DAY_CN = ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十", "十一", "十二"] as const;

export function dayLabel(day: number): string {
  const n = Math.trunc(Number(day));
  if (!Number.isFinite(n) || n < 1) return `第${day}天`;
  if (n === 6) return "周六";
  const ordinal = n < 6 ? n : n - 1;
  if (ordinal <= DAY_CN.length) return `第${DAY_CN[ordinal - 1]}天`;
  return `第${ordinal}天`;
}

/** Compact unlock hint: 「完成第二天后解锁」 */
export function dayUnlockHint(prevDay: number): string {
  return `完成${dayLabel(prevDay)}后解锁`;
}

/** Prefer the Chinese project/README title over seed placeholders like "Day 1". */
export function learnerDayTitle(day: {
  day?: number;
  title?: string | null;
  project?: string | null;
}): string {
  const title = (day.title || "").trim();
  const project = (day.project || "").trim();
  const placeholder = !title || /^Day\s*\d+$/i.test(title);
  if (project && placeholder) return project;
  if (title && !placeholder) return title;
  if (project) return project;
  if (typeof day.day === "number" && Number.isFinite(day.day)) return dayLabel(day.day);
  return title;
}
