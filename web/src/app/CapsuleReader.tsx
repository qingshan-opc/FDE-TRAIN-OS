import { useEffect, useMemo, useRef, useState } from "react";
import { capsuleApi, practiceApi, dayApi, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useToast } from "../components/Toast";
import type { Capsule, CapsulePracticeSpec, DayPackage, DayResource, NodeCompleteResult, NodeState } from "../lib/types";
import { resolveCapsuleResources } from "../lib/curriculum/capsuleResources";
import { ErrorState } from "../components/ErrorState";
import { Empty } from "../components/Empty";
import { CapsuleMediaStack } from "../components/CapsuleMedia";
import { ToolsPanel } from "../components/ToolsPanel";
import { LocalPrepPanel } from "../components/learn/LocalPrepPanel";
import { blockPracticeClipboard } from "../lib/practiceClipboard";

type LearnTab = "notes" | "resources" | "local_prep" | "practice";

function CapsuleProse({ content }: { content: string }) {
  return (
    <div className="capsule-prose">
      {content.split(/\n{2,}/).map((block, i) => {
        const text = block.trim();
        if (!text) return null;
        const firstLine = text.split("\n")[0]?.trim() || "";
        const isHeading = /^【.+】$/.test(firstLine);
        if (isHeading) {
          const [head, ...rest] = text.split("\n");
          const title = head.replace(/[【】]/g, "");
          const body = rest.join("\n").trim();
          const isTakeaway = /要点|总结|关键|takeaway|核心/i.test(title);
          if (isTakeaway) {
            return (
              <aside key={i} className="key-takeaway">
                <div className="key-takeaway-head">
                  <span className="key-takeaway-icon" aria-hidden>
                    ✦
                  </span>
                  <strong>{title}</strong>
                </div>
                {body ? <p>{body}</p> : null}
              </aside>
            );
          }
          return (
            <section key={i} className="capsule-section">
              <h4>{title}</h4>
              {body ? <p>{body}</p> : null}
            </section>
          );
        }
        return (
          <p key={i} className="capsule-para">
            {text}
          </p>
        );
      })}
    </div>
  );
}

/** `practice` accepts a legacy plain string (implicitly a required text
 * prompt) or a structured `{prompt, input_type?, required?}` object. */
function normalizePractice(practice: Capsule["practice"]): CapsulePracticeSpec | null {
  if (!practice) return null;
  if (typeof practice === "string") {
    const trimmed = practice.trim();
    return trimmed ? { prompt: trimmed, input_type: "text", required: true } : null;
  }
  if (typeof practice === "object" && practice.prompt) {
    return { prompt: practice.prompt, input_type: practice.input_type || "text", required: Boolean(practice.required) };
  }
  return null;
}

