/** Shared day-package helpers — used by learner app and author curriculum. */

export type DayResource = {
  id: string;
  title: string;
  kind?: string;
  summary?: string;
  url?: string;
  object_key?: string;
};

export type CapsuleResourceBinding = {
  resource_ids?: string[];
  resources?: DayResource[];
};

/** Resolve learner-visible resources for one capsule (capsule-level overrides, day-level fallback). */
export function resolveCapsuleResources(
  capsule: CapsuleResourceBinding,
  dayResources: DayResource[] = [],
): DayResource[] {
  const pool = dayResources || [];
  const inline = capsule.resources || [];
  const ids = capsule.resource_ids || [];
  const fromPool = ids.length ? pool.filter((r) => ids.includes(r.id)) : [];
  const seen = new Set<string>();
  const merged: DayResource[] = [];
  for (const r of [...inline, ...fromPool]) {
    if (!r?.id || seen.has(r.id)) continue;
    seen.add(r.id);
    merged.push(r);
  }
  if (merged.length) return merged;
  return pool;
}
