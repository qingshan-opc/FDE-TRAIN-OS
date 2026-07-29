import { useEffect, useMemo, useRef, useState } from "react";
import { capsuleApi, practiceApi, dayApi, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useToast } from "../components/Toast";
import type {
  Capsule,
  CapsulePracticeSpec,
  CapsuleTool,
  DayPackage,
  DayResource,
  NodeCompleteResult,
  NodeState,
} from "../lib/types";
import { resolveCapsuleResources } from "../lib/curriculum/capsuleResources";
import {
  checklistItemsFromPrompt,
  normalizePractice,
  normalizeQuizQuestions,
} from "../lib/curriculum/normalizeCapsule";
import { ErrorState } from "../components/ErrorState";
import { Empty } from "../components/Empty";
import { CapsuleMediaStack } from "../components/CapsuleMedia";
import { LocalPrepPanel } from "../components/learn/LocalPrepPanel";
import { CapsuleSimTerminal, type CapsuleSimConfig } from "../components/learn/CapsuleSimTerminal";
import { GlossaryTermsPanel, KnowledgeCardsStep } from "../components/learn/KnowledgeCardsStep";
import { blockPracticeClipboard } from "../lib/practiceClipboard";

type LearnStep = "video" | "cards" | "quiz" | "lab" | "local_prep" | "submit";

const STEP_LABELS: Record<LearnStep, string> = {
  video: "视频讲解",
  cards: "知识卡片",
  quiz: "知识确认",
  lab: "实验",
  local_prep: "本地实操",
  submit: "提交验收",
};

/** 步骤条文案按课节内容动态生成。 */
function stepLabel(id: LearnStep, cap: Capsule | undefined): string {
  if (id === "video") return (cap?.media || []).length ? "课件讲解员" : "课件讲解";
  return STEP_LABELS[id];
}

function learnUiStorageKey(userId: string, campId: string, day: number): string {
  return `fde.learn.ui.${userId}.${campId}.${day}`;
}

type CapsuleUiState = {
  visited: LearnStep[];
  quizAnswers: Record<number, number>;
};

