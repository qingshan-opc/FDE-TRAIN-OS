import { useEffect, useMemo, useState } from "react";
import { dayApi, evalApi, progressApi, simApi, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useToast } from "../components/Toast";
import type { DayPackage, NodeCompleteResult, NodeState, RubricCheck } from "../lib/types";
import { ErrorState } from "../components/ErrorState";
import { Skeleton } from "../components/Skeleton";
import { rubricTitle } from "../lib/rubricDisplay";
import { KubernetesWorkbench } from "../components/ide/KubernetesWorkbench";

type EvalShape = {
  pass?: boolean;
  passed?: boolean;
  checks?: { id: string; ok: boolean; detail: string }[];
  score?: number;
};

export function SimLab({
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
  const simKind = String(node.refs?.sim_kind || day.lab?.sim_kind || "web_dev");
  const rubric = (node.refs?.rubric || day.lab?.rubric || []) as RubricCheck[];
  const seed = (node.refs?.seed || day.lab?.seed || {}) as Record<string, unknown>;
  const layout = String(
    (node.refs?.ui as { layout?: string } | undefined)?.layout ||
      (day.lab?.ui as { layout?: string } | undefined)?.layout ||
      "",
  );

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [view, setView] = useState<Record<string, unknown> | null>(null);
  const [termLines, setTermLines] = useState<string[]>([]);
  const [cmd, setCmd] = useState("");
  const [nodes, setNodes] = useState<{ id: string; type?: string }[]>([]);
  const [decisionNote, setDecisionNote] = useState("");
  const [monthlyCost, setMonthlyCost] = useState("600");
  const [latency, setLatency] = useState("300");
  const [residency, setResidency] = useState("cn");
  const [evalResult, setEvalResult] = useState<EvalShape | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isTerminal = layout === "terminal_plus_panels" || simKind === "server";
  const isCanvas = layout === "constraint_canvas" || simKind === "arch_design";
  const isK8s = simKind === "k8s" || layout === "cli_plus_topology";

  const constraints = useMemo(() => {
    const c = (seed.constraints || view?.constraints || {}) as Record<string, unknown>;
    return c;
  }, [seed, view]);

  useEffect(() => {
    setSessionId(null);
    setView(null);
    setTermLines([]);
    setCmd("");
    setNodes([]);
    setDecisionNote("");
    setEvalResult(null);
    setError(null);
  }, [day.day, node.id]);

  const refreshView = async (sid: string) => {
    const vm = await simApi.view(sid);
    setView(vm);
    if (Array.isArray(vm.nodes)) {
      setNodes(vm.nodes as { id: string; type?: string }[]);
    }
  };

  const create = async () => {
    if (locked) return;
    setBusy(true);
    setError(null);
    setEvalResult(null);
    setTermLines([]);
    try {
      const res = await simApi.create({
        sim_kind: simKind,
        task_spec: { day: day.day, node_id: node.id, title: node.title, lab: day.lab },
        learner_seed: seed,
      });
      setSessionId(res.session_id);
      await refreshView(res.session_id);
      toast.push(`Sim 会话已创建 (${res.sim_kind})`, "success");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "创建会话失败");
    } finally {
      setBusy(false);
    }
  };

  const runAction = async (type: string, payload: Record<string, unknown> = {}) => {
    if (!sessionId) return;
    setBusy(true);
    setError(null);
    try {
      const res = (await simApi.action(sessionId, type, payload)) as Record<string, unknown>;
      if (type === "terminal.exec") {
        const stdout = String(res.stdout || "");
        const c = String(payload.cmd || "");
        setTermLines((prev) => [...prev, `$ ${c}`, stdout || "(no output)"]);
      }
      await refreshView(sessionId);
      if (type !== "manifest.set") toast.push("动作已应用", "success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "动作失败");
    } finally {
      setBusy(false);
    }
  };

  const runEval = async () => {
    if (!sessionId) return;
    setBusy(true);
    try {
      let res: EvalShape;
      try {
        const bridged = await evalApi.run({
          runner: "sim",
          sim_session_id: sessionId,
          rubric,
          camp_id: campId || undefined,
          day: day.day,
          node_id: node.id,
          write_evidence: true,
        });
        const inner = (bridged.result || {}) as EvalShape;
        res = {
          pass: Boolean(inner.pass ?? inner.passed),
          checks: inner.checks,
          score: Number(inner.score ?? 0),
        };
      } catch {
        res = (await simApi.evaluate(sessionId, rubric)) as EvalShape;
      }
      setEvalResult(res);
      const passed = Boolean(res.pass ?? res.passed);
      toast.push(passed ? "评测通过" : "评测未通过", passed ? "success" : "error");
    } catch (err) {
      setError(err instanceof Error ? err.message : "评测失败");
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
        capability_tags: ["sim", simKind, `day:${day.day}`],
      });
      const result = await dayApi.completeNode(node.id, {
        camp_id: campId,
        day: day.day,
        evidence_id: (ev as { id?: string }).id,
      });
      toast.push("Sim Lab 已完成", "success");
      onCompleted(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "完成失败");
    } finally {
      setBusy(false);
    }
  };

  const addComponent = async (id: string) => {
    if (nodes.some((n) => n.id === id)) return;
    await runAction("canvas.add_node", { id, type: "service" });
  };

  const applyNfrAndNote = async () => {
    await runAction("canvas.set_nfr", {
      monthly_cost_usd: Number(monthlyCost),
      p95_latency_ms: Number(latency),
      data_residency: residency,
    });
    if (decisionNote.trim()) {
      await runAction("canvas.set_decision_note", { text: decisionNote.trim() });
    }
  };

  const passed = Boolean(evalResult?.pass ?? evalResult?.passed);

  return (
    <div className="stack">
      <div>
        <h2>{node.title}</h2>
        <p className="muted">
          runner=sim · kind <span className="mono">{simKind}</span>
          {layout && (
            <>
              {" "}
              · UI <span className="mono">{layout}</span>
            </>
          )}
          {sessionId && (
            <>
              {" "}
              · session <span className="mono">{sessionId.slice(0, 8)}</span>
            </>
          )}
        </p>
        <p className="muted" style={{ fontSize: 12 }}>
          {isK8s
            ? "Kubernetes 实训运行在仿真对象图上，不会拉起真实集群。"
            : "仿真状态保存在当前 API 进程内存；重启服务后需重建会话。"}
        </p>
      </div>

      <div className="row">
        <button type="button" className="btn-primary" disabled={locked || busy} onClick={() => void create()}>
          {sessionId ? "重建会话" : "创建 Sim 会话"}
        </button>
        <button type="button" disabled={!sessionId || busy} onClick={() => void runEval()}>
          评测
        </button>
        <button type="button" disabled={locked || busy || node.status === "passed" || !passed} onClick={() => void finish()}>
          通过并完成
        </button>
        {sessionId && (
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              void simApi.reset(sessionId).then(async () => {
                setTermLines([]);
                setNodes([]);
                setDecisionNote("");
                setEvalResult(null);
                await refreshView(sessionId);
                toast.push("已重置", "info");
              })
            }
          >
            重置
          </button>
        )}
      </div>

      {error && <ErrorState title="Sim 错误" message={error} onRetry={() => void create()} />}
      {busy && !view && !sessionId && <Skeleton rows={5} />}

      {sessionId && isK8s && (
        <KubernetesWorkbench
          sessionId={sessionId}
          view={view}
          busy={busy}
          onAction={runAction}
          onRefresh={() => refreshView(sessionId)}
        />
      )}

      {sessionId && isTerminal && !isK8s && (
        <div className="panel stack">
          <h3>终端</h3>
          <div className="sim-terminal" aria-live="polite">
            {termLines.length ? termLines.join("\n") : "输入命令执行仿真 shell（如 nginx -t）"}
          </div>
          <div className="row" style={{ flexWrap: "wrap" }}>
            {[
              "echo 'proxy_pass http://127.0.0.1:3000;' > /etc/nginx/sites-enabled/docs",
              "nginx -t",
              "systemctl reload nginx",
              "cat /etc/nginx/sites-enabled/docs",
            ].map((c) => (
              <button key={c} type="button" disabled={busy} onClick={() => void runAction("terminal.exec", { cmd: c })}>
                {c.length > 36 ? `${c.slice(0, 36)}…` : c}
              </button>
            ))}
          </div>
          <div className="field">
            <label htmlFor="sim-cmd">命令</label>
            <input
              id="sim-cmd"
              className="mono"
              value={cmd}
              onChange={(e) => setCmd(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && cmd.trim()) void runAction("terminal.exec", { cmd: cmd.trim() }).then(() => setCmd(""));
              }}
              disabled={busy}
            />
          </div>
          <button
            type="button"
            className="btn-primary"
            disabled={busy || !cmd.trim()}
            onClick={() => void runAction("terminal.exec", { cmd: cmd.trim() }).then(() => setCmd(""))}
          >
            执行
          </button>
          {view && (
            <p className="muted mono" style={{ fontSize: 12 }}>
              ports={JSON.stringify(view.ports || {})} cwd={String(view.cwd || "")}
            </p>
          )}
        </div>
      )}

      {sessionId && isCanvas && (
        <div className="panel stack">
          <h3>约束画布</h3>
          <p className="muted" style={{ fontSize: 12 }}>
            约束：月成本 ≤ {String(constraints.max_monthly_cost_usd ?? "—")} · p95 ≤{" "}
            {String(constraints.p95_latency_ms ?? "—")}ms · 驻留 {String(constraints.data_residency ?? "—")}
          </p>
          <div className="row" style={{ flexWrap: "wrap" }}>
            {["api", "warehouse", "auth", "cache", "db"].map((id) => (
              <button key={id} type="button" disabled={busy || nodes.some((n) => n.id === id)} onClick={() => void addComponent(id)}>
                + {id}
              </button>
            ))}
          </div>
          <div className="sim-canvas-nodes">
            {nodes.length === 0 ? <span className="muted">尚未添加组件</span> : null}
            {nodes.map((n) => (
              <span key={n.id} className="sim-canvas-node">
                {n.id}
              </span>
            ))}
          </div>
          <div className="row" style={{ gap: 8 }}>
            <div className="field" style={{ flex: 1 }}>
              <label htmlFor="cost">月成本 USD</label>
              <input id="cost" className="mono" value={monthlyCost} onChange={(e) => setMonthlyCost(e.target.value)} />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label htmlFor="lat">p95 ms</label>
              <input id="lat" className="mono" value={latency} onChange={(e) => setLatency(e.target.value)} />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label htmlFor="res">驻留</label>
              <input id="res" className="mono" value={residency} onChange={(e) => setResidency(e.target.value)} />
            </div>
          </div>
          <div className="field">
            <label htmlFor="note">决策说明（≥120 字）</label>
            <textarea id="note" rows={4} value={decisionNote} onChange={(e) => setDecisionNote(e.target.value)} />
            <p className="muted num" style={{ fontSize: 12 }}>
              {decisionNote.length} 字
            </p>
          </div>
          <button type="button" className="btn-primary" disabled={busy} onClick={() => void applyNfrAndNote()}>
            保存 NFR 与决策说明
          </button>
        </div>
      )}

      {sessionId && !isTerminal && !isCanvas && !isK8s && (
        <div className="panel">
          <h3 style={{ marginBottom: 8 }}>视图模型</h3>
          <pre className="log-box">{JSON.stringify(view, null, 2)}</pre>
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
