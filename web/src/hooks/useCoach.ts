import { useCallback, useEffect, useState } from "react";
import { coachApi, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import type { CoachChatMessage } from "../components/coach/coachChatTypes";
import type { CoachDiagnostics, DayPackage, MentorReview, NodeState } from "../lib/types";

let msgSeq = 0;
function nextId() {
  msgSeq += 1;
  return `coach-msg-${msgSeq}`;
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
}

/**
 * Coach ask/diagnose/handoff — multi-turn chat state for CoachChatPanel.
 */
export function useCoach(day: DayPackage | null, node?: NodeState | null): UseCoachResult {
  const { user, campId } = useAuth();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<CoachChatMessage[]>([]);
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

  const ask = useCallback(async (overrideQuestion?: string) => {
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

    setMessages((prev) => [
      ...prev,
      { id: userMsgId, role: "user", text: q },
      { id: botMsgId, role: "assistant", text: "", streaming: true, citations: [] },
    ]);

    try {
      const steps = day?.learn?.steps || (day?.learn?.capsules || []).map((c) => c.title).filter(Boolean);
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
          if (meta.citations) {
            setCitations(meta.citations);
            setMessages((prev) =>
              prev.map((m) => (m.id === botMsgId ? { ...m, citations: meta.citations } : m)),
            );
          }
        },
        onDelta: (text) => {
          setReply((prev) => (prev || "") + text);
          setMessages((prev) =>
            prev.map((m) =>
              m.id === botMsgId ? { ...m, text: (m.text || "") + text, streaming: true } : m,
            ),
          );
        },
        onDone: (done) => {
          setReply(done.reply);
          setLevel(done.level);
          setMode(done.coach_mode);
          const cites = done.citations || [];
          setCitations(cites);
          setDiagnostics(done.diagnostics || null);
          setMessages((prev) =>
            prev.map((m) =>
              m.id === botMsgId
                ? { ...m, text: done.reply, streaming: false, citations: cites }
                : m,
            ),
          );
        },
      });
      setFailCount((n) => n + 1);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "提问失败");
      setMessages((prev) => prev.filter((m) => m.id !== botMsgId));
    } finally {
      setBusy(false);
    }
  }, [input, busy, day, node, user, campId, coachCfg, failCount]);

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

  const reset = useCallback(() => {
    setInput("");
    setMessages([]);
    setReply(null);
    setLevel(null);
    setMode(null);
    setCitations([]);
    setDiagnostics(null);
    setError(null);
    setHandoffMsg(null);
  }, []);

  const showMentorCta = diagnostics?.next_action === "ask_mentor" || (diagnostics?.fail_count ?? 0) >= 3;

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
  };
}