function checklistItems(spec: CapsulePracticeSpec): string[] {
  return spec.prompt
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

interface PracticeState {
  text: string;
  status: "draft" | "submitted";
  checked: Set<number>;
  dirty: boolean;
  saving: boolean;
}

function emptyPracticeState(): PracticeState {
  return { text: "", status: "draft", checked: new Set(), dirty: false, saving: false };
}

function PracticeBlock({
  capsuleId,
  spec,
  state,
  disabled,
  onTextChange,
  onTextBlur,
  onToggleCheck,
  onSubmit,
  onReopen,
}: {
  capsuleId: string;
  spec: CapsulePracticeSpec;
  state: PracticeState;
  disabled: boolean;
  onTextChange: (v: string) => void;
  onTextBlur: () => void;
  onToggleCheck: (idx: number) => void;
  onSubmit: () => void;
  onReopen: () => void;
}) {
  const submitted = state.status === "submitted";
  const items = spec.input_type === "checklist" ? checklistItems(spec) : [];
  const allChecked = items.length > 0 && items.every((_, i) => state.checked.has(i));
  const canSubmit = spec.input_type === "checklist" ? (spec.required ? allChecked : true) : state.text.trim().length > 0;

  return (
    <aside className="learn-practice">
      <h4>
        练习{spec.required ? "（必做）" : "（选做）"}
        {submitted && <span className="learn-practice-badge">已提交</span>}
      </h4>
      {spec.input_type === "checklist" ? (
        <ul className="learn-practice-checklist">
          {items.map((item, i) => (
            <li key={i}>
              <label>
                <input
                  type="checkbox"
                  checked={state.checked.has(i)}
                  disabled={disabled || submitted}
                  onChange={() => onToggleCheck(i)}
                />
                {item}
              </label>
            </li>
          ))}
        </ul>
      ) : (
        <>
          <p className="muted">{spec.prompt}</p>
          <textarea
            id={`practice-${capsuleId}`}
            className="practice-no-clipboard"
            rows={4}
            value={state.text}
            placeholder="写下你的练习答案…"
            disabled={disabled || submitted}
            onChange={(e) => onTextChange(e.target.value)}
            onBlur={onTextBlur}
            {...blockPracticeClipboard<HTMLTextAreaElement>()}
          />
        </>
      )}
      <div className="row learn-practice-actions">
        {submitted ? (
          <button type="button" onClick={onReopen} disabled={disabled}>
            重新编辑
          </button>
        ) : (
          <button type="button" className="btn-primary" disabled={disabled || !canSubmit} onClick={onSubmit}>
            {state.saving ? "保存中…" : "提交练习"}
          </button>
        )}
        {!submitted && state.dirty && !state.saving && <span className="muted num">草稿自动保存中…</span>}
      </div>
    </aside>
  );
}

function ResourcesTab({ day, resources }: { day: DayPackage; resources: DayResource[] }) {
  if (!resources.length) {
    return (
      <div className="learn-tab-panel">
        <ToolsPanel day={day} />
        <p className="muted">本节暂无额外资源。</p>
      </div>
    );
  }
  return (
    <div className="learn-tab-panel">
      <ul className="learn-resource-list">
        {resources.map((r) => (
          <li key={r.id} className="learn-resource-item">
            <div>
              <strong>{r.title}</strong>
              {r.summary && <p className="muted">{r.summary}</p>}
            </div>
            {r.url ? (
              <a href={r.url} target="_blank" rel="noreferrer">
                打开
              </a>
            ) : (
              <span className="muted">{r.kind || "资料"}</span>
            )}
          </li>
        ))}
      </ul>
      <ToolsPanel day={day} />
    </div>
  );
}

export function CapsuleReader({
  day,
  node,
  onCompleted,
  locked,
  openCapsuleId,
  onOpenCapsuleIdChange,
  onReadChange,
}: {
  day: DayPackage;
  node: NodeState;
  onCompleted: (result?: NodeCompleteResult) => void;
  locked?: boolean;
  openCapsuleId?: string | null;
  onOpenCapsuleIdChange?: (id: string) => void;
  onReadChange?: (read: Set<string>) => void;
}) {
  const { user, campId } = useAuth();
  const toast = useToast();
  const capsules: Capsule[] = useMemo(() => {
    const fromRefs = (node.refs?.capsules as Capsule[]) || [];
    const fromLearn = day.learn?.capsules || [];
    return (fromRefs.length ? fromRefs : fromLearn).map((c, i) => ({
      ...c,
      id: c.id || `c${i + 1}`,
    }));
  }, [day, node]);

  const practiceSpecs = useMemo(() => {
    const map: Record<string, CapsulePracticeSpec> = {};
    for (const c of capsules) {
      const spec = normalizePractice(c.practice);
      if (spec) map[c.id] = spec;
    }
    return map;
  }, [capsules]);

  const requireAll = Boolean(node.refs?.require_capsules ?? day.learn?.require_capsules);
  const [internalOpenId, setInternalOpenId] = useState<string | null>(null);
  const [read, setRead] = useState<Set<string>>(new Set());
  const [practice, setPractice] = useState<Record<string, PracticeState>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<LearnTab>("notes");
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const saveSeq = useRef<Record<string, number>>({});
  const practiceRef = useRef(practice);
  practiceRef.current = practice;

  const openId = openCapsuleId !== undefined ? openCapsuleId : internalOpenId;

  const resources = useMemo(() => {
    const cap = capsules.find((c) => c.id === openId) || capsules[0];
    if (!cap) return day.resources || [];
    return resolveCapsuleResources(cap, day.resources || []);
  }, [capsules, openId, day.resources]);

  const setReadAndNotify = (next: Set<string> | ((prev: Set<string>) => Set<string>)) => {
    setRead((prev) => {
      const value = typeof next === "function" ? next(prev) : next;
      onReadChange?.(value);
      return value;
    });
  };

  const openCapsule = (c: Capsule) => {
    if (onOpenCapsuleIdChange) onOpenCapsuleIdChange(c.id);
    else setInternalOpenId(c.id);
    setReadAndNotify((prev) => (prev.has(c.id) ? prev : new Set(prev).add(c.id)));
    setTab("notes");
    if (!user || !campId) return;
    void capsuleApi
      .markOpened({ camp_id: campId, day: day.day, capsule_id: c.id, learner_id: user.id })
      .catch((err) => {
        if (err instanceof ApiError && err.status !== 404) {
          toast.push(`胶囊进度同步失败：${err.message}`, "error");
        }
      });
  };

  // External TOC click → open without resetting tab unnecessarily when same id
  useEffect(() => {
    if (openCapsuleId == null) return;
    const c = capsules.find((x) => x.id === openCapsuleId);
    if (!c) return;
    setReadAndNotify((prev) => (prev.has(c.id) ? prev : new Set(prev).add(c.id)));
    if (!user || !campId) return;
    void capsuleApi
      .markOpened({ camp_id: campId, day: day.day, capsule_id: c.id, learner_id: user.id })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openCapsuleId]);

  useEffect(() => {
    let cancelled = false;
    Object.values(saveTimers.current).forEach(clearTimeout);
    saveTimers.current = {};
    setError(null);
    setInternalOpenId(null);
    setReadAndNotify(new Set());
    setPractice({});
    setTab("notes");

    (async () => {
      if (!user || !campId) {
        if (capsules[0]) openCapsule(capsules[0]);
        return;
      }
      let openedIds = new Set<string>();
      const pmap: Record<string, PracticeState> = {};
      try {
        const progressRes = await capsuleApi.list({ camp_id: campId, day: day.day });
        openedIds = new Set(progressRes.items.map((it) => it.capsule_id));
      } catch {
        // degrade gracefully
      }
      try {
        const practiceRes = await practiceApi.list({ camp_id: campId, day: day.day });
        for (const it of practiceRes.items) {
          const checked = new Set<number>();
          const rawChecked = (it.response_json as { checked?: number[] } | undefined)?.checked;
          if (Array.isArray(rawChecked)) rawChecked.forEach((i) => checked.add(Number(i)));
          pmap[it.capsule_id] = {
            text: it.response_text || "",
            status: it.status === "submitted" ? "submitted" : "draft",
            checked,
            dirty: false,
            saving: false,
          };
        }
      } catch {
        // degrade gracefully
      }
      if (cancelled) return;
      setReadAndNotify(openedIds);
      setPractice(pmap);
      if (capsules.length) {
        const preferred =
          (openCapsuleId && capsules.find((c) => c.id === openCapsuleId)) ||
          capsules.find((c) => !openedIds.has(c.id)) ||
          capsules[0];
        openCapsule(preferred);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day.day, node.id, campId, user?.id]);

  const persistPractice = async (
    capsuleId: string,
    patch: { text?: string; checked?: Set<number> },
    status: "draft" | "submitted",
    opts?: { reopen?: boolean },
  ) => {
    if (!user || !campId) return;
    const prevState = practiceRef.current[capsuleId] || emptyPracticeState();
    if (status === "draft" && prevState.status === "submitted" && !opts?.reopen) {
      return;
    }
    const text = patch.text ?? prevState.text;
    const checked = patch.checked ?? prevState.checked;
    const spec = practiceSpecs[capsuleId];
    const isChecklist = spec?.input_type === "checklist";
    const responseText = isChecklist
      ? checklistItems(spec).filter((_, i) => checked.has(i)).join("\n")
      : text;
    const seq = (saveSeq.current[capsuleId] = (saveSeq.current[capsuleId] || 0) + 1);
    setPractice((prev) => ({ ...prev, [capsuleId]: { ...(prev[capsuleId] || prevState), text, checked, saving: true } }));
    try {
      const res = await practiceApi.save({
        camp_id: campId,
        day: day.day,
        capsule_id: capsuleId,
        response_text: responseText,
        response_json: isChecklist ? { checked: Array.from(checked) } : {},
        status,
        force_reopen: Boolean(opts?.reopen),
      });
      if (saveSeq.current[capsuleId] !== seq) return;
      setPractice((prev) => {
        const cur = prev[capsuleId];
        if (status === "draft" && cur?.status === "submitted" && !opts?.reopen) return prev;
        return {
          ...prev,
          [capsuleId]: {
            text,
            checked,
            status: res.status === "submitted" ? "submitted" : "draft",
            dirty: false,
            saving: false,
          },
        };
      });
    } catch (err) {
      if (saveSeq.current[capsuleId] === seq) {
        setPractice((prev) => ({ ...prev, [capsuleId]: { ...(prev[capsuleId] || prevState), text, checked, saving: false } }));
      }
      toast.push(err instanceof ApiError ? `练习保存失败：${err.message}` : "练习保存失败", "error");
      throw err;
    }
  };

  const onPracticeTextChange = (capsuleId: string, text: string) => {
    setPractice((prev) => ({ ...prev, [capsuleId]: { ...(prev[capsuleId] || emptyPracticeState()), text, dirty: true } }));
    if (!user || !campId) return;
    clearTimeout(saveTimers.current[capsuleId]);
    saveTimers.current[capsuleId] = setTimeout(() => {
      void persistPractice(capsuleId, { text }, "draft");
    }, 1200);
  };

  const onPracticeTextBlur = (capsuleId: string) => {
    clearTimeout(saveTimers.current[capsuleId]);
    const st = practice[capsuleId];
    if (st?.dirty) void persistPractice(capsuleId, { text: st.text }, "draft");
  };

  const onPracticeToggleCheck = (capsuleId: string, idx: number) => {
    const prevState = practice[capsuleId] || emptyPracticeState();
    const checked = new Set(prevState.checked);
    if (checked.has(idx)) checked.delete(idx);
    else checked.add(idx);
    setPractice((prev) => ({ ...prev, [capsuleId]: { ...prevState, checked, dirty: true } }));
    void persistPractice(capsuleId, { checked }, "draft");
  };

  const submitPractice = async (capsuleId: string) => {
    clearTimeout(saveTimers.current[capsuleId]);
    try {
      await persistPractice(capsuleId, {}, "submitted");
      toast.push("练习已提交", "success");
    } catch {
      // toast already shown
    }
  };

  const reopenPractice = (capsuleId: string) => {
    void persistPractice(capsuleId, {}, "draft", { reopen: true });
  };

  const complete = async () => {
    if (locked) return;
    if (requireAll && capsules.length && read.size < capsules.length) {
      toast.push(`请先点完左侧全部 ${capsules.length} 个章节`, "error");
      return;
    }
    const pending = capsules.filter((c) => practiceSpecs[c.id]?.required && practice[c.id]?.status !== "submitted");
    if (pending.length) {
      toast.push(`请先提交必做练习：还差 ${pending.length} 个`, "error");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await dayApi.completeNode(node.id, { camp_id: campId || day.camp_id, day: day.day });
      toast.push("学习节点已完成", "success");
      onCompleted(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "完成失败");
    } finally {
      setBusy(false);
    }
  };

  const active = capsules.find((c) => c.id === openId) || capsules[0];
  const activeIndex = active ? capsules.findIndex((c) => c.id === active.id) : -1;
  const activeSpec = active ? practiceSpecs[active.id] : undefined;
  const activePractice = active ? practice[active.id] || emptyPracticeState() : emptyPracticeState();
  const pendingPracticeCount = capsules.filter(
    (c) => practiceSpecs[c.id]?.required && practice[c.id]?.status !== "submitted",
  ).length;

  const goPrev = () => {
    if (activeIndex > 0) openCapsule(capsules[activeIndex - 1]);
  };
  const goNext = () => {
    if (activeIndex >= 0 && activeIndex < capsules.length - 1) openCapsule(capsules[activeIndex + 1]);
  };

  if (!capsules.length) {
    return (
      <Empty
        title="本日无知识胶囊"
        description="可直接标记学习完成（若节点已解锁）。"
        actionLabel={locked ? undefined : "完成学习"}
        onAction={locked ? undefined : () => void complete()}
      />
    );
  }

  return (
    <div className="learn-shell">
      <main className="learn-content" aria-live="polite">
        {active ? (
          <article className="learn-article">
            <CapsuleMediaStack items={active.media} campId={campId} />

            <header className="learn-article-head">
              <h3>{active.title}</h3>
              <div className="learn-article-meta">
                {active.minutes != null && <span className="muted">建议用时 {active.minutes} 分钟</span>}
                <span className="muted num">
                  第 {activeIndex + 1} / {capsules.length} 节
                </span>
                {pendingPracticeCount > 0 && (
                  <span className="muted">还需提交 {pendingPracticeCount} 个必做练习</span>
                )}
              </div>
            </header>

            <div className="learn-tabs" role="tablist">
              {(
                [
                  ["notes", "课节讲义"],
                  ["resources", `资源 (${resources.length})`],
                  ...(active.local_prep?.codex_prompt || (active.local_prep?.checklist || []).length
                    ? ([["local_prep", "本地实操"]] as const)
                    : []),
                  ["practice", activeSpec ? "练习" : "练习"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  className={`learn-tab ${tab === id ? "is-active" : ""}`}
                  aria-selected={tab === id}
                  onClick={() => setTab(id)}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="learn-tab-panel" role="tabpanel">
              {tab === "notes" && <CapsuleProse content={active.content || "（本节暂无正文）"} />}
              {tab === "resources" && <ResourcesTab day={day} resources={resources} />}
              {tab === "local_prep" && active.local_prep && (
                <LocalPrepPanel
                  day={day}
                  capsuleId={active.id}
                  prep={active.local_prep}
                  resources={day.resources || []}
                  disabled={locked || busy}
                />
              )}
              {tab === "practice" &&
                (activeSpec ? (
                  <>
                    <PracticeBlock
                      capsuleId={active.id}
                      spec={activeSpec}
                      state={activePractice}
                      disabled={Boolean(locked) || !user || !campId}
                      onTextChange={(v) => onPracticeTextChange(active.id, v)}
                      onTextBlur={() => onPracticeTextBlur(active.id)}
                      onToggleCheck={(idx) => onPracticeToggleCheck(active.id, idx)}
                      onSubmit={() => void submitPractice(active.id)}
                      onReopen={() => reopenPractice(active.id)}
                    />
                    {(active.quiz?.questions || []).length > 0 && (
                      <aside className="learn-practice" style={{ marginTop: 16 }}>
                        <h4>节测验</h4>
                        <ol>
                          {(active.quiz?.questions || []).map((q, i) => (
                            <li key={i}>{q.q}</li>
                          ))}
                        </ol>
                      </aside>
                    )}
                  </>
                ) : (active.quiz?.questions || []).length > 0 ? (
                  <aside className="learn-practice">
                    <h4>节测验</h4>
                    <ol>
                      {(active.quiz?.questions || []).map((q, i) => (
                        <li key={i}>{q.q}</li>
                      ))}
                    </ol>
                  </aside>
                ) : (
                  <p className="muted">本节暂无练习。</p>
                ))}
            </div>

            <footer className="learn-pager">
              <button type="button" disabled={activeIndex <= 0} onClick={goPrev}>
                上一节
              </button>
              <div className="learn-pager-center">
                <button
                  type="button"
                  className="btn-primary"
                  disabled={busy || locked || node.status === "passed"}
                  onClick={() => void complete()}
                >
                  {node.status === "passed" ? "已完成" : busy ? "提交中…" : "完成学习"}
                </button>
              </div>
              <button
                type="button"
                className={activeIndex < capsules.length - 1 ? "btn-primary" : undefined}
                disabled={activeIndex < 0 || activeIndex >= capsules.length - 1}
                onClick={goNext}
              >
                下一节
              </button>
            </footer>
          </article>
        ) : (
          <Empty title="选择左侧章节" description="点击大纲开始学习" />
        )}

        {error && <ErrorState title="操作失败" message={error} onRetry={() => void complete()} />}
      </main>
    </div>
  );
}
