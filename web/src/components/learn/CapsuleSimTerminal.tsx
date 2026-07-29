import { useEffect, useRef, useState } from "react";
import { simApi, evalApi, ApiError } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { useToast } from "../Toast";
import type { RubricCheck } from "../../lib/types";
import { blockPracticeClipboard } from "../../lib/practiceClipboard";

export interface CapsuleSimConfig {
  sim_kind: string;
  task_brief?: string;
  quick_commands?: string[];
  rubric?: RubricCheck[];
  seed?: Record<string, unknown>;
}

type EvalShape = { pass?: boolean; passed?: boolean; checks?: { id: string; ok: boolean; detail: string }[]; score?: number };

function blockSimClipboard() {
  const base = blockPracticeClipboard<HTMLElement>();
  return {
    ...base,
    title: "仿真服务器禁止复制粘贴，请手打命令",
  };
}

/**
 * 课节内嵌「服务器」实验台：左终端 / 右操作说明，禁止复制粘贴。
 * 不做节点完成（节点完成仍在今日 Lab），只承担课节内动手环节。
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
  const termEndRef = useRef<HTMLDivElement | null>(null);
  const noClip = blockSimClipboard();

  const quick = lab.quick_commands?.length
    ? lab.quick_commands
    : ["pwd", "ls -l", "curl localhost:8000/healthz"];
  const rubric = lab.rubric || [];
  const promptText = () => `trainee@fde-server:${cwd.replace("/home/trainee", "~")}$`;

  useEffect(() => {
    termEndRef.current?.scrollIntoView({ block: "end" });
  }, [termLines, sessionId]);

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
      setTermLines([
        "Welcome to Ubuntu 22.04 LTS (fde-server sim)",
        "Type commands below. Copy/paste is disabled.",
        "",
      ]);
      toast.push("已进入仿真服务器", "success");
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
      if (stdout) lines.push(stdout);
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

  if (!sessionId) {
    return (
      <div className="capsule-sim capsule-sim-boot">
        <div className="capsule-sim-boot-card">
          <div className="capsule-sim-boot-badge">fde-server · sim</div>
          <h4>仿真服务器实验台</h4>
          {lab.task_brief ? (
            <p className="capsule-sim-boot-brief" {...noClip}>
              {lab.task_brief}
            </p>
          ) : (
            <p className="muted">在仿真 Ubuntu 上敲命令，操作说明在进入后显示于右侧。</p>
          )}
          <p className="capsule-sim-nocopy-hint">禁止复制粘贴，请手打命令。</p>
          <button type="button" className="btn-primary" disabled={busy} onClick={() => void create()}>
            {busy ? "连接中…" : "进入服务器"}
          </button>
          {error && (
            <p className="muted" style={{ color: "var(--color-danger)" }}>
              {error}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="capsule-sim capsule-sim-workbench" {...noClip}>
      <section className="capsule-sim-main" aria-label="仿真终端">
        <header className="capsule-sim-chrome">
          <span className="capsule-sim-dots" aria-hidden>
            <i />
            <i />
            <i />
          </span>
          <span className="capsule-sim-host mono">trainee@fde-server — ssh</span>
          <span className="capsule-sim-session mono">{sessionId.slice(0, 8)}</span>
        </header>
        <div className="capsule-sim-terminal mono" aria-live="polite">
          {termLines.length ? termLines.join("\n") : `${promptText()} `}
          <div ref={termEndRef} />
        </div>
        <div className="capsule-sim-prompt-row">
          <span className="capsule-sim-prompt mono">{promptText()}</span>
          <input
            className="capsule-sim-cmd mono"
            value={cmd}
            placeholder="手打命令，回车执行"
            disabled={busy}
            onChange={(e) => setCmd(e.target.value)}
            onKeyDown={(e) => {
              noClip.onKeyDown(e);
              if (e.key === "Enter") void exec(cmd);
            }}
            onCopy={noClip.onCopy}
            onCut={noClip.onCut}
            onPaste={noClip.onPaste}
            onDrop={noClip.onDrop}
            onDragOver={noClip.onDragOver}
            spellCheck={false}
            autoComplete="off"
            data-no-clipboard="true"
            title={noClip.title}
          />
          <button
            type="button"
            className="btn-primary"
            disabled={busy || !cmd.trim()}
            onClick={() => void exec(cmd)}
          >
            执行
          </button>
        </div>
        {error && (
          <p className="muted" style={{ color: "var(--color-danger)", margin: "8px 12px 0" }}>
            {error}
          </p>
        )}
      </section>

      <aside className="capsule-sim-ops" aria-label="操作说明">
        <h4>操作说明</h4>
        <p className="capsule-sim-ops-note">右侧仅供阅读参考，命令须在左侧终端手打。禁止复制。</p>
        {lab.task_brief ? (
          <div className="capsule-sim-ops-brief">{lab.task_brief}</div>
        ) : null}
        <h5>建议命令顺序</h5>
        <ol className="capsule-sim-ops-steps">
          {quick.map((c, i) => (
            <li key={`${c}-${i}`}>
              <span className="capsule-sim-ops-idx num">{i + 1}</span>
              <code className="mono">{c}</code>
            </li>
          ))}
        </ol>
        {rubric.length > 0 && (
          <div className="capsule-sim-ops-actions">
            <button type="button" disabled={busy} onClick={() => void runEval()}>
              {busy ? "评测中…" : "评测本实验"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setSessionId(null);
                setTermLines([]);
                setEvalResult(null);
                setCmd("");
              }}
            >
              断开重连
            </button>
          </div>
        )}
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
            {passed && <p className="muted">课节实验过关。</p>}
          </div>
        )}
      </aside>
    </div>
  );
}
