import { useEffect, useMemo, useState } from "react";
import { dayApi, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useToast } from "../components/Toast";
import type { DayPackage, NodeCompleteResult, NodeState, QuizQuestion } from "../lib/types";
import { ErrorState } from "../components/ErrorState";

export function Quiz({
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
  const { campId } = useAuth();
  const toast = useToast();
  const questions: QuizQuestion[] = useMemo(() => {
    const fromRefs = (node.refs?.questions as QuizQuestion[]) || [];
    return fromRefs.length ? fromRefs : day.quiz?.questions || [];
  }, [day, node]);
  const passRate = Number(node.refs?.pass_rate ?? day.quiz?.pass_rate ?? 0.8);

  const [answers, setAnswers] = useState<number[]>(() => questions.map(() => -1));
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{
    pass: boolean;
    score: number;
    correct: number;
    total: number;
    details: { index: number; correct: boolean; explain: string }[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Deliberately keyed on `node.id` alone, not `questions`: a passed quiz
  // triggers an immediate parent-level day-package refetch (auto-advance),
  // which produces a *new* `questions` array reference even though the
  // content is unchanged. Resetting on that reference change would wipe the
  // just-submitted `result` (and its "已通过" banner) before the learner
  // ever sees it.
  useEffect(() => {
    setAnswers(questions.map(() => -1));
    setResult(null);
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node.id]);

  const submit = async () => {
    if (locked) return;
    if (answers.some((a) => a < 0)) {
      toast.push("请答完所有题目", "error");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await dayApi.submitQuiz({
        camp_id: campId || day.camp_id,
        day: day.day,
        node_id: node.id,
        answers,
      });
      setResult({
        pass: res.pass,
        score: res.score,
        correct: res.correct,
        total: res.total,
        details: res.details,
      });
      if (res.pass) {
        toast.push("测验通过", "success");
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

  if (!questions.length) {
    return <ErrorState title="无测验题目" message="本日 quiz.questions 为空" />;
  }

  return (
    <div className="stack quiz-shell">
      <div>
        <h2>{node.title}</h2>
        <p className="muted">
          通过线 <span className="num">{Math.round(passRate * 100)}%</span> · 共 {questions.length} 题
        </p>
      </div>

      {questions.map((q, qi) => (
        <div key={qi} className="quiz-question">
          <h3>
            {qi + 1}. {q.q}
          </h3>
          {q.options.map((opt, oi) => (
            <button
              key={oi}
              type="button"
              className={`quiz-option ${answers[qi] === oi ? "selected" : ""}`}
              disabled={locked || busy}
              onClick={() =>
                setAnswers((prev) => {
                  const next = [...prev];
                  next[qi] = oi;
                  return next;
                })
              }
            >
              <span className="quiz-option-letter">{String.fromCharCode(65 + oi)}</span>
              <span>{opt}</span>
            </button>
          ))}
          {result && result.details[qi] && (
            <p
              className="muted"
              style={{
                marginTop: 8,
                color: result.details[qi].correct ? "var(--color-success)" : "var(--color-danger)",
              }}
            >
              {result.details[qi].correct ? "正确" : "错误"}
              {result.details[qi].explain ? ` · ${result.details[qi].explain}` : ""}
            </p>
          )}
        </div>
      ))}

      {result && (
        <div className="panel">
          <p>
            得分 <span className="num">{Math.round(result.score * 100)}%</span>（{result.correct}/{result.total}）
            {result.pass ? " · 已通过" : " · 未通过，可重做"}
          </p>
        </div>
      )}

      {error && <ErrorState title="提交失败" message={error} onRetry={() => void submit()} />}

      <button type="button" className="btn-primary" disabled={busy || locked} onClick={() => void submit()}>
        {busy ? "提交中…" : result?.pass ? "再次提交" : "提交测验"}
      </button>
    </div>
  );
}
