export type ListQuery = {
  page?: number;
  page_size?: number;
  q?: string;
  [key: string]: string | number | undefined;
};

export type Paginated<T> = {
  items: T[];
  total: number;
  page: number;
  page_size: number;
};

export function toQuery(params?: ListQuery | null): string {
  if (!params) return "";
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    q.set(k, String(v));
  }
  return q.toString();
}

export function normalizePage(page?: number | string | null, fallback = 1): number {
  const n = Number(page);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.floor(n);
}

export function normalizePageSize(pageSize?: number | string | null, fallback = 20): number {
  const n = Number(pageSize);
  if (!Number.isFinite(n) || n < 1) return fallback;
  if (n > 100) return 100;
  return Math.floor(n);
}

export const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;
export const SEARCH_DEBOUNCE_MS = 300;
