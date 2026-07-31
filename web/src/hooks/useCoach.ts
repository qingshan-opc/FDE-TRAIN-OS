import { useCallback, useEffect, useMemo, useState } from "react";
import { coachApi, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import type { CoachChatMessage } from "../components/coach/coachChatTypes";
import type { CoachDiagnostics, DayPackage, MentorReview, NodeState } from "../lib/types";

const STORAGE_KEY = "fde-coach-sessions-v1";

let msgSeq = 0;
function nextId(prefix = "coach-msg") {
  msgSeq += 1;
  return `${prefix}-${Date.now()}-${msgSeq}`;
}

export type CoachSession = {
  id: string;
  title: string;
  updatedAt: number;
  messages: CoachChatMessage[];
};

function emptySession(): CoachSession {
  return {
    id: nextId("session"),
    title: "新对话",
    updatedAt: Date.now(),
    messages: [],
  };
}

function loadSessions(): { sessions: CoachSession[]; activeId: string } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const s = emptySession();
      return { sessions: [s], activeId: s.id };
    }
    const parsed = JSON.parse(raw) as { sessions?: CoachSession[]; activeId?: string };
    const sessions = Array.isArray(parsed.sessions) ? parsed.sessions : [];
    if (sessions.length === 0) {
      const s = emptySession();
      return { sessions: [s], activeId: s.id };
    }
    const activeId =
      parsed.activeId && sessions.some((s) => s.id === parsed.activeId)
        ? parsed.activeId
        : sessions[0].id;
    return { sessions, activeId };
  } catch {
    const s = emptySession();
    return { sessions: [s], activeId: s.id };
  }
}

function titleFromQuestion(q: string): string {
  const t = q.replace(/\s+/g, " ").trim();
  return t.length > 28 ? `${t.slice(0, 28)}…` : t || "新对话";
}

export interface UseCoachResult {
  input: string;
  setInput: (q: string) => void;
  messages: CoachChatMessage[];
  reply: string | null;
  level: number | null;
  mode: string | null;
  citations: { title?: string; id?: string }[];
  diagnostics: CoachDiagnostics | null;
  busy: boolean;
  error: string | null;
  failCount: number;
  ask: (overrideQuestion?: string) => Promise<void>;
  handoffBusy: boolean;
  handoffMsg: string | null;
  mentorReview: MentorReview | null;
  requestMentorReview: () => Promise<void>;
  showMentorCta: boolean;
  coachCfg: DayPackage["lab"]["coach"] | undefined;
  reset: () => void;
  sessions: CoachSession[];
  activeSessionId: string;
  sessionQuery: string;
  setSessionQuery: (q: string) => void;
  newSession: () => void;
  switchSession: (id: string) => void;
  deleteSession: (id: string) => void;
}

/**
 * Coach ask/diagnose/handoff — multi-turn chat with local session history.
 */
