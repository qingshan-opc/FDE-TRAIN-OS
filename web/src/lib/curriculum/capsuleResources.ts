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
  const hasExplicitIds = Array.isArray(capsule.resource_ids);
  const ids = hasExplicitIds ? capsule.resource_ids || [] : [];
  const fromPool = hasExplicitIds ? pool.filter((r) => ids.includes(r.id)) : [];
  const seen = new Set<string>();
  const merged: DayResource[] = [];
  for (const r of [...inline, ...fromPool]) {
    if (!r?.id || seen.has(r.id)) continue;
    seen.add(r.id);
    merged.push(r);
  }
  if (merged.length) return merged;
  if (hasExplicitIds) return [];
  return pool;
}

const DOWNLOAD_EXTS = [".zip", ".pdf", ".docx", ".xlsx", ".ppt", ".pptx"];

export function resourceIsDownload(r: DayResource): boolean {
  if ((r.kind || "").toLowerCase() === "download") return true;
  const path = (r.url || "").split("?")[0].toLowerCase();
  return DOWNLOAD_EXTS.some((ext) => path.endsWith(ext));
}

export function resourceActionLabel(r: DayResource): string {
  return resourceIsDownload(r) ? "下载" : "打开";
}

export function resourceDownloadName(r: DayResource): string | undefined {
  if (!resourceIsDownload(r) || !r.url) return undefined;
  const path = r.url.split("?")[0];
  const name = decodeURIComponent(path.split("/").pop() || "");
  return name || undefined;
}
