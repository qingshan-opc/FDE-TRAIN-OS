import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { agentApi, labAttachmentsApi, dayApi, progressApi, submissionsApi, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useToast } from "../components/Toast";
import type { DayPackage, NodeCompleteResult, NodeState, Submission } from "../lib/types";
import { ErrorState } from "../components/ErrorState";
import { blockPracticeClipboard } from "../lib/practiceClipboard";

/** Evidence kinds that count as "the day's lab produced work" — Agent Lab
 * writes `agent` (or the legacy `lab`, see M7 evidence-kind fix), Sim/SQL
 * labs write `sim`. Any of the three unlocks the project gate. */
const LAB_EVIDENCE_KINDS = new Set(["agent", "lab", "sim"]);

interface LabEvidenceSummary {
  kind: string;
  pass?: boolean;
  score?: number;
  jobId?: string;
  snapshotId?: string;
}

interface AttachmentItem {
  id: string;
  filename: string;
  size_bytes?: number;
}

export function ProjectSubmit({
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
  const { user, campId } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [reflection, setReflection] = useState("");
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [labEvidence, setLabEvidence] = useState<LabEvidenceSummary | null>(null);
  const [checkedEvidence, setCheckedEvidence] = useState(false);
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setReflection("");
    setSubmission(null);
    setLabEvidence(null);
    setCheckedEvidence(false);
    setAttachments([]);
    setPreviewUrl(null);
    setError(null);
    if (!user || !campId) return;
    let cancelled = false;
    (async () => {
      try {
        const subRes = await submissionsApi.get({ camp_id: campId, day: day.day, node_id: node.id });
        if (!cancelled && subRes.item) {
          setSubmission(subRes.item);
          const savedReflection = (subRes.item.eval_json?.reflection as string | undefined) || "";
          if (savedReflection) setReflection(savedReflection);
        }
      } catch {
        /* optional */
      }
      try {
        const ev = await progressApi.evidence(user.id);
        const matches = (ev.items || []).filter(
          (e) => Number(e.day) === day.day && LAB_EVIDENCE_KINDS.has(String(e.kind || "")),
        );
        // most recently written evidence first (backend already orders desc by ts)
        const latest = matches[0];
        if (!cancelled && latest) {
          const payload = (latest.payload as Record<string, unknown>) || {};
          const evalResult = (payload.eval as { pass?: boolean; score?: number } | undefined) || undefined;
          setLabEvidence({
            kind: String(latest.kind || ""),
            pass: evalResult?.pass,
            score: evalResult?.score,
            jobId: (payload.job_id as string | undefined) || undefined,
            snapshotId: (payload.snapshot_id as string | undefined) || undefined,
          });
        }
      } catch {
        // degrade gracefully — gate check below still runs at submit time
      } finally {
        if (!cancelled) setCheckedEvidence(true);
      }
      try {
        const res = await labAttachmentsApi.list({ camp_id: campId, day: day.day, node_id: node.id });
        if (!cancelled) {
          setAttachments(
            (res.items || []).map((it) => ({
              id: String(it.id),
              filename: String(it.filename || "附件"),
              size_bytes: it.size_bytes as number | undefined,
            })),
          );
        }
      } catch {
        // attachments are optional — ignore load failure
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-run on day/node/session change
  }, [day.day, node.id, campId, user?.id]);

  const openPreview = async () => {
    if (!campId || !user) return;
    try {
      const res = await agentApi.previewUrl(campId, user.id);
      setPreviewUrl(res.url);
      window.open(res.url, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : "预览暂不可用", "error");
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !campId) return;
    setUploading(true);
    try {
      const res = await labAttachmentsApi.upload(file, { camp_id: campId, day: day.day, node_id: node.id });
      setAttachments((prev) => [...prev, { id: res.id, filename: res.filename, size_bytes: res.size_bytes }]);
      toast.push("附件已上传", "success");
    } catch (err) {
      toast.push(err instanceof ApiError ? `附件上传失败：${err.message}` : "附件上传失败", "error");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const submit = async () => {
    if (locked || !campId) return;
    if (!labEvidence) {
      toast.push("请先完成 Lab 并产出作品证据，再提交企业任务", "error");
      return;
    }
    if (!reflection.trim()) {
      toast.push("请填写 1 分钟复盘说明", "error");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await submissionsApi.create({
        camp_id: campId,
        day: day.day,
        node_id: node.id,
        job_id: labEvidence.jobId,
        snapshot_id: labEvidence.snapshotId,
        eval: {
          reflection: reflection.trim(),
          attachment_ids: attachments.map((a) => a.id),
          lab_evidence_kind: labEvidence.kind,
        },
      });
      const subRes = await submissionsApi.get({ camp_id: campId, day: day.day, node_id: node.id });
      setSubmission(subRes.item);
      if (node.status !== "passed") {
        const result = await dayApi.completeNode(node.id, { camp_id: campId, day: day.day });
        toast.push("作业已提交", "success");
        onCompleted(result);
      } else {
        toast.push(submission?.status === "failed" ? "作业已重新提交，等待导师复核" : "作业已提交", "success");
      }
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "提交失败";
      setError(msg);
      toast.push(msg, "error");
    } finally {
      setBusy(false);
    }
  };

  const passed = node.status === "passed";
  const reviewFailed = submission?.status === "failed";
  const reviewPassed = submission?.status === "passed";
  const canSubmit = !locked && !busy && !!labEvidence && (!passed || reviewFailed);
  const labNode = useMemo(() => day.nodes?.find((n) => n.kind === "lab"), [day.nodes]);

  const statusLabel = reviewFailed
    ? "需修改"
    : reviewPassed
      ? "已通过"
      : submission?.feedback
        ? "已批改"
        : submission
          ? "已提交"
          : passed
            ? "已提交"
            : null;

  return (
    <div className="stack">
      <div className="panel stack">
        <h2>{node.title}</h2>
        <p>{String(node.refs?.brief || day.project_brief || "按企业任务交付本日产物。")}</p>
      </div>

      {submission && (submission.feedback || reviewFailed || reviewPassed) && (
        <div className="panel stack project-submission-review" data-testid="project-submission-review">
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
            <h3 style={{ fontSize: 15, margin: 0 }}>导师批改</h3>
            {statusLabel && (
              <span className={`project-submission-status project-submission-status--${submission.status || "submitted"}`}>
                {statusLabel}
              </span>
            )}
          </div>
          {submission.score != null && (
            <p className="muted">
              评分 <span className="num">{submission.score}</span>
            </p>
          )}
          {submission.feedback ? (
            <p className="project-submission-feedback">{submission.feedback}</p>
          ) : (
            <p className="muted">导师尚未填写文字反馈。</p>
          )}
          {reviewFailed && labNode && (
            <button type="button" className="btn-ghost" onClick={() => navigate(`/app/day/${day.day}?node=${labNode.id}`)}>
              返回 Lab 修改产物
            </button>
          )}
        </div>
      )}

      <div className="panel stack">
        <h3 style={{ fontSize: 15 }}>作品证据</h3>
        {!checkedEvidence ? (
          <p className="muted">检查中…</p>
        ) : labEvidence ? (
          <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
            <p className="muted">
              来源：{labEvidence.kind === "sim" ? "仿真 Lab" : "Agent 工作区"}
              {labEvidence.score != null && (
                <>
                  {" "}
                  · 评分 <span className="num">{Math.round(labEvidence.score * 100)}%</span>
                </>
              )}
              {labEvidence.pass != null && <> · {labEvidence.pass ? "通过" : "未通过"}</>}
            </p>
            {labEvidence.kind !== "sim" && (
              <button type="button" onClick={() => void openPreview()}>
                {previewUrl ? "重新预览" : "预览工作区"}
              </button>
            )}
          </div>
        ) : (
          <p className="muted" style={{ color: "var(--color-danger)" }}>
            尚未检测到本日 Lab 的作品证据，请先完成 Lab 评测。
          </p>
        )}
      </div>

      <div className="panel stack">
        <div className="field">
          <label htmlFor="project-reflection">1 分钟复盘说明</label>
          <textarea
            id="project-reflection"
            className="practice-no-clipboard"
            rows={5}
            placeholder="简述你交付了什么、遇到的关键问题、以及下一步会怎么改进…"
            value={reflection}
            disabled={locked || busy}
            onChange={(e) => setReflection(e.target.value)}
            {...blockPracticeClipboard<HTMLTextAreaElement>()}
          />
        </div>

        <div className="field">
          <label>附件（可选）</label>
          {attachments.length > 0 && (
            <ul style={{ margin: "0 0 8px", paddingLeft: 18 }}>
              {attachments.map((a) => (
                <li key={a.id} className="muted">
                  {a.filename}
                </li>
              ))}
            </ul>
          )}
          <input ref={fileInputRef} type="file" disabled={locked || busy || uploading} onChange={(e) => void handleFileChange(e)} />
          {uploading && <p className="muted num">上传中…</p>}
        </div>

        <button type="button" className="btn-primary" disabled={!canSubmit} onClick={() => void submit()}>
          {reviewFailed ? "重新提交作业" : passed && !reviewFailed ? "已提交" : busy ? "提交中…" : "提交作业"}
        </button>

        {error && <ErrorState title="提交失败" message={error} onRetry={() => void submit()} />}
      </div>
    </div>
  );
}