export function useCoach(day: DayPackage | null, node?: NodeState | null): UseCoachResult {
  const { user, campId } = useAuth();
  const initial = useMemo(() => loadSessions(), []);
  const [sessions, setSessions] = useState<CoachSession[]>(initial.sessions);
  const [activeSessionId, setActiveSessionId] = useState(initial.activeId);
  const [sessionQuery, setSessionQuery] = useState("");
  const [input, setInput] = useState("");
  const [reply, setReply] = useState<string | null>(null);
  const [level, setLevel] = useState<number | null>(null);
  const [mode, setMode] = useState<string | null>(null);
  const [citations, setCitations] = useState<{ title?: string; id?: string }[]>([]);
  const [diagnostics, setDiagnostics] = useState<CoachDiagnostics | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failCount, setFailCount] = useState(0);
  const [handoffBusy, setHandoffBusy] = useState(false);
  const [handoffMsg, setHandoffMsg] = useState<string | null>(null);
  const [mentorReview, setMentorReview] = useState<MentorReview | null>(null);

  const coachCfg = day?.lab?.coach;

  const messages = useMemo(
    () => sessions.find((s) => s.id === activeSessionId)?.messages ?? [],
    [sessions, activeSessionId],
  );

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ sessions, activeId: activeSessionId }));
    } catch {
      /* ignore quota */
    }
  }, [sessions, activeSessionId]);

  const patchActiveMessages = useCallback(
    (updater: (prev: CoachChatMessage[]) => CoachChatMessage[], titleHint?: string) => {
      setSessions((prev) =>
        prev.map((s) => {
          if (s.id !== activeSessionId) return s;
          const nextMessages = updater(s.messages);
          const shouldRetitle =
            Boolean(titleHint) && (s.title === "新对话" || s.messages.length === 0);
          return {
            ...s,
            messages: nextMessages,
            updatedAt: Date.now(),
            title: shouldRetitle && titleHint ? titleFromQuestion(titleHint) : s.title,
          };
        }),
      );
    },
    [activeSessionId],
  );

  const loadMentorReview = useCallback(async () => {
    if (!campId || !day?.day) return;
    try {
      const res = await coachApi.listMentorReviews({
        camp_id: campId,
        day: day.day,
        node_id: node?.id,
        limit: 1,
      });
      setMentorReview(res.items[0] ?? null);
    } catch {
      /* optional */
    }
  }, [campId, day?.day, node?.id]);

  useEffect(() => {
    void loadMentorReview();
  }, [loadMentorReview]);

  useEffect(() => {
    if (mentorReview?.status !== "pending") return;
    const timer = window.setInterval(() => {
      void loadMentorReview();
    }, 8000);
    return () => window.clearInterval(timer);
  }, [mentorReview?.status, loadMentorReview]);

  const ask = useCallback(
    async (overrideQuestion?: string) => {
      const q = (overrideQuestion ?? input).trim();
      if (!q || busy) return;

      const userMsgId = nextId();
      const botMsgId = nextId();

      setInput("");
      setBusy(true);
      setError(null);
      setReply("");
      setCitations([]);
      setDiagnostics(null);
      setHandoffMsg(null);

      patchActiveMessages(
        (prev) => [
          ...prev,
          { id: userMsgId, role: "user", text: q },
          { id: botMsgId, role: "assistant", text: "", streaming: true },
        ],
        q,
      );

      try {
        const steps =
          day?.learn?.steps || (day?.learn?.capsules || []).map((c) => c.title).filter(Boolean);
        const body = {
          question: q,
          camp_id: campId || undefined,
          day: day?.day ?? 1,
          node_id: node?.id,
          learner_id: user?.id,
          help_mode: coachCfg?.help_mode || ("explain" as const),
          fail_count: failCount,
          fallback_steps: steps,
          skill_id: coachCfg?.skill_id,
          max_help_level: coachCfg?.max_help_level,
        };

        await coachApi.askStream(body, {
          onMeta: (meta) => {
            if (typeof meta.level === "number") setLevel(meta.level);
          },
          onDelta: (text) => {
            setReply((prev) => (prev || "") + text);
            patchActiveMessages((prev) =>
              prev.map((m) =>
                m.id === botMsgId ? { ...m, text: (m.text || "") + text, streaming: true } : m,
              ),
            );
          },
          onDone: (done) => {
            setReply(done.reply);
            setLevel(done.level);
            setMode(done.coach_mode);
            setCitations([]);
            setDiagnostics(done.diagnostics || null);
            patchActiveMessages((prev) =>
              prev.map((m) =>
                m.id === botMsgId ? { ...m, text: done.reply, streaming: false } : m,
              ),
            );
          },
        });
        setFailCount((n) => n + 1);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "提问失败");
        patchActiveMessages((prev) => prev.filter((m) => m.id !== botMsgId));
      } finally {
        setBusy(false);
      }
    },
    [input, busy, day, node, user, campId, coachCfg, failCount, patchActiveMessages],
  );

  const requestMentorReview = useCallback(async () => {
    if (busy || handoffBusy) return;
    setHandoffBusy(true);
    setHandoffMsg(null);
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    try {
      const res = await coachApi.handoff({
        camp_id: campId || undefined,
        day: day?.day ?? 1,
        node_id: node?.id,
        question: (lastUser?.text || input).trim() || undefined,
      });
      setHandoffMsg(`已提交导师复核申请（编号 ${res.review_id.slice(0, 8)}），请等待导师处理。`);
      await loadMentorReview();
    } catch (err) {
      setHandoffMsg(err instanceof ApiError ? err.message : "申请失败，请稍后重试");
    } finally {
      setHandoffBusy(false);
    }
  }, [busy, handoffBusy, campId, day, node, input, messages, loadMentorReview]);

  const newSession = useCallback(() => {
    const s = emptySession();
    setSessions((prev) => [s, ...prev]);
    setActiveSessionId(s.id);
    setInput("");
    setReply(null);
    setLevel(null);
    setMode(null);
    setCitations([]);
    setDiagnostics(null);
    setError(null);
    setHandoffMsg(null);
  }, []);

  const switchSession = useCallback((id: string) => {
    setActiveSessionId(id);
    setInput("");
    setError(null);
    setHandoffMsg(null);
    setReply(null);
    setDiagnostics(null);
  }, []);

  const deleteSession = useCallback(
    (id: string) => {
      setSessions((prev) => {
        const next = prev.filter((s) => s.id !== id);
        if (next.length === 0) {
          const s = emptySession();
          setActiveSessionId(s.id);
          return [s];
        }
        if (id === activeSessionId) {
          setActiveSessionId(next[0].id);
        }
        return next;
      });
    },
    [activeSessionId],
  );

  const reset = useCallback(() => {
    patchActiveMessages(() => []);
    setInput("");
    setReply(null);
    setLevel(null);
    setMode(null);
    setCitations([]);
    setDiagnostics(null);
    setError(null);
    setHandoffMsg(null);
    setSessions((prev) =>
      prev.map((s) =>
        s.id === activeSessionId ? { ...s, title: "新对话", messages: [], updatedAt: Date.now() } : s,
      ),
    );
  }, [activeSessionId, patchActiveMessages]);

  const showMentorCta = diagnostics?.next_action === "ask_mentor" || (diagnostics?.fail_count ?? 0) >= 3;

  const sortedSessions = useMemo(
    () => [...sessions].sort((a, b) => b.updatedAt - a.updatedAt),
    [sessions],
  );

  return {
    input,
    setInput,
    messages,
    reply,
    level,
    mode,
    citations,
    diagnostics,
    busy,
    error,
    failCount,
    ask,
    handoffBusy,
    handoffMsg,
    mentorReview,
    requestMentorReview,
    showMentorCta,
    coachCfg,
    reset,
    sessions: sortedSessions,
    activeSessionId,
    sessionQuery,
    setSessionQuery,
    newSession,
    switchSession,
    deleteSession,
  };
}
