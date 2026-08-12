import { useEffect, useMemo, useRef, useState } from "react";
import { capsuleApi, practiceApi, dayApi, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useToast } from "../components/Toast";
import type {
  Capsule,
  KnowledgeCard,
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
import { GlossaryTermsPanel, KnowledgeConfirmationCards } from "../components/learn/KnowledgeCardsStep";
import { blockPracticeClipboard } from "../lib/practiceClipboard";
import { useLearnerSessionRequired } from "../lib/learnerSessionContext";

type LearnStep = "video" | "cards" | "quiz" | "lab" | "local_prep" | "submit";

const STEP_LABELS: Record<LearnStep, string> = {
  video: "视频讲解",
  cards: "知识卡片",
  quiz: "知识确认",
  lab: "实验",
  local_prep: "本地实操",
  submit: "提交验收",
};

/** Demo 规定的四步学习闭环。 */
function stepLabel(id: LearnStep, _cap: Capsule | undefined): string {
  if (id === "video") return "视频讲解";
  if (id === "quiz") return "知识确认";
  if (id === "local_prep") return "本地实操";
  if (id === "submit") return "提交验收";
  return STEP_LABELS[id];
}

function capsuleDeliverable(capsule: Capsule | undefined): string {
  for (const tool of capsule?.tools || []) {
    const match = tool.note?.match(/本节交付[：:]\s*(.+)$/);
    if (match?.[1]) return match[1].trim();
  }
  return capsule?.title ? `${capsule.title}实操证据` : "本节实操成果";
}

function compactKnowledgeTerm(value: string, fallback: string): string {
  const cleaned = value.replace(/[。！？?！]/g, "").trim();
  if (!cleaned) return fallback;
  return cleaned.length > 16 ? `${cleaned.slice(0, 16)}…` : cleaned;
}

function buildKnowledgePoints(
  capsule: Capsule | undefined,
  questions: Array<{ q: string; options: string[]; answer?: number; explain?: string }>,
): KnowledgeCard[] {
  const explicit = (capsule?.knowledge_cards || []).map((card, index) => ({
    ...card,
    id: card.id || `knowledge-explicit-${index + 1}`,
  }));
  const derived = questions.map((question, index) => {
    const correctOption = question.answer == null ? "" : question.options[question.answer] || "";
    return {
      id: `knowledge-quiz-${index + 1}`,
      term: compactKnowledgeTerm(correctOption, `关键判断 ${index + 1}`),
      plain: question.explain || `能用自己的话判断：${question.q}`,
      detail: `对应问题：${question.q}`,
    } satisfies KnowledgeCard;
  });
  const deliverable = capsuleDeliverable(capsule);
  const fallbacks: KnowledgeCard[] = [
    {
      id: "knowledge-deliverable",
      term: "用交付物验收",
      plain: `最终要用《${deliverable}》证明本节任务已经完成。`,
      detail: "交付物必须能被查看、操作或按清单验收。",
    },
    {
      id: "knowledge-goal",
      term: compactKnowledgeTerm(capsule?.title || "本节目标", "本节目标"),
      plain: `先说清本节要解决什么问题，再开始操作。`,
      detail: `本节主题：${capsule?.title || "完成当前课节"}`,
    },
    {
      id: "knowledge-boundary",
      term: "判断边界",
      plain: "AI 可以给出方案和产物，但是否通过仍由学员按标准判断。",
      detail: "先检查真实文件和实际效果，再决定通过或返工。",
    },
  ];

  const result: KnowledgeCard[] = [];
  for (const card of [...explicit, ...derived, ...fallbacks]) {
    if (result.some((item) => item.term === card.term)) continue;
    result.push(card);
    if (result.length === 3) break;
  }
  return result;
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
        本节验收清单{spec.required ? "（必做）" : "（选做）"}
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
            {state.saving ? "保存中…" : "提交并运行验收"}
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
  return (
    <div className="step-quiz step-quiz--judgement">
      {questions.map((q, qi) => {
        const selected = answers[qi];
        const answered = selected !== undefined;
        return (
          <section className="step-quiz-q knowledge-judgement" key={qi}>
            <p className="step-quiz-question">
              <span className="step-quiz-no">判断题</span>
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
        {resources.length > 0 && (
          <button
            type="button"
            role="tab"
            aria-selected={tab === "resources"}
            className={`learn-assets-tab${tab === "resources" ? " is-on" : ""}`}
            onClick={() => setTab("resources")}
          >
            资源{` (${resources.length})`}
          </button>
        )}
        {tools.length > 0 && (
          <button
            type="button"
            role="tab"
            aria-selected={tab === "tools"}
            className={`learn-assets-tab${tab === "tools" ? " is-on" : ""}`}
            onClick={() => setTab("tools")}
          >
            工具与资料{` (${tools.length})`}
          </button>
        )}
      </div>
      {tab === "glossary" && glossary.length > 0 && (
        <div role="tabpanel">
          <GlossaryTermsPanel terms={glossary} embedded />
        </div>
      )}
      {tab === "resources" && resources.length > 0 && (
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
      )}
      {tab === "tools" && tools.length > 0 && (
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
      )}
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
  const { setCoachOpen } = useLearnerSessionRequired();
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
    setRead(next);
  };

  useEffect(() => {
    onReadChange?.(read);
  }, [read, onReadChange]);

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
      toast.push("本节练习已提交。指挥验收需在工作区维护指挥日志并通过日级 Lab 机评。", "success");
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

  // ---- Demo 固定四步流：视频讲解 → 知识确认 → 本地实操 → 提交验收 ----
  const quizQuestions = useMemo(() => normalizeQuizQuestions(active?.quiz), [active?.quiz]);
  const confirmQuestions = quizQuestions.slice(0, 1);
  const knowledgeCards = useMemo(
    () => buildKnowledgePoints(active, quizQuestions),
    [active?.id, active?.knowledge_cards, active?.quiz],
  );
  const memorySentence = useMemo(
    () => active?.memory_sentence || `先抓住“${knowledgeCards[0]?.term || "本节目标"}”，再判断“${knowledgeCards[1]?.term || "关键边界"}”，最后用《${capsuleDeliverable(active)}》完成验收。`,
    [active?.id, active?.memory_sentence, active?.tools, knowledgeCards],
  );
  const glossaryTerms = active?.glossary_terms || [];
  const quizAnswersForActive = (active && quizAnswers[active.id]) || {};
  // No questions ⇒ answered vacuously (practice-only knowledge-confirm step).
  const quizAllAnswered =
    confirmQuestions.length === 0 || confirmQuestions.every((_, i) => quizAnswersForActive[i] !== undefined);
  const practiceDone = !activeSpec?.required || activePractice.status === "submitted";
  const quizStepDone = quizAllAnswered;
  const visitedForActive = (active && visitedSteps[active.id]) || new Set<LearnStep>();

  const steps = useMemo<Array<{ id: LearnStep; minutes: number }>>(() => {
    if (!active) return [] as { id: LearnStep; minutes: number }[];
    const dur = (active.media || []).find((m) => m.duration_sec)?.duration_sec;
    const total = Math.max(12, active.minutes || 20);
    const videoMinutes = dur ? Math.max(1, Math.ceil(dur / 60)) : Math.max(5, Math.round(total * 0.35));
    const confirmMinutes = Math.max(3, Math.round(total * 0.15));
    const submitMinutes = Math.max(2, Math.round(total * 0.15));
    const practiceMinutes = Math.max(5, total - videoMinutes - confirmMinutes - submitMinutes);
    const hasHandsOn = Boolean(
      active.lab ||
        active.local_prep ||
        (active.id && practiceSpecs[active.id]?.required),
    );
    const base: Array<{ id: LearnStep; minutes: number }> = [
      { id: "video", minutes: videoMinutes },
      { id: "quiz", minutes: confirmMinutes },
    ];
    if (hasHandsOn) base.push({ id: "local_prep", minutes: practiceMinutes });
    base.push({ id: "submit", minutes: submitMinutes });
    return base;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id, active?.minutes, active?.media, active?.lab, active?.local_prep, practiceSpecs]);

  const stepIds = steps.map((s) => s.id);
  const currentStepIdx = Math.max(0, stepIds.indexOf(step));
  const effectiveStep: LearnStep = stepIds.includes(step) ? step : "video";
  const nextStep = currentStepIdx < steps.length - 1 ? steps[currentStepIdx + 1] : null;

  // Tie STEP ✓ to learner progress (visited / quiz+practice / node passed), not "which tab is open".
  const isStepDone = (id: LearnStep): boolean => {
    if (id === "submit") return node.status === "passed" || practiceDone;
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
    if (id === "local_prep") return visitedForActive.has("submit") || visitedForActive.has("local_prep");
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

  useEffect(() => {
    const onOpenStep = (event: Event) => {
      const requested = (event as CustomEvent<LearnStep>).detail;
      if (steps.some((item) => item.id === requested)) goStep(requested);
    };
    window.addEventListener("fde:open-learn-step", onOpenStep);
    return () => window.removeEventListener("fde:open-learn-step", onOpenStep);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id, steps]);

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
              <div className="learn-article-heading-row">
                <div>
                  <p className="learn-article-eyebrow num">
                    D{day.day}-L{activeIndex + 1} · 当前课节
                  </p>
                  <h3>{active.title}</h3>
                </div>
                <button type="button" className="learn-mentor-btn" onClick={() => setCoachOpen(true)}>
                  ✦ AI任务导师
                </button>
              </div>
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

            <section className="learn-deliverable">
              <div>
                <small>本节必须交付</small>
                <strong>《{capsuleDeliverable(active)}》</strong>
              </div>
              <span>能力证据：AI 团队指挥与验收</span>
            </section>

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
                      第 {idx + 1} 步 · {s.minutes}分钟
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

            <div className="learn-step-panel is-wide" role="tabpanel">
              {effectiveStep === "video" && (
                <div className="learn-video-stage">
                  <div className="learn-panel-intro">
                    <h4>视频讲解：{active.title}</h4>
                    <p>先理解本节判断标准。视频与讲义中的要点会直接用于后面的知识确认和实操任务。</p>
                  </div>
                  <CapsuleMediaStack
                    key={active.id}
                    items={active.media}
                    campId={campId}
                  />
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

              {effectiveStep === "quiz" && (
                <>
                  <div className="learn-panel-intro">
                    <h4>知识确认：你是否抓住了三个关键判断</h4>
                    <p>卡片只提炼视频要点，不增加新概念。完成快速判断后，立即进入本地实操。</p>
                  </div>
                  <KnowledgeConfirmationCards
                    cards={knowledgeCards}
                    memorySentence={memorySentence}
                    deliverable={capsuleDeliverable(active)}
                  />
                  {confirmQuestions.length > 0 && (
                    <StepQuiz questions={confirmQuestions} answers={quizAnswersForActive} onAnswer={onQuizAnswer} />
                  )}
                </>
              )}

              {effectiveStep === "local_prep" && (
                <>
                  <div className="learn-panel-intro">
                    <h4>
                      {active.lab && (active.lab as { sim_kind?: string }).sim_kind
                        ? "仿真实验台"
                        : active.local_prep?.prompt_kind === "coach"
                          ? "用学习教练提示词巩固概念"
                          : active.local_prep?.codex_prompt?.trim()
                            ? "在开发工具中完成本节任务"
                            : "完成本节工具准备"}
                    </h4>
                    <p>
                      {active.lab && (active.lab as { sim_kind?: string }).sim_kind
                        ? "进入服务器后，在黑色终端窗口内直接输入命令，按 Enter 执行。"
                        : active.local_prep?.prompt_kind === "coach"
                          ? "本节提示词用于出题考你、审草稿或模拟评委——不要整段丢给编码 AI 当写代码任务。"
                          : active.local_prep?.codex_prompt?.trim()
                            ? "平台给你任务边界、岗位对象和验收标准；你指挥对应 AI 员工，检查真实文件后再决定批准或返工。"
                            : "按课程资源下载安装并逐项勾选；本节不需要向 AI 员工发送提示词。"}
                    </p>
                  </div>
                  {active.lab && (active.lab as { sim_kind?: string }).sim_kind ? (
                    <CapsuleSimTerminal day={day.day} capsuleId={active.id} lab={active.lab as unknown as CapsuleSimConfig} />
                  ) : active.local_prep ? (
                    <LocalPrepPanel
                      day={day}
                      capsuleId={active.id}
                      prep={active.local_prep}
                      resources={day.resources || []}
                      disabled={locked || busy}
                    />
                  ) : (
                    <div className="local-prep-panel">
                      <section className="local-prep-card">
                        <h4>本节实操任务</h4>
                        <p>{active.tools?.[0]?.note || capsuleDeliverable(active)}</p>
                        <p className="muted">任务提示词正在从课程源文件同步；可先打开课程资源查看完整实操说明。</p>
                      </section>
                    </div>
                  )}
                </>
              )}

              {effectiveStep === "submit" && (
                <div className="learn-submit-panel">
                  <div className="learn-panel-intro">
                    <h4>提交成果并运行验收</h4>
                    <p>完成不是自己点击确认，而是提交自检结果、保留真实证据，并明确交付处于 REVIEW 还是 APPROVED。</p>
                  </div>
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
                  <h4 className="learn-submit-selfcheck-title">提交前自查</h4>
                  <ul className="learn-submit-checks">
                    <li className={quizStepDone ? "is-ok" : ""}>
                      本节知识确认{quizStepDone ? "：已完成" : "：未完成"}
                    </li>
                    <li className={visitedForActive.has("local_prep") || visitedForActive.has("submit") ? "is-ok" : ""}>
                      本节开发工具实操：已进入任务并核对验收边界
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
                  {effectiveStep === "video" && "看完视频或讲义后进入知识确认"}
                  {effectiveStep === "quiz" &&
                    (quizStepDone
                      ? steps.some((s) => s.id === "local_prep")
                        ? "关键判断已确认，可以开始本地实操"
                        : "关键判断已确认，可以提交学习节点"
                      : "请先完成全部知识确认")}
                  {effectiveStep === "local_prep" &&
                    (active.local_prep?.codex_prompt?.trim()
                      ? "在开发工具中完成并检查真实文件后，返回平台提交验收"
                      : "完成安装与下载清单后，返回平台提交验收")}
                  {effectiveStep === "submit" &&
                    (pendingPracticeCount > 0
                      ? "先完成本节验收，再进入下一节"
                      : "确认无误后提交本日学习节点")}
                </span>
                {effectiveStep === "submit" ? (
                  activePracticePending ? (
                    <button type="button" className="btn-primary" disabled>
                      先完成本节验收清单
                    </button>
                  ) : pendingPracticeCount > 0 && nextPendingCapsule ? (
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() => openCapsule(nextPendingCapsule)}
                    >
                      {`进入第 ${capsules.findIndex((c) => c.id === nextPendingCapsule.id) + 1} 节`}
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
                        !quizStepDone
                      }
                      onClick={() => void complete()}
                      title={!quizStepDone ? "请先完成本节知识确认" : undefined}
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
                          : "请先完成知识确认"
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
                <span className="muted">完成四步并提交本节验收，才计入学习进度</span>
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
