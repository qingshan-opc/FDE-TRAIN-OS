/** Learner-facing day ordinal: 1 → 「第一天」, 12 → 「第十二天」. */
const DAY_CN = ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十", "十一", "十二"] as const;

export function dayLabel(day: number): string {
  const n = Math.trunc(Number(day));
  if (!Number.isFinite(n) || n < 1) return `第${day}天`;
  if (n <= DAY_CN.length) return `第${DAY_CN[n - 1]}天`;
  return `第${n}天`;
}

/** Compact unlock hint: 「完成第二天后解锁」 */
export function dayUnlockHint(prevDay: number): string {
  return `完成${dayLabel(prevDay)}后解锁`;
}
