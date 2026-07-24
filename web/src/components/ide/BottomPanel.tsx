import type { ReactNode } from "react";
import type { EvalResult } from "../../lib/types";
import { rubricTitle } from "../../lib/rubricDisplay";

export type BottomTab = "events" | "eval" | "problems" | "terminal";

export type ProblemItem = {
  path: string;
  message: string;
  severity: string;
  line?: number;
};

export function BottomPanel({
  open,
  onToggle,
  tab,
  onTab,
  logs,
  evalResult,
  problems,
  terminal,
  onProblemClick,
}: {
  open: boolean;
  onToggle: () => void;
  tab: BottomTab;
  onTab: (t: BottomTab) => void;
  logs: string[];
  evalResult: EvalResult | null;
  problems?: ProblemItem[];
  terminal?: ReactNode;
  onProblemClick?: (p: ProblemItem) => void;
}) {
  const expanded = open || Boolean(evalResult);
  const tabs = (
    [
      ["events", "事件流"],
      ["eval", "评测"],
      ["problems", "问题"],
      ...(terminal ? [["terminal", "终端"] as const] : []),
    ] as const
  );

  return (
    <div className={`lab-ide-bottom ide-bottom${expanded ? " open" : ""}`}>
      <div className="ide-bottom-bar">
        <button type="button" className="lab-ide-fold" onClick={onToggle}>
          面板 {expanded ? "▾" : "▸"}
        </button>
        {expanded && (
          <div role="tablist" aria-label="底部面板" className="ide-bottom-tabs">
            {tabs.map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                id={`ide-bottom-tab-${id}`}
                className={`ide-bottom-tab${tab === id ? " active" : ""}`}
                onClick={() => onTab(id)}
              >
                {label}
                {id === "eval" && evalResult ? (evalResult.pass ? " ✓" : " ✗") : ""}
                {id === "problems" && problems?.length ? ` (${problems.length})` : ""}
              </button>
            ))}
          </div>
        )}
      </div>
      {expanded && (
        <div
          className="lab-ide-bottom-body ide-bottom-body"
          role="tabpanel"
          aria-labelledby={`ide-bottom-tab-${tab}`}
        >
          {tab === "events" && (
            <pre className="log-box lab-ide-log">{logs.length ? logs.join("\n") : "启动生成后显示进度"}</pre>
          )}
          {tab === "eval" && (
            <div className="lab-ide-eval">
              {evalResult ? (
                <>
                  <strong>
                    评测 · {evalResult.pass ? "通过" : "未通过"} · {Math.round(evalResult.score * 100)}%
                  </strong>
                  <ul>
                    {evalResult.checks.map((c, i) => (
                      <li key={i} style={{ color: c.ok ? "var(--color-success)" : "var(--color-danger)" }}>
                        <div>
                          {c.title_zh || rubricTitle(c.id)}{" "}
                          <span className="muted mono" style={{ fontSize: 11 }}>
                            {c.id}
                          </span>{" "}
                          — {c.detail}
                        </div>
                        {!c.ok && c.suggestion && <div style={{ fontSize: 11 }}>建议：{c.suggestion}</div>}
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="muted">尚未评测</p>
              )}
            </div>
          )}
          {tab === "problems" && (
            <ul className="ide-problems">
              {(problems || []).length === 0 ? (
                <li className="muted">无诊断问题</li>
              ) : (
                (problems || []).map((p, i) => (
                  <li key={i}>
                    <button type="button" className="ide-problem-link" onClick={() => onProblemClick?.(p)}>
                      <span className="mono">{p.path}</span>
                      {p.line != null ? `:${p.line}` : ""} · {p.severity}: {p.message}
                    </button>
                  </li>
                ))
              )}
            </ul>
          )}
          {tab === "terminal" && terminal}
        </div>
      )}
    </div>
  );
}
