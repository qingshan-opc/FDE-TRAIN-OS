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
    title: "请在终端窗口内直接输入命令，禁止复制粘贴",
  };
}

/** 在本浏览器新标签页打开实验台（非弹窗） */
export function openCapsuleSimWindow(day: number, capsuleId: string): Window | null {
  const url = `/app/sim/${day}/${encodeURIComponent(capsuleId)}`;
  // 不用 popup features；noopener 会导致 open 返回 null，改为打开后再断开 opener
  const win = window.open(url, "_blank");
  if (!win) {
    window.location.assign(url);
    return null;
  }
  try {
    win.opener = null;
  } catch {
    /* ignore */
  }
  return win;
}

/**
 * 课节仿真终端：embedded 引导开新窗口；fullscreen 在独立页全屏输入。
 */
export function CapsuleSimTerminal({
  day,
  capsuleId,
  lab,
  variant = "embedded",
  autoStart = false,
}: {
  day: number;
  capsuleId: string;
  lab: CapsuleSimConfig;
  variant?: "embedded" | "fullscreen";
  autoStart?: boolean;
}) {
  const { campId } = useAuth();
  const toast = useToast();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [cwd, setCwd] = useState("/home/trainee");
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [evalResult, setEvalResult] = useState<EvalShape | null>(null);
  const [popupHint, setPopupHint] = useState<string | null>(null);
  const termEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const autoStarted = useRef(false);
  const noClip = blockSimClipboard();
  const isFullscreen = variant === "fullscreen";

  const quick = lab.quick_commands?.length
    ? lab.quick_commands
    : ["pwd", "ls -l", "curl localhost:8000/healthz"];
  const rubric = lab.rubric || [];
  const promptText = () => `trainee@fde-server:${cwd.replace("/home/trainee", "~")}$`;

  useEffect(() => {
    termEndRef.current?.scrollIntoView({ block: "end" });
  }, [history, draft, sessionId]);

  useEffect(() => {
    if (sessionId) inputRef.current?.focus();
  }, [sessionId, busy]);

  const focusInput = () => {
    if (!busy) inputRef.current?.focus();
  };

  const create = async () => {
    setBusy(true);
    setError(null);
    setEvalResult(null);
    setHistory([]);
    setDraft("");
    try {
      const res = await simApi.create({
        sim_kind: lab.sim_kind,
        task_spec: { day, node_id: `d${day}-learn:${capsuleId}`, title: `课节实验 · ${capsuleId}`, lab },
        learner_seed: lab.seed || {},
      });
      setSessionId(res.session_id);
      setCwd("/home/trainee");
      setHistory([
        "Welcome to Ubuntu 22.04 LTS (fde-server sim)",
        "在窗口内直接输入命令，按 Enter 执行。",
        "",
      ]);
      toast.push("已进入仿真服务器", "success");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "创建会话失败");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!autoStart || !isFullscreen || autoStarted.current) return;
    autoStarted.current = true;
    void create();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- boot once on fullscreen page
  }, [autoStart, isFullscreen]);

  const exec = async (raw: string) => {
    const c = raw.trim();
    if (!sessionId || !c || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = (await simApi.action(sessionId, "terminal.exec", { cmd: c })) as Record<string, unknown>;
      const stdout = String(res.stdout || "");
      const state = (res.state || {}) as { cwd?: string };
      const lines = [`${promptText()} ${c}`];
      if (stdout) lines.push(...stdout.replace(/\n$/, "").split("\n"));
      setHistory((prev) => [...prev, ...lines]);
      if (state.cwd) setCwd(state.cwd);
      setDraft("");
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

  const openFullscreen = () => {
    setPopupHint(null);
    const win = openCapsuleSimWindow(day, capsuleId);
    if (win) {
      setPopupHint("已在本浏览器新标签页打开实验台。做完后关闭该标签即可回到本课节。");
    }
  };

  const passed = Boolean(evalResult?.pass ?? evalResult?.passed);

  if (!sessionId) {
    if (isFullscreen) {
      return (
        <div className="capsule-sim capsule-sim-boot capsule-sim-boot--fs">
          <div className="capsule-sim-boot-card">
            <div className="capsule-sim-boot-badge">fde-server · sim</div>
            <h4>正在连接仿真服务器…</h4>
            {error ? (
              <>
                <p className="muted" style={{ color: "var(--color-danger)" }}>
                  {error}
                </p>
                <button type="button" className="btn-primary" disabled={busy} onClick={() => void create()}>
                  重试连接
                </button>
              </>
            ) : (
              <p className="muted">{busy ? "连接中…" : "准备进入终端"}</p>
            )}
          </div>
        </div>
      );
    }

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
            <p className="muted">建议在独立全屏窗口中完成实验，输入更宽敞。</p>
          )}
          <p className="capsule-sim-nocopy-hint">建议在新标签页的独立实验台里输入命令，按 Enter 执行；禁止复制粘贴。</p>
          <ol className="capsule-sim-boot-preview">
            {quick.map((c, i) => (
              <li key={`${c}-${i}`}>
                <code className="mono">{c}</code>
              </li>
            ))}
          </ol>
          <div className="capsule-sim-boot-actions">
            <button type="button" className="btn-primary" onClick={openFullscreen}>
              新标签页打开实验台
            </button>
            <button type="button" className="btn-ghost" disabled={busy} onClick={() => void create()}>
              {busy ? "连接中…" : "在本页进入"}
            </button>
          </div>
          {popupHint && <p className="capsule-sim-popup-hint">{popupHint}</p>}
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
    <div
      className={`capsule-sim capsule-sim-workbench${isFullscreen ? " capsule-sim-workbench--fs" : ""}`}
      {...noClip}
    >
      <section className="capsule-sim-main" aria-label="仿真终端" onClick={focusInput}>
        <header className="capsule-sim-chrome">
          <span className="capsule-sim-dots" aria-hidden>
            <i />
            <i />
            <i />
          </span>
          <span className="capsule-sim-host mono">trainee@fde-server — ssh</span>
          <span className="capsule-sim-session mono">{sessionId.slice(0, 8)}</span>
        </header>
        <div className="capsule-sim-terminal mono" role="log" aria-live="polite">
          {history.length > 0 && <pre className="capsule-sim-history">{history.join("\n")}</pre>}
          <div className="capsule-sim-live-line">
            <span className="capsule-sim-prompt">{promptText()}</span>
            <input
              ref={inputRef}
              className="capsule-sim-inline-input mono"
              value={draft}
              disabled={busy}
              spellCheck={false}
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              data-no-clipboard="true"
              title={noClip.title}
              aria-label="在终端内输入命令"
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                noClip.onKeyDown(e);
                if (e.key === "Enter") {
                  e.preventDefault();
                  void exec(draft);
                }
              }}
              onCopy={noClip.onCopy}
              onCut={noClip.onCut}
              onPaste={noClip.onPaste}
              onDrop={noClip.onDrop}
              onDragOver={noClip.onDragOver}
            />
            {!busy && <span className="capsule-sim-cursor" aria-hidden />}
          </div>
          <div ref={termEndRef} />
        </div>
        {error && (
          <p className="muted" style={{ color: "var(--color-danger)", margin: "8px 12px 0" }}>
            {error}
          </p>
        )}
      </section>

      <aside className="capsule-sim-ops" aria-label="操作说明">
        <h4>操作说明</h4>
        <p className="capsule-sim-ops-note">在左侧终端窗口内直接输入命令，按 Enter 执行。右侧仅供阅读参考。</p>
        {lab.task_brief ? <div className="capsule-sim-ops-brief">{lab.task_brief}</div> : null}
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
                setHistory([]);
                setEvalResult(null);
                setDraft("");
                autoStarted.current = false;
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
            {passed && <p className="muted">课节实验过关。可关闭本标签页回到课节。</p>}
          </div>
        )}
      </aside>
    </div>
  );
}
