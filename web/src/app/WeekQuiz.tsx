import { useEffect, useMemo, useState } from "react";
import { dayApi, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useToast } from "../components/Toast";
import { ErrorState } from "../components/ErrorState";
import { Skeleton } from "../components/Skeleton";
import type { DayPackage, NodeCompleteResult, QuizQuestion } from "../lib/types";
import { dayLabel } from "../lib/dayLabel";

type TaggedQuestion = QuizQuestion & { day: number; localIndex: number; nodeId: string };

const WEEK_CN: Record<number, string> = {
  1: "第一周",
  2: "第二周",
  3: "第三周",
  4: "第四周",
};

export function WeekQuiz({
  week,
  dayNums,
  onCompleted,
}: {
  week: number;
  dayNums: number[];
  onCompleted: (result?: NodeCompleteResult) => void;
}) {
  const { campId } = useAuth();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [packages, setPackages] = useState<DayPackage[]>([]);
  const [answers, setAnswers] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{
    pass: boolean;
    score: number;
    correct: number;
    total: number;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!campId) return;
      setLoading(true);
      setError(null);
      setResult(null);
      try {
        const pkgs = await Promise.all(dayNums.map((d) => dayApi.get(campId, d)));
        if (cancelled) return;
        setPackages(pkgs);
        const count = pkgs.reduce((n, p) => n + (p.quiz?.questions?.length || 0), 0);
        setAnswers(Array.from({ length: count }, () => -1));
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "周测加载失败");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [campId, dayNums.join(",")]);

  const questions: TaggedQuestion[] = useMemo(() => {
    const out: TaggedQuestion[] = [];
    for (const pkg of packages) {
      const quizNode = pkg.nodes.find((n) => n.kind === "quiz");
      const fromRefs = (quizNode?.refs?.questions as QuizQuestion[]) || [];
      const qs = fromRefs.length ? fromRefs : pkg.quiz?.questions || [];
      qs.forEach((q, i) => {
        out.push({
          ...q,
          day: pkg.day,
          localIndex: i,
          nodeId: quizNode?.id || `d${pkg.day}-quiz`,
        });
      });
    }
    return out;
  }, [packages]);

  const passRate = 0.8;

  const submit = async () => {
    if (answers.some((a) => a < 0)) {
      toast.push("请答完所有题目", "error");
      return;
    }
    if (!campId) return;
    setBusy(true);
    setError(null);
    try {
      const byDay = new Map<number, { nodeId: string; answers: number[]; total: number }>();
      questions.forEach((q, i) => {
        const bucket = byDay.get(q.day) || { nodeId: q.nodeId, answers: [], total: 0 };
        bucket.answers[q.localIndex] = answers[i] ?? -1;
        bucket.total += 1;
        bucket.nodeId = q.nodeId;
        byDay.set(q.day, bucket);
      });

      let correct = 0;
      let total = 0;
      let allPass = true;
      for (const [day, bucket] of byDay) {
        const filled = Array.from({ length: bucket.total }, (_, i) => bucket.answers[i] ?? -1);
        const res = await dayApi.submitQuiz({
          camp_id: campId,
          day,
          node_id: bucket.nodeId,
          answers: filled,
        });
        correct += res.correct;
        total += res.total;
        if (!res.pass) allPass = false;
      }
      const score = total ? correct / total : 0;
      const pass = allPass && score >= passRate - 1e-9;
      setResult({ pass, score, correct, total });
      if (pass) {
        toast.push("周测通过", "success");
        onCompleted();
      } else {
        toast.push(`未通过（需 ≥ ${Math.round(passRate * 100)}%）`, "error");
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "提交失败");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Skeleton rows={8} />;
  if (error && !questions.length) return <ErrorState title="周测" message={error} />;
  if (!questions.length) {
    return (
      <div className="panel">
        <h2>{WEEK_CN[week] || `第${week}周`}概念验收</h2>
        <p className="muted">本周暂无概念验收题目。</p>
      </div>
    );
  }

  return (
    <div className="stack day-quiz-mode">
      <p className="muted day-quiz-eyebrow">
        {WEEK_CN[week] || `第${week}周`} · 概念验收（共 {questions.length} 题）
      </p>
      <div className="panel">
        <h2 style={{ marginTop: 0 }}>{WEEK_CN[week] || `第${week}周`}概念验收</h2>
        <p className="muted">汇总本周各日知识点，一次验收通过即可。</p>
      </div>

      {questions.map((q, i) => (
        <div className="panel" key={`${q.day}-${q.localIndex}-${i}`}>
          <p className="muted" style={{ marginBottom: 6 }}>
            {dayLabel(q.day)} · 第 {q.localIndex + 1} 题
          </p>
          <h3 style={{ marginTop: 0, fontSize: 18 }}>
            {i + 1}. {q.q}
          </h3>
          <div className="stack" style={{ gap: 8 }}>
            {(q.options || []).map((opt, oi) => (
              <label key={oi} className="row" style={{ gap: 10, alignItems: "flex-start" }}>
                <input
                  type="radio"
                  name={`wq-${i}`}
                  checked={answers[i] === oi}
                  disabled={Boolean(result?.pass)}
                  onChange={() =>
                    setAnswers((prev) => {
                      const next = [...prev];
                      next[i] = oi;
                      return next;
                    })
                  }
                />
                <span>{opt}</span>
              </label>
            ))}
          </div>
        </div>
      ))}

      {result ? (
        <div className="panel" style={{ borderColor: result.pass ? "var(--color-ok)" : "var(--color-warn)" }}>
          <strong>
            {result.pass ? "已通过" : "未通过"} · {result.correct}/{result.total}（
            {Math.round(result.score * 100)}%）
          </strong>
        </div>
      ) : null}

      {error ? <ErrorState message={error} /> : null}

      <button type="button" className="btn-primary" disabled={busy || Boolean(result?.pass)} onClick={() => void submit()}>
        {result?.pass ? "已通过" : busy ? "提交中…" : "提交周测"}
      </button>
    </div>
  );
}
