import { useState } from "react";
import { dayApi, progressApi, sqlLabApi, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useToast } from "../components/Toast";
import type { DayPackage, NodeCompleteResult, NodeState, RubricCheck } from "../lib/types";
import { ErrorState } from "../components/ErrorState";
import { rubricTitle } from "../lib/rubricDisplay";

type EvalShape = {
  pass?: boolean;
  passed?: boolean;
  checks?: { id: string; ok: boolean; detail: string }[];
  score?: number;
};

type SchemaTable = { name: string; columns: { column_name: string; data_type: string }[] };

export function SqlLab({
  day,
  node,
  onCompleted,
  locked,
}: {
  day: DayPackage;
  node: NodeState;
  onCompleted: (result?: NodeCompleteResult) => void;
  locked?: boolean;
}) {
  const { user, campId } = useAuth();
  const toast = useToast();
  const rubric = (node.refs?.rubric || day.lab?.rubric || []) as RubricCheck[];
  const seedSql = ((node.refs?.seed_sql || day.lab?.seed?.seed_sql || []) as string[]) || [];

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [tables, setTables] = useState<SchemaTable[]>([]);
  const [sql, setSql] = useState("SELECT 1;");
  const [columns, setColumns] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [rowcount, setRowcount] = useState<number | null>(null);
  const [durationMs, setDurationMs] = useState<number | null>(null);
  const [evalResult, setEvalResult] = useState<EvalShape | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshSchema = async (sid: string) => {
    const s = await sqlLabApi.schema(sid);
    setTables(s.tables);
  };

  const create = async () => {
    if (locked) return;
    setBusy(true);
    setError(null);
    setEvalResult(null);
    setColumns([]);
    setRows([]);
    try {
      const res = await sqlLabApi.create({
        camp_id: campId || undefined,
        day: day.day,
        node_id: node.id,
        seed_sql: seedSql,
      });
      setSessionId(res.session_id);
      await refreshSchema(res.session_id);
      toast.push("SQL 沙箱已创建", "success");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "创建沙箱失败");
    } finally {
      setBusy(false);
    }
  };

  const run = async () => {
    if (!sessionId || !sql.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await sqlLabApi.exec(sessionId, sql.trim());
      setColumns(res.columns);
      setRows(res.rows);
      setRowcount(res.rowcount);
      setDurationMs(res.duration_ms);
      await refreshSchema(sessionId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "SQL 执行失败");
      setColumns([]);
      setRows([]);
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    if (!sessionId) return;
    setBusy(true);
    try {
      await sqlLabApi.reset(sessionId);
      setColumns([]);
      setRows([]);
      setRowcount(null);
      setEvalResult(null);
      await refreshSchema(sessionId);
      toast.push("已重置为初始数据", "info");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "重置失败");
    } finally {
      setBusy(false);
    }
  };

  const runEval = async () => {
    if (!sessionId) return;
    setBusy(true);
    try {
      const res = (await sqlLabApi.evaluate(sessionId, rubric)) as EvalShape;
      setEvalResult(res);
      const passed = Boolean(res.pass ?? res.passed);
      toast.push(passed ? "评测通过" : "评测未通过", passed ? "success" : "error");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "评测失败");
    } finally {
      setBusy(false);
    }
  };

  const finish = async () => {
    if (!user || !campId) return;
    if (!evalResult || !Boolean(evalResult.pass ?? evalResult.passed)) {
      toast.push("请先通过 Rubric 评测后再完成", "error");
      return;
    }
    setBusy(true);
    try {
      const ev = await progressApi.writeEvidence({
        learner_id: user.id,
        day: day.day,
        node_id: node.id,
        kind: "sim",
        payload: { session_id: sessionId, eval: evalResult },
        capability_tags: ["sql_sandbox", `day:${day.day}`],
      });
      const result = await dayApi.completeNode(node.id, {
        camp_id: campId,
        day: day.day,
        evidence_id: (ev as { id?: string }).id,
      });
      if (sessionId) await sqlLabApi.destroy(sessionId).catch(() => undefined);
      toast.push("SQL Lab 已完成", "success");
      onCompleted(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "完成失败");
    } finally {
      setBusy(false);
    }
  };

  const passed = Boolean(evalResult?.pass ?? evalResult?.passed);

  return (
    <div className="stack">
      <div>
        <h2>{node.title}</h2>
        <p className="muted">
          runner=sql_sandbox
          {sessionId && (
            <>
              {" "}
              · session <span className="mono">{sessionId.slice(0, 8)}</span>
            </>
          )}
        </p>
        <p className="muted" style={{ fontSize: 12 }}>
          每个会话拥有独立的数据库 schema，只能看到自己的表；仅通过本页 API 执行 SQL，凭据不会下发到浏览器。
        </p>
      </div>

      <div className="row">
        <button type="button" className="btn-primary" disabled={locked || busy} onClick={() => void create()}>
          {sessionId ? "重建沙箱" : "创建 SQL 沙箱"}
        </button>
        <button type="button" disabled={!sessionId || busy} onClick={() => void reset()}>
          重置数据
        </button>
        <button type="button" disabled={!sessionId || busy} onClick={() => void runEval()}>
          评测
        </button>
        <button type="button" disabled={locked || busy || node.status === "passed" || !passed} onClick={() => void finish()}>
          通过并完成
        </button>
      </div>

      {error && <ErrorState title="SQL 错误" message={error} onRetry={() => void create()} />}

      {sessionId && (
        <div className="row" style={{ alignItems: "flex-start", gap: 12 }}>
          <div className="panel stack" style={{ flex: 1, minWidth: 0 }}>
            <h3>SQL 控制台</h3>
            <textarea
              className="mono"
              rows={6}
              value={sql}
              onChange={(e) => setSql(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") void run();
              }}
              placeholder="SELECT * FROM your_table;"
              disabled={busy}
            />
            <div className="row">
              <button type="button" className="btn-primary" disabled={busy || !sql.trim()} onClick={() => void run()}>
                执行 (⌘/Ctrl+Enter)
              </button>
              {rowcount != null && (
                <span className="muted" style={{ fontSize: 12 }}>
                  rowcount={rowcount} · {durationMs}ms
                </span>
              )}
            </div>

            {columns.length > 0 && (
              <div style={{ overflowX: "auto" }}>
                <table className="mono" style={{ width: "100%", fontSize: 13 }}>
                  <thead>
                    <tr>
                      {columns.map((c) => (
                        <th key={c} style={{ textAlign: "left", borderBottom: "1px solid var(--color-border)", padding: "4px 8px" }}>
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={i}>
                        {columns.map((c) => (
                          <td key={c} style={{ padding: "4px 8px", borderBottom: "1px solid var(--color-border)" }}>
                            {String(r[c] ?? "")}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {rows.length === 0 && <p className="muted">（无结果行）</p>}
              </div>
            )}
          </div>

          <div className="panel stack" style={{ width: 220, flexShrink: 0 }}>
            <h3>Schema</h3>
            {tables.length === 0 ? (
              <p className="muted" style={{ fontSize: 12 }}>
                （尚无表）
              </p>
            ) : (
              tables.map((t) => (
                <div key={t.name} style={{ marginBottom: 8 }}>
                  <button
                    type="button"
                    style={{ width: "100%", textAlign: "left" }}
                    onClick={() => setSql(`SELECT * FROM ${t.name} LIMIT 50;`)}
                  >
                    {t.name}
                  </button>
                  <ul className="muted" style={{ fontSize: 11, margin: "2px 0 0 16px", padding: 0 }}>
                    {t.columns.map((c) => (
                      <li key={c.column_name}>
                        {c.column_name} <span style={{ opacity: 0.7 }}>{c.data_type}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {evalResult && (
        <div className="panel">
          <h3 style={{ marginBottom: 8 }}>
            评测结果 · {passed ? "通过" : "未通过"}
            {evalResult.score != null && (
              <>
                {" "}
                · <span className="num">{Math.round(Number(evalResult.score) * 100)}%</span>
              </>
            )}
          </h3>
          {evalResult.checks ? (
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {evalResult.checks.map((c, i) => (
                <li key={i} style={{ color: c.ok ? "var(--color-success)" : "var(--color-danger)" }}>
                  {rubricTitle(c.id)} <span className="muted mono" style={{ fontSize: 11 }}>{c.id}</span> — {c.detail}
                </li>
              ))}
            </ul>
          ) : (
            <pre className="log-box">{JSON.stringify(evalResult, null, 2)}</pre>
          )}
        </div>
      )}
    </div>
  );
}
