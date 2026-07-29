import { useState } from "react";
import { simApi, evalApi, ApiError } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { useToast } from "../Toast";
import type { RubricCheck } from "../../lib/types";

export interface CapsuleSimConfig {
  sim_kind: string;
  task_brief?: string;
  quick_commands?: string[];
  rubric?: RubricCheck[];
  seed?: Record<string, unknown>;
}

type EvalShape = { pass?: boolean; passed?: boolean; checks?: { id: string; ok: boolean; detail: string }[]; score?: number };

/**
 * 课节内嵌「实验」终端（轻量版 SimLab）：创建 sim 会话 → 敲命令 → 评测展示。
 * 不做节点完成（节点完成仍在今日 Lab 节点），只承担课节内的动手环节。
 */
export function CapsuleSimTerminal({ day, capsuleId, lab }: { day: number; capsuleId: string; lab: CapsuleSimConfig }) {
  const { campId } = useAuth();
  const toast = useToast();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [termLines, setTermLines] = useState<string[]>([]);
  const [cwd, setCwd] = useState("/home/trainee");
  const [cmd, setCmd] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [evalResult, setEvalResult] = useState<EvalShape | null>(null);

  const quick = lab.quick_commands?.length ? lab.quick_commands : ["pwd", "ls -l", "curl localhost:8000/healthz"];
  const rubric = lab.rubric || [];
  const promptText = () => `trainee@fde-server:${cwd.replace("/home/trainee", "~")}$`;

  const create = async () => {
    setBusy(true);
    setError(null);
    setEvalResult(null);
    setTermLines([]);
    try {
      const res = await simApi.create({
        sim_kind: lab.sim_kind,
        task_spec: { day, node_id: `d${day}-learn:${capsuleId}`, title: `课节实验 · ${capsuleId}`, lab },
        learner_seed: lab.seed || {},
      });
      setSessionId(res.session_id);
      setCwd("/home/trainee");
      toast.push("实验会话已创建", "success");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "创建会话失败");
    } finally {
      setBusy(false);
    }
  };

  const exec = async (c: string) => {
    if (!sessionId || !c.trim()) return;
    setBusy(true);
    try {
      const res = (await simApi.action(sessionId, "terminal.exec", { cmd: c.trim() })) as Record<string, unknown>;
      const stdout = String(res.stdout || "");
      const state = (res.state || {}) as { cwd?: string };
      const lines = [`${promptText()} ${c.trim()}`];
      if (stdout) lines.push(stdout); // 真实终端：无输出就是无输出，不打印占位
      setTermLines((prev) => [...prev, ...lines]);
      if (state.cwd) setCwd(state.cwd);
      setCmd("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "执行失败");
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
          day,
          node_id: `d${day}-learn`,
          write_evidence: false,
        });
        const inner = (bridged.result || {}) as EvalShape;
        res = { pass: Boolean(inner.pass ?? inner.passed), checks: inner.checks, score: Number(inner.score ?? 0) };
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

  const passed = Boolean(evalResult?.pass ?? evalResult?.passed);

  return (
    <div className="capsule-sim">
      {!sessionId ? (
        <div className="capsule-sim-intro">
          {lab.task_brief && <p className="muted" style={{ whiteSpace: "pre-line" }}>{lab.task_brief}</p>}
          <button type="button" className="btn-primary" disabled={busy} onClick={() => void create()}>
            {busy ? "创建中…" : "进入实验台"}
          </button>
          {error && <p className="muted" style={{ color: "var(--color-danger)" }}>{error}</p>}
        </div>
      ) : (
        <>
          {lab.task_brief && (
            <p className="muted" style={{ fontSize: 13, whiteSpace: "pre-line" }}>{lab.task_brief}</p>
          )}
          <div className="sim-terminal" aria-live="polite">
            {termLines.length ? termLines.join("\n") : `输入命令执行仿真 shell（如 ${quick[0]}）`}
          </div>
          <div className="row" style={{ flexWrap: "wrap" }}>
            {quick.map((c) => (
              <button
                key={c}
                type="button"
                title="填入输入框（自己回车执行，不许代敲）"
                disabled={busy}
                onClick={() => setCmd(c)}
              >
                {c.length > 36 ? `${c.slice(0, 36)}…` : c}
              </button>
            ))}
          </div>
          <div className="row">
            <input
              className="mono"
              style={{ flex: 1 }}
              value={cmd}
              placeholder="输入命令，回车执行"
              onChange={(e) => setCmd(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void exec(cmd);
              }}
              disabled={busy}
            />
            <button type="button" className="btn-primary" disabled={busy || !cmd.trim()} onClick={() => void exec(cmd)}>
              执行
            </button>
            {rubric.length > 0 && (
              <button type="button" disabled={busy} onClick={() => void runEval()}>
                评测
              </button>
            )}
          </div>
          {evalResult && (
            <div className={`capsule-sim-eval ${passed ? "is-pass" : "is-fail"}`}>
              <strong>{passed ? "✓ 评测通过" : "✗ 评测未通过"}</strong>
              <ul>
                {(evalResult.checks || []).map((c, i) => (
                  <li key={i} className={c.ok ? "ok" : "bad"}>
                    {c.ok ? "✓" : "✗"} {c.detail}
                  </li>
                ))}
              </ul>
              {passed && <p className="muted">实验完成——记得去今日 Lab 节点完成同样任务，才算过闸。</p>}
            </div>
          )}
          {error && <p className="muted" style={{ color: "var(--color-danger)" }}>{error}</p>}
        </>
      )}
    </div>
  );
}
