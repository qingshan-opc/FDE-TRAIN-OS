import { lazy, Suspense, useMemo, useState } from "react";
import { dayApi, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useToast } from "../components/Toast";
import type { DayPackage, NodeCompleteResult, NodeState } from "../lib/types";
import { dayLabel } from "../lib/dayLabel";
import { CapsuleReader } from "./CapsuleReader";
import { ProjectSubmit } from "./ProjectSubmit";
import { Quiz } from "./Quiz";
import { SimLab } from "./SimLab";
import { SqlLab } from "./SqlLab";
import { ErrorState } from "../components/ErrorState";
import { Empty } from "../components/Empty";
import { Skeleton } from "../components/Skeleton";

const LabWorkbench = lazy(() => import("./LabWorkbench").then((m) => ({ default: m.LabWorkbench })));

export function DayView({
  day,
  onRefresh,
  activeNodeId,
  openCapsuleId,
  onOpenCapsuleIdChange,
  onReadChange,
}: {
  day: DayPackage | null;
  onRefresh: (result?: NodeCompleteResult) => void;
  activeNodeId: string | null;
  openCapsuleId?: string | null;
  onOpenCapsuleIdChange?: (id: string) => void;
  onReadChange?: (read: Set<string>) => void;
}) {
  const { campId } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const visibleNodes = useMemo(
    () => (day?.nodes || []).filter((n) => n.kind === "learn" || n.kind === "lab"),
    [day],
  );

  const node: NodeState | null = useMemo(() => {
    if (!day) return null;
    return (
      visibleNodes.find((n) => n.id === activeNodeId) ||
      visibleNodes.find((n) => n.kind === "learn") ||
      visibleNodes.find((n) => n.status === "available") ||
      visibleNodes[0] ||
      null
    );
  }, [day, visibleNodes, activeNodeId]);

  const locked = node?.status === "locked";

  const completeSimple = async () => {
    if (!day || !node || !campId) return;
    setBusy(true);
    try {
      const result = await dayApi.completeNode(node.id, { camp_id: campId, day: day.day });
      toast.push("节点已完成", "success");
      onRefresh(result);
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : "完成失败", "error");
    } finally {
      setBusy(false);
    }
  };

  if (!day) {
    return <Empty title="选择一日课程" description="从左侧课程大纲进入第一天至第十二天" />;
  }

  if (!node) {
    return <ErrorState title="无节点" message="本日课程包缺少 nodes" onRetry={() => onRefresh()} />;
  }

  const runner = String(node.refs?.runner || day.lab?.runner || "");
  const isLab = node.kind === "lab";
  const isLearn = node.kind === "learn";
  const isQuiz = node.kind === "quiz";

  return (
    <div className={`stack${isLab ? " day-lab-mode" : ""}${isLearn ? " day-learn-mode" : ""}${isQuiz ? " day-quiz-mode" : ""}`}>
      {!isLab && !isLearn && !isQuiz && (
        <div className="row day-view-toolbar">
          <div>
            <h1 className="day-view-title">
              {dayLabel(day.day)} · {day.title}
            </h1>
            {(day.project || day.week) && (
              <p className="muted">
                {day.project || "—"}
                {day.week != null ? ` · 第${day.week}周` : ""}
              </p>
            )}
          </div>
        </div>
      )}
      {isQuiz && (
        <p className="muted day-quiz-eyebrow">
          {dayLabel(day.day)} · {day.title}
        </p>
      )}

      {locked && (
        <div className="panel" style={{ borderColor: "var(--color-warn)" }}>
          <p className="muted">节点未解锁，请先完成前置节点。可浏览内容，操作按钮已禁用。</p>
        </div>
      )}

      {node.kind === "learn" && (
        <CapsuleReader
          day={day}
          node={node}
          locked={locked}
          onCompleted={onRefresh}
          openCapsuleId={openCapsuleId}
          onOpenCapsuleIdChange={onOpenCapsuleIdChange}
          onReadChange={onReadChange}
        />
      )}
      {node.kind === "quiz" && <Quiz day={day} node={node} locked={locked} onCompleted={onRefresh} />}
      {node.kind === "lab" && runner === "sim" && (
        <SimLab day={day} node={node} locked={locked} onCompleted={onRefresh} />
      )}
      {node.kind === "lab" && (runner === "sql_sandbox" || runner === "sql") && (
        <SqlLab day={day} node={node} locked={locked} onCompleted={onRefresh} />
      )}
      {node.kind === "lab" && runner !== "sim" && runner !== "sql_sandbox" && runner !== "sql" && (
        <Suspense fallback={<Skeleton rows={6} />}>
          <LabWorkbench day={day} node={node} locked={locked} onCompleted={onRefresh} />
        </Suspense>
      )}
      {node.kind === "project" && <ProjectSubmit day={day} node={node} locked={locked} onCompleted={onRefresh} />}
      {node.kind === "review" && (
        <div className="stack">
          <div className="panel">
            <h2>{node.title}</h2>
            <ul>
              {(day.review_checklist || []).map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </div>
          <button
            type="button"
            className="btn-primary"
            disabled={locked || busy || node.status === "passed"}
            onClick={() => void completeSimple()}
          >
            {node.status === "passed" ? "已完成" : busy ? "提交中…" : "标记完成"}
          </button>
        </div>
      )}
    </div>
  );
}
