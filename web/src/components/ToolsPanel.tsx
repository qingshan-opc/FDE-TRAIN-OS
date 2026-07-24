import { useEffect, useState } from "react";
import { dayApi, mediaApi, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import type { DayPackage, DayResource } from "../lib/types";

interface DbResourceItem {
  id?: string;
  title?: string;
  kind?: string;
  url?: string;
  object_key?: string;
  meta_json?: Record<string, unknown>;
}

/**
 * Learner-facing 「工具与资料」 panel (C) — merges two sources:
 *  - the day package's own `resources` (YAML, e.g. tool guides like
 *    "Agent Lab 使用说明") which ship instantly with `DayPackage`;
 *  - author-uploaded supplementary materials from
 *    `GET /camps/{camp}/days/{day}/resources` (DB-backed, may be empty).
 * Renders nothing when there is truly nothing to show, so it never adds
 * empty chrome to the learn/lab views that embed it.
 */
export function ToolsPanel({ day }: { day: DayPackage | null }) {
  const { campId } = useAuth();
  const [dbItems, setDbItems] = useState<DbResourceItem[]>([]);
  const [links, setLinks] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDbItems([]);
    setLinks({});
    setError(null);
    if (!campId || !day) return;
    let cancelled = false;
    dayApi
      .resources(campId, day.day)
      .then((res) => {
        if (!cancelled) setDbItems((res.items as DbResourceItem[]) || []);
      })
      .catch((err) => {
        if (!cancelled && err instanceof ApiError && err.status !== 404) {
          setError(err.message);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [campId, day?.day]);

  const openResource = async (item: DbResourceItem) => {
    if (item.url) {
      window.open(item.url, "_blank", "noopener,noreferrer");
      return;
    }
    if (!item.object_key) return;
    const key = item.id || item.object_key;
    if (links[key]) {
      window.open(links[key], "_blank", "noopener,noreferrer");
      return;
    }
    try {
      const res = await mediaApi.presign(item.object_key, campId || undefined);
      setLinks((prev) => ({ ...prev, [key]: res.url }));
      window.open(res.url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "资料链接获取失败");
    }
  };

  const packageResources: DayResource[] = day?.resources || [];
  if (!packageResources.length && !dbItems.length) return null;

  return (
    <div className="panel tools-panel" aria-label="工具与资料">
      <h3 style={{ marginBottom: 8, fontSize: 14 }}>工具与资料</h3>
      {packageResources.length > 0 && (
        <ul className="tools-panel-list">
          {packageResources.map((r) => (
            <li key={r.id}>
              <strong>{r.title}</strong>
              {r.kind && <span className="muted mono" style={{ fontSize: 11 }}> · {r.kind}</span>}
              {r.summary && <p className="muted" style={{ fontSize: 12, margin: "2px 0 0" }}>{r.summary}</p>}
            </li>
          ))}
        </ul>
      )}
      {dbItems.length > 0 && (
        <ul className="tools-panel-list" style={{ marginTop: packageResources.length ? 8 : 0 }}>
          {dbItems.map((it, i) => (
            <li key={it.id || i}>
              <button type="button" className="tools-panel-link" onClick={() => void openResource(it)}>
                {it.title || "资料"}
              </button>
              {it.kind && <span className="muted mono" style={{ fontSize: 11 }}> · {it.kind}</span>}
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p className="muted" style={{ color: "var(--color-danger)", fontSize: 12, marginTop: 6 }}>
          {error}
        </p>
      )}
    </div>
  );
}
