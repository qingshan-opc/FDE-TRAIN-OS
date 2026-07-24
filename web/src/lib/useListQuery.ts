import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { normalizePage, normalizePageSize, SEARCH_DEBOUNCE_MS } from "./listQuery";

export { SEARCH_DEBOUNCE_MS };

type Opts = {
  defaults?: Record<string, string>;
  pageSizeDefault?: number;
};

export function useListQuery(opts: Opts = {}) {
  const [params, setParams] = useSearchParams();
  const pageSizeDefault = opts.pageSizeDefault ?? 20;
  const defaults = opts.defaults || {};

  const page = normalizePage(params.get("page"), 1);
  const page_size = normalizePageSize(params.get("page_size"), pageSizeDefault);
  const q = params.get("q") || "";

  const filters = useMemo(() => {
    const out: Record<string, string> = { ...defaults };
    params.forEach((v, k) => {
      if (k === "page" || k === "page_size") return;
      out[k] = v;
    });
    return out;
  }, [params, defaults]);

  const setQuery = useCallback(
    (patch: Record<string, string | number | undefined | null>, resetPage = false) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [k, v] of Object.entries(patch)) {
            if (v === undefined || v === null || v === "") next.delete(k);
            else next.set(k, String(v));
          }
          if (resetPage) next.set("page", "1");
          if (!next.get("page")) next.set("page", String(page));
          if (!next.get("page_size")) next.set("page_size", String(page_size));
          return next;
        },
        { replace: true },
      );
    },
    [setParams, page, page_size],
  );

  const setPage = useCallback(
    (nextPage: number, nextSize?: number) => {
      setQuery({
        page: normalizePage(nextPage, 1),
        page_size: nextSize != null ? normalizePageSize(nextSize, pageSizeDefault) : page_size,
      });
    },
    [setQuery, page_size, pageSizeDefault],
  );

  const setFilter = useCallback(
    (key: string, value: string | undefined) => {
      setQuery({ [key]: value || undefined }, true);
    },
    [setQuery],
  );

  const reset = useCallback(() => {
    setParams(
      () => {
        const next = new URLSearchParams();
        next.set("page", "1");
        next.set("page_size", String(pageSizeDefault));
        for (const [k, v] of Object.entries(defaults)) {
          if (v) next.set(k, v);
        }
        return next;
      },
      { replace: true },
    );
  }, [setParams, pageSizeDefault, defaults]);

  const hasFilters = useMemo(() => {
    if (q) return true;
    for (const [k, v] of Object.entries(filters)) {
      if (k === "q") continue;
      if (defaults[k] != null && defaults[k] === v) continue;
      if (v) return true;
    }
    return false;
  }, [q, filters, defaults]);

  return {
    page,
    page_size,
    q,
    filters,
    hasFilters,
    setPage,
    setFilter,
    setQuery,
    reset,
    listParams: { page, page_size, q: q || undefined, ...filters },
  };
}