function loadLearnUiState(userId: string, campId: string, day: number): Record<string, CapsuleUiState> {
  try {
    const raw = localStorage.getItem(learnUiStorageKey(userId, campId, day));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, CapsuleUiState>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveLearnUiState(userId: string, campId: string, day: number, state: Record<string, CapsuleUiState>) {
  try {
    localStorage.setItem(learnUiStorageKey(userId, campId, day), JSON.stringify(state));
  } catch {
    // ignore quota / private mode
  }
}

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

function checklistItems(spec: CapsulePracticeSpec): string[] {
  return checklistItemsFromPrompt(spec.prompt);
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

/** 知识确认：可点击判分的交互选择题（纯前端，不存成绩）。 */
function StepQuiz({
  questions,
  answers,
  onAnswer,
}: {
  questions: Array<{ q: string; options: string[]; answer?: number; explain?: string }>;
  answers: Record<number, number>;
  onAnswer: (qIdx: number, optIdx: number) => void;
}) {
  const correctCount = questions.filter((q, i) => q.answer != null && answers[i] === q.answer).length;
  return (
    <div className="step-quiz">
      <p className="step-quiz-score muted">
        已答对 {correctCount} / {questions.length} 题 · 点选即判分，答错可重选
      </p>
      {questions.map((q, qi) => {
        const selected = answers[qi];
        const answered = selected !== undefined;
        return (
          <section className="step-quiz-q" key={qi}>
            <p className="step-quiz-question">
              <span className="step-quiz-no num">Q{qi + 1}</span>
              {q.q}
            </p>
            <div className="step-quiz-options">
              {q.options.map((opt, oi) => {
                const isAnswer = q.answer === oi;
                const cls = !answered ? "" : isAnswer ? "is-correct" : selected === oi ? "is-wrong" : "is-dim";
                return (
                  <button
                    key={oi}
                    type="button"
                    className={`step-quiz-option ${cls}`}
                    onClick={() => onAnswer(qi, oi)}
                  >
                    <span className="step-quiz-badge">{answered && isAnswer ? "✓" : answered && selected === oi ? "✕" : String.fromCharCode(65 + oi)}</span>
                    {opt}
                  </button>
                );
              })}
            </div>
            {answered && q.explain ? (
              <p className={`step-quiz-explain ${selected === q.answer ? "is-right" : "is-retry"}`}>
                {selected === q.answer ? "✓ 答对了。" : "再想想——"}
                {q.explain}
              </p>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}

type LearnBelowTab = "glossary" | "resources" | "tools";

/**
 * 课节视频底部：名词解释 / 资源 / 工具与资料 三 tab。
 */
function LearnBelowTabs({
  glossary,
  resources,
  tools,
}: {
  glossary: NonNullable<Capsule["glossary_terms"]>;
  resources: DayResource[];
  tools: CapsuleTool[];
}) {
  const defaultTab: LearnBelowTab = glossary.length
    ? "glossary"
    : resources.length
      ? "resources"
      : "tools";
  const [tab, setTab] = useState<LearnBelowTab>(defaultTab);

  useEffect(() => {
    setTab(defaultTab);
  }, [defaultTab]);

  if (!glossary.length && !resources.length && !tools.length) return null;

  return (
    <section className="learn-assets" aria-label="名词解释与资源">
      <div className="learn-assets-tabs" role="tablist">
        {glossary.length > 0 && (
          <button
            type="button"
            role="tab"
            aria-selected={tab === "glossary"}
            className={`learn-assets-tab${tab === "glossary" ? " is-on" : ""}`}
            onClick={() => setTab("glossary")}
          >
            名词解释{` (${glossary.length})`}
          </button>
        )}
        <button
          type="button"
          role="tab"
          aria-selected={tab === "resources"}
          className={`learn-assets-tab${tab === "resources" ? " is-on" : ""}`}
          onClick={() => setTab("resources")}
        >
          资源{resources.length ? ` (${resources.length})` : ""}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "tools"}
          className={`learn-assets-tab${tab === "tools" ? " is-on" : ""}`}
          onClick={() => setTab("tools")}
        >
          工具与资料{tools.length ? ` (${tools.length})` : ""}
        </button>
      </div>
      {tab === "glossary" && glossary.length > 0 && (
        <div role="tabpanel">
          <GlossaryTermsPanel terms={glossary} embedded />
        </div>
      )}
      {tab === "resources" &&
        (resources.length ? (
          <ul className="learn-resource-list" role="tabpanel">
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
        ) : (
          <p className="muted learn-assets-empty">本节暂无资源。</p>
        ))}
      {tab === "tools" &&
        (tools.length ? (
          <ul className="learn-tool-list" role="tabpanel">
            {tools.map((t, i) => (
              <li key={`${t.name}-${i}`} className="learn-tool-item">
                <div>
                  <strong>{t.name}</strong>
                  {t.note && <p className="muted">{t.note}</p>}
                </div>
                {t.url && (
                  <a href={t.url} target="_blank" rel="noreferrer">
                    打开
                  </a>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted learn-assets-empty">本节暂无固定工具与资料。</p>
        ))}
    </section>
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
  const [step, setStep] = useState<LearnStep>("video");
  const [quizAnswers, setQuizAnswers] = useState<Record<string, Record<number, number>>>({});
  /** Per-capsule visited steps — drives STEP ✓ tied to this learner. */
  const [visitedSteps, setVisitedSteps] = useState<Record<string, Set<LearnStep>>>({});
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const saveSeq = useRef<Record<string, number>>({});
  const practiceRef = useRef(practice);
  practiceRef.current = practice;
  const uiPersistRef = useRef<Record<string, CapsuleUiState>>({});

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
    setStep("video");
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
    setQuizAnswers({});
    setVisitedSteps({});
    setStep("video");

    (async () => {
      if (!user || !campId) {
        if (capsules[0]) openCapsule(capsules[0]);
        return;
      }

      const stored = loadLearnUiState(user.id, campId, day.day);
      uiPersistRef.current = stored;
      const restoredAnswers: Record<string, Record<number, number>> = {};
      const restoredVisited: Record<string, Set<LearnStep>> = {};
      for (const [cid, row] of Object.entries(stored)) {
        if (row.quizAnswers && typeof row.quizAnswers === "object") {
          restoredAnswers[cid] = row.quizAnswers;
        }
        if (Array.isArray(row.visited)) {
          restoredVisited[cid] = new Set(row.visited.filter(Boolean) as LearnStep[]);
        }
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
          const raw = (it.response_json || {}) as { checked?: number[]; quiz_answers?: Record<string, number> };
          if (Array.isArray(raw.checked)) raw.checked.forEach((i) => checked.add(Number(i)));
          pmap[it.capsule_id] = {
            text: it.response_text || "",
            status: it.status === "submitted" ? "submitted" : "draft",
            checked,
            dirty: false,
            saving: false,
          };
          // Server-backed quiz answers win over local cache.
          if (raw.quiz_answers && typeof raw.quiz_answers === "object") {
            const mapped: Record<number, number> = {};
            for (const [k, v] of Object.entries(raw.quiz_answers)) {
              const qi = Number(k);
              if (Number.isFinite(qi) && typeof v === "number") mapped[qi] = v;
            }
            if (Object.keys(mapped).length) restoredAnswers[it.capsule_id] = mapped;
          }
        }
      } catch {
        // degrade gracefully
      }
      if (cancelled) return;
      setReadAndNotify(openedIds);
      setPractice(pmap);
      setQuizAnswers(restoredAnswers);
      setVisitedSteps(restoredVisited);
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

  const persistUiState = (
    capsuleId: string,
    patch: Partial<{ visited: Set<LearnStep>; quizAnswers: Record<number, number> }>,
  ) => {
    if (!user || !campId) return;
    const prev = uiPersistRef.current[capsuleId] || { visited: [], quizAnswers: {} };
    const next: CapsuleUiState = {
      visited: patch.visited ? Array.from(patch.visited) : prev.visited,
      quizAnswers: patch.quizAnswers ?? prev.quizAnswers,
    };
    uiPersistRef.current = { ...uiPersistRef.current, [capsuleId]: next };
    saveLearnUiState(user.id, campId, day.day, uiPersistRef.current);
  };

  const markStepVisited = (capsuleId: string, stepId: LearnStep) => {
    setVisitedSteps((prev) => {
      const cur = prev[capsuleId] || new Set<LearnStep>();
      if (cur.has(stepId)) return prev;
      const nextSet = new Set(cur).add(stepId);
      persistUiState(capsuleId, { visited: nextSet, quizAnswers: quizAnswers[capsuleId] || {} });
      return { ...prev, [capsuleId]: nextSet };
    });
  };

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
    const answers = quizAnswers[capsuleId] || {};
    const seq = (saveSeq.current[capsuleId] = (saveSeq.current[capsuleId] || 0) + 1);
    setPractice((prev) => ({ ...prev, [capsuleId]: { ...(prev[capsuleId] || prevState), text, checked, saving: true } }));
    try {
      const res = await practiceApi.save({
        camp_id: campId,
        day: day.day,
        capsule_id: capsuleId,
        response_text: responseText,
        response_json: {
          ...(isChecklist ? { checked: Array.from(checked) } : {}),
          quiz_answers: answers,
        },
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
      const names = pending
        .slice(0, 3)
        .map((c) => c.title || c.id)
        .join("、");
      toast.push(
        `本日还有 ${pending.length} 节必做练习未交${names ? `：${names}${pending.length > 3 ? "…" : ""}` : ""}`,
        "error",
      );
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
  /** Required practices across the whole learn node (all capsules today). */
  const pendingPracticeCapsules = capsules.filter(
    (c) => practiceSpecs[c.id]?.required && practice[c.id]?.status !== "submitted",
  );
  const pendingPracticeCount = pendingPracticeCapsules.length;
  const activePracticePending = Boolean(
    active && practiceSpecs[active.id]?.required && practice[active.id]?.status !== "submitted",
  );
  const nextPendingCapsule = pendingPracticeCapsules.find((c) => c.id !== active?.id) || pendingPracticeCapsules[0];

  // ---- 步流：课件讲解员 → 知识卡片 → 知识确认 → … → 提交验收（缺件自动隐藏） ----
  const quizQuestions = useMemo(() => normalizeQuizQuestions(active?.quiz), [active?.quiz]);
  const knowledgeCards = active?.knowledge_cards || [];
  const glossaryTerms = active?.glossary_terms || [];
  const quizAnswersForActive = (active && quizAnswers[active.id]) || {};
  // No questions ⇒ answered vacuously (practice-only knowledge-confirm step).
  const quizAllAnswered =
    quizQuestions.length === 0 || quizQuestions.every((_, i) => quizAnswersForActive[i] !== undefined);
  const practiceDone = !activeSpec?.required || activePractice.status === "submitted";
  const quizStepDone = quizAllAnswered && practiceDone;
  const visitedForActive = (active && visitedSteps[active.id]) || new Set<LearnStep>();

  const steps = useMemo(() => {
    if (!active) return [] as { id: LearnStep; minutes: number }[];
    const list: { id: LearnStep; minutes: number }[] = [];
    const dur = (active.media || []).find((m) => m.duration_sec)?.duration_sec;
    list.push({ id: "video", minutes: dur ? Math.max(1, Math.ceil(dur / 60)) : active.minutes || 5 });
    if (knowledgeCards.length > 0) list.push({ id: "cards", minutes: 3 });
    const qs = normalizeQuizQuestions(active.quiz);
    if (qs.length > 0 || activeSpec) list.push({ id: "quiz", minutes: 3 });
    // 课节内嵌实验（如 Day 5 第 3 节的终端实验台）：有 lab 配置才出现「实验」tab
    if (active.lab && (active.lab as { sim_kind?: string }).sim_kind) {
      list.push({ id: "lab", minutes: 10 });
    }
    if (active.local_prep?.codex_prompt || (active.local_prep?.checklist || []).length) {
      list.push({ id: "local_prep", minutes: 8 });
    }
    list.push({ id: "submit", minutes: 2 });
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id, active?.media, active?.knowledge_cards, active?.local_prep, active?.quiz, active?.lab, activeSpec]);

  const stepIds = steps.map((s) => s.id);
  const currentStepIdx = Math.max(0, stepIds.indexOf(step));
  const effectiveStep: LearnStep = stepIds.includes(step) ? step : "video";
  const nextStep = currentStepIdx < steps.length - 1 ? steps[currentStepIdx + 1] : null;

  // Tie STEP ✓ to learner progress (visited / quiz+practice / node passed), not "which tab is open".
  const isStepDone = (id: LearnStep): boolean => {
    if (id === "submit") return node.status === "passed";
    if (id === "quiz") return quizStepDone;
    if (node.status === "passed" || quizStepDone) return true;
    if (id === "video") {
      return (
        visitedForActive.has("video") ||
        visitedForActive.has("cards") ||
        visitedForActive.has("quiz") ||
        visitedForActive.has("lab") ||
        visitedForActive.has("local_prep") ||
        visitedForActive.has("submit")
      );
    }
    if (id === "cards") {
      return (
        visitedForActive.has("cards") ||
        visitedForActive.has("quiz") ||
        visitedForActive.has("lab") ||
        visitedForActive.has("local_prep") ||
        visitedForActive.has("submit")
      );
    }
    return visitedForActive.has(id);
  };

  useEffect(() => {
    if (!active) return;
    markStepVisited(active.id, effectiveStep);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id, effectiveStep]);

  const goStep = (id: LearnStep) => {
    setStep(id);
    if (active) markStepVisited(active.id, id);
  };
  const goNextStep = () => {
    if (!nextStep) return;
    if (active) markStepVisited(active.id, effectiveStep);
    setStep(nextStep.id);
  };

  const onQuizAnswer = (qIdx: number, optIdx: number) => {
    if (!active) return;
    setQuizAnswers((prev) => {
      const nextAnswers = { ...(prev[active.id] || {}), [qIdx]: optIdx };
      persistUiState(active.id, {
        visited: visitedSteps[active.id] || new Set<LearnStep>(["quiz"]),
        quizAnswers: nextAnswers,
      });
      return { ...prev, [active.id]: nextAnswers };
    });
    markStepVisited(active.id, "quiz");
  };

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
            <header className="learn-article-head">
              <h3>{active.title}</h3>
              <div className="learn-article-meta">
                {active.minutes != null && <span className="muted">建议用时 {active.minutes} 分钟</span>}
                <span className="muted num">
                  第 {activeIndex + 1} / {capsules.length} 节
                </span>
                {pendingPracticeCount > 0 && (
                  <span className="muted">
                    本日还有 {pendingPracticeCount} 节必做练习未交
                    {activePracticePending ? "（含本节）" : ""}
                  </span>
                )}
              </div>
            </header>

            <div className="learn-steps" role="tablist">
              {steps.map((s, idx) => {
                const done = isStepDone(s.id);
                const isActive = effectiveStep === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    className={`learn-step-card ${isActive ? "is-active" : ""} ${done ? "is-done" : ""}`}
                    onClick={() => goStep(s.id)}
                  >
                    <span className="learn-step-kicker num">
                      STEP 0{idx + 1} · {s.minutes}分钟
                    </span>
                    {done && (
                      <span className="learn-step-check" aria-hidden>
                        ✓
                      </span>
                    )}
                    <span className="learn-step-title">{stepLabel(s.id, active)}</span>
                  </button>
                );
              })}
            </div>

            <div
              className={`learn-step-panel${
                effectiveStep === "video" || effectiveStep === "cards" || effectiveStep === "lab"
                  ? " is-wide"
                  : ""
              }`}
              role="tabpanel"
            >
              {effectiveStep === "video" && (
                <div className="learn-video-stage">
                  <CapsuleMediaStack items={active.media} campId={campId} />
                  {!active.media?.length && (
                    <CapsuleProse content={active.content || "（本节暂无正文）"} />
                  )}
                  <div className="learn-video-below">
                    <LearnBelowTabs
                      glossary={glossaryTerms}
                      resources={resources}
                      tools={active.tools || []}
                    />
                  </div>
                </div>
              )}

              {effectiveStep === "cards" && <KnowledgeCardsStep cards={knowledgeCards} />}

              {effectiveStep === "quiz" && (
                <>
                  {quizQuestions.length > 0 && (
                    <StepQuiz questions={quizQuestions} answers={quizAnswersForActive} onAnswer={onQuizAnswer} />
                  )}
                  {activeSpec && (
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
                  )}
                </>
              )}

              {effectiveStep === "lab" && active.lab && (
                <CapsuleSimTerminal day={day.day} capsuleId={active.id} lab={active.lab as unknown as CapsuleSimConfig} />
              )}

              {effectiveStep === "local_prep" && active.local_prep && (
                <LocalPrepPanel
                  day={day}
                  capsuleId={active.id}
                  prep={active.local_prep}
                  resources={day.resources || []}
                  disabled={locked || busy}
                />
              )}

              {effectiveStep === "submit" && (
                <div className="learn-submit-panel">
                  <h4>提交前自查</h4>
                  <ul className="learn-submit-checks">
                    <li className={quizStepDone || !stepIds.includes("quiz") ? "is-ok" : ""}>
                      本节知识确认
                      {stepIds.includes("quiz") ? (quizStepDone ? "：已完成" : "：未完成") : "（无）"}
                    </li>
                    <li
                      className={
                        !stepIds.includes("local_prep") ||
                        currentStepIdx > stepIds.indexOf("local_prep") ||
                        node.status === "passed"
                          ? "is-ok"
                          : ""
                      }
                    >
                      本节本地实操{stepIds.includes("local_prep") ? "" : "（无）"}
                    </li>
                    <li className={!activePracticePending ? "is-ok" : ""}>
                      本节必做练习{!activeSpec?.required ? "（无）" : activePracticePending ? "：未提交" : "：已提交"}
                    </li>
                    <li className={pendingPracticeCount === 0 ? "is-ok" : ""}>
                      本日全部课节练习
                      {pendingPracticeCount === 0
                        ? `：${capsules.filter((c) => practiceSpecs[c.id]?.required).length || 0} 节均已提交`
                        : `：还差 ${pendingPracticeCount} 节`}
                    </li>
                  </ul>
                  {pendingPracticeCount > 0 ? (
                    <div className="learn-submit-pending">
                      <p className="muted">
                        学习节点要等<strong>本日每一节</strong>的必做练习都交齐才能验收（不是只交当前这一节）。
                        未交课节：
                      </p>
                      <ul className="learn-submit-pending-list">
                        {pendingPracticeCapsules.map((c) => {
                          const idx = capsules.findIndex((x) => x.id === c.id);
                          return (
                            <li key={c.id}>
                              <button type="button" className="linkish" onClick={() => openCapsule(c)}>
                                第 {idx + 1} 节 · {c.title || c.id}
                                {c.id === active?.id ? "（当前）" : ""}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ) : (
                    <p className="muted">
                      {node.status === "passed"
                        ? "本节点已完成，可继续后续内容。"
                        : "本日练习已齐，可以提交学习节点验收。"}
                    </p>
                  )}
                </div>
              )}

              <div className="learn-step-footer">
                <span className="muted learn-step-hint">
                  {effectiveStep === "video" &&
                    (knowledgeCards.length ? "看完课件后，去翻知识卡片" : "看完课件后进入下一步")}
                  {effectiveStep === "cards" && "点卡片看解释，能复述就算会了"}
                  {effectiveStep === "quiz" && (quizStepDone ? "已全部确认，可继续" : "全部作答并提交必做练习后可继续")}
                  {effectiveStep === "local_prep" && "在本地完成后返回平台提交"}
                  {effectiveStep === "submit" &&
                    (pendingPracticeCount > 0
                      ? "先去未交练习的课节完成提交"
                      : "确认无误后提交本日学习节点")}
                </span>
                {effectiveStep === "submit" ? (
                  pendingPracticeCount > 0 && nextPendingCapsule ? (
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() => {
                        if (nextPendingCapsule.id === active?.id) {
                          goStep("quiz");
                          return;
                        }
                        openCapsule(nextPendingCapsule);
                      }}
                    >
                      {nextPendingCapsule.id === active?.id
                        ? "回知识确认交练习"
                        : `去第 ${capsules.findIndex((c) => c.id === nextPendingCapsule.id) + 1} 节交练习`}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn-primary"
                      disabled={
                        busy ||
                        locked ||
                        node.status === "passed" ||
                        pendingPracticeCount > 0 ||
                        (stepIds.includes("quiz") && !quizStepDone)
                      }
                      onClick={() => void complete()}
                      title={
                        stepIds.includes("quiz") && !quizStepDone
                          ? "请先完成本节知识确认（答题 + 练习）"
                          : undefined
                      }
                    >
                      {node.status === "passed" ? "已完成" : busy ? "提交中…" : "我已完成，去提交"}
                    </button>
                  )
                ) : (
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={!nextStep || (effectiveStep === "quiz" && !quizStepDone)}
                    onClick={goNextStep}
                    title={
                      effectiveStep === "quiz" && !quizStepDone
                        ? quizQuestions.length && !quizAllAnswered
                          ? "请先答完全部确认题"
                          : "请先提交必做练习"
                        : undefined
                    }
                  >
                    {nextStep ? `下一步：${stepLabel(nextStep.id, active)}` : "下一步"}
                  </button>
                )}
              </div>
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
