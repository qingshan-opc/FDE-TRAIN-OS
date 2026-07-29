import { useCallback, useEffect, useState } from "react";
import {
  App,
  Button,
  Descriptions,
  Empty,
  Input,
  InputNumber,
  Modal,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
  Spin,
} from "antd";
import { Link } from "react-router-dom";
import { authorApi, ApiError } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { AuthorListPageLayout, PageHeader, SearchToolbar, useErrorModal } from "../../components/crud";
import { StatusTag } from "../../components/StatusTag";
import { useListTableScroll } from "../../hooks/useListTableScroll";
import type { MentorReview } from "../../lib/types";

type SubmissionDetail = {
  id?: string;
  display_name?: string;
  email?: string;
  day?: number;
  node_id?: string;
  status?: string;
  score?: number | null;
  feedback?: string | null;
  eval_json?: Record<string, unknown>;
  created_at?: string;
};

type AttachmentItem = {
  kind: string;
  name: string;
  object_key?: string;
  size?: number;
  content_type?: string;
};

function ReviewDetail({
  review,
  draft,
  onDraftChange,
  busy,
  onSubmit,
}: {
  review: MentorReview;
  draft: string;
  onDraftChange: (v: string) => void;
  busy: boolean;
  onSubmit: (score?: number | null) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [submission, setSubmission] = useState<SubmissionDetail | null>(null);
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [score, setScore] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        let sid = review.submission_id || null;
        // handoff 时若尚无 Lab 提交则 submission_id 为空；按学员+课次+节点回查最近作业
        if (!sid && review.learner_id) {
          const listed = await authorApi.listSubmissionsPaged({
            camp_id: review.camp_id || undefined,
            q: review.learner_id,
            day: review.day ?? undefined,
            page: 1,
            page_size: 20,
          });
          const items = (listed?.items || []) as Array<{ id: string; learner_id?: string; node_id?: string }>;
          const hit =
            items.find((s) => s.learner_id === review.learner_id && (!review.node_id || s.node_id === review.node_id)) ||
            items.find((s) => s.learner_id === review.learner_id) ||
            null;
          sid = hit?.id || null;
        }
        if (!sid) {
          if (!cancelled) {
            setSubmission(null);
            setAttachments([]);
          }
          return;
        }
        const [detail, atts] = await Promise.all([
          authorApi.getSubmission(sid),
          authorApi.getSubmissionAttachments(sid),
        ]);
        if (cancelled) return;
        const item = (detail?.item || detail || null) as SubmissionDetail;
        if (item && !item.id) item.id = sid;
        setSubmission(item);
        setAttachments((atts?.items || []) as AttachmentItem[]);
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof ApiError ? err.message : "加载学员作业失败");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [review.submission_id, review.learner_id, review.camp_id, review.day, review.node_id]);

  useErrorModal(loadError, { title: "加载学员作业失败" });

  const evalJson = submission?.eval_json;
  const checks = Array.isArray(evalJson?.checks) ? (evalJson?.checks as Array<Record<string, unknown>>) : [];
  const reflection =
    typeof evalJson?.reflection === "string"
      ? evalJson.reflection
      : typeof evalJson?.content === "string"
        ? evalJson.content
        : "";

  return (
    <div className="author-review-detail">
      <Descriptions size="small" column={2} bordered style={{ marginBottom: 12 }}>
        <Descriptions.Item label="学员问题" span={2}>
          {review.reason || "—"}
        </Descriptions.Item>
        <Descriptions.Item label="AI 诊断" span={2}>
          {review.diagnostics_json?.diagnosis_zh || "—"}
          {review.diagnostics_json?.next_action_zh
            ? `（建议：${review.diagnostics_json.next_action_zh}）`
            : ""}
        </Descriptions.Item>
        <Descriptions.Item label="关联提交">
          {review.submission_id ? (
            <Typography.Text code>{review.submission_id}</Typography.Text>
          ) : (
            <Typography.Text type="secondary">无关联提交（纯问答 handoff）</Typography.Text>
          )}
        </Descriptions.Item>
        <Descriptions.Item label="课次 / 节点">
          Day {review.day ?? "—"} · {review.node_id || "—"}
        </Descriptions.Item>
      </Descriptions>

      <Typography.Title level={5} style={{ marginTop: 0 }}>
        学员作业
      </Typography.Title>
      {loading ? (
        <div style={{ padding: 24, textAlign: "center" }}>
          <Spin />
        </div>
      ) : loadError ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="作业加载失败" />
      ) : !submission ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="未找到关联 Lab 提交（可能仅为对话 handoff，或学员尚未提交作业）"
        />
      ) : (
        <>
          <Descriptions size="small" column={2} style={{ marginBottom: 12 }}>
            <Descriptions.Item label="提交 ID">
              <Typography.Text code>{submission.id}</Typography.Text>
              {!review.submission_id ? (
                <Tag style={{ marginLeft: 8 }} color="gold">
                  回查匹配
                </Tag>
              ) : null}
            </Descriptions.Item>
            <Descriptions.Item label="学员">
              {submission.display_name || submission.email || review.learner_id}
            </Descriptions.Item>
            <Descriptions.Item label="状态 / 分数">
              <StatusTag status={submission.status} domain="submission" /> {submission.score ?? "—"}
            </Descriptions.Item>
            <Descriptions.Item label="节点">
              Day {submission.day ?? review.day ?? "—"} · {submission.node_id || review.node_id || "—"}
            </Descriptions.Item>
            {reflection ? (
              <Descriptions.Item label="作业内容" span={2}>
                <Typography.Paragraph style={{ marginBottom: 0, whiteSpace: "pre-wrap" }}>
                  {reflection}
                </Typography.Paragraph>
              </Descriptions.Item>
            ) : null}
            <Descriptions.Item label="自动评测" span={2}>
              {checks.length === 0 ? (
                <Typography.Text type="secondary">无评测明细</Typography.Text>
              ) : (
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {checks.map((c, i) => (
                    <li key={String(c.id || i)}>
                      <Tag color={c.ok ? "green" : "red"}>{c.ok ? "通过" : "未通过"}</Tag>
                      {String(c.id || c.name || `check-${i}`)}
                      {c.suggestion ? ` — ${String(c.suggestion)}` : ""}
                    </li>
                  ))}
                </ul>
              )}
            </Descriptions.Item>
            {submission.feedback ? (
              <Descriptions.Item label="历史反馈" span={2}>
                {String(submission.feedback)}
              </Descriptions.Item>
            ) : null}
          </Descriptions>

          <Typography.Text strong>附件（{attachments.length}）</Typography.Text>
          {attachments.length === 0 ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="无附件" style={{ margin: "8px 0" }} />
          ) : (
            <ul style={{ margin: "8px 0 12px", paddingLeft: 18 }}>
              {attachments.map((a, i) => (
                <li key={`${a.kind}-${a.name}-${i}`}>
                  <Tag>{a.kind}</Tag> {a.name}
                  {a.size != null ? ` (${a.size}B)` : ""}
                  {a.content_type ? ` · ${a.content_type}` : ""}
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {review.status === "resolved" ? (
        <Typography.Text type="secondary">导师反馈：{review.mentor_feedback || "—"}</Typography.Text>
      ) : (
        <Space direction="vertical" style={{ width: "100%", marginTop: 8 }}>
          <Input.TextArea
            rows={3}
            value={draft}
            onChange={(e) => onDraftChange(e.target.value)}
            placeholder="给学员的具体反馈与下一步建议…"
          />
          <Space wrap>
            <InputNumber
              min={0}
              max={100}
              placeholder="分数（可选）"
              value={score ?? undefined}
              onChange={(v) => setScore(typeof v === "number" ? v : null)}
              style={{ width: 140 }}
            />
            <Button
              type="primary"
              disabled={busy || !draft.trim()}
              loading={busy}
              onClick={() => onSubmit(score)}
            >
              提交反馈并结案
            </Button>
            {(submission?.id || review.submission_id) && (
              <Link
                to={`/author/learners/submissions?q=${encodeURIComponent(String(submission?.id || review.submission_id))}`}
              >
                在提交资料中打开
              </Link>
            )}
          </Space>
        </Space>
      )}
    </div>
  );
}

export function MentorReviewQueue({
  campId,
  statusFilter = "pending",
}: {
  campId: string | null;
  statusFilter?: "pending" | "resolved";
}) {
  const { message } = App.useApp();
  const [items, setItems] = useState<MentorReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [active, setActive] = useState<MentorReview | null>(null);
  const { containerRef, scrollY } = useListTableScroll([items, loading, statusFilter]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authorApi.listMentorReviews({ status: statusFilter, camp_id: campId || undefined });
      setItems(res.items || []);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "加载导师复核队列失败");
    } finally {
      setLoading(false);
    }
  }, [campId, statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  useErrorModal(error, { title: "加载失败", onRetry: () => void load() });

  const submitFeedback = async (id: string, score?: number | null) => {
    const feedback = (drafts[id] || "").trim();
    if (!feedback) return;
    setBusyId(id);
    try {
      await authorApi.submitMentorReviewFeedback(id, {
        feedback,
        status: "resolved",
        ...(typeof score === "number" ? { score } : {}),
      });
      message.success("反馈已提交");
      setItems((prev) => prev.filter((r) => r.id !== id));
      setActive(null);
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "提交反馈失败");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <div className="author-list-table-card" ref={containerRef}>
        <Table
          rowKey="id"
          loading={loading}
          dataSource={items}
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            showTotal: (t) => `共 ${t} 条`,
            position: ["bottomCenter"],
          }}
          scroll={{ y: scrollY }}
          locale={{
            emptyText: (
              <Empty description={`暂无${statusFilter === "pending" ? "待处理" : "已处理"}的导师复核申请`} />
            ),
          }}
          columns={[
            {
              title: "学员",
              dataIndex: "learner_id",
              render: (id: string) => <Typography.Text code>{id?.slice(0, 8)}</Typography.Text>,
            },
            { title: "课次", dataIndex: "day", width: 72, render: (d) => d ?? "—" },
            { title: "节点", dataIndex: "node_id", ellipsis: true, render: (n) => n || "—" },
            {
              title: "作业",
              dataIndex: "submission_id",
              width: 90,
              render: (sid?: string | null) =>
                sid ? <Tag color="blue">有提交</Tag> : <Tag>无提交</Tag>,
            },
            {
              title: "状态",
              dataIndex: "status",
              width: 90,
              render: (s: string) => <StatusTag status={s} domain="submission" />,
            },
            { title: "时间", dataIndex: "created_at", width: 180, render: (t) => t || "—" },
            {
              title: "操作",
              width: 100,
              fixed: "right",
              render: (_, r) => (
                <Button type="link" onClick={() => setActive(r)}>
                  {r.status === "resolved" ? "查看" : "处理"}
                </Button>
              ),
            },
          ]}
        />
      </div>

      <Modal
        title={active?.status === "resolved" ? "复核详情" : "处理导师复核"}
        open={Boolean(active)}
        onCancel={() => setActive(null)}
        destroyOnClose
        footer={null}
        width={Math.min(800, typeof window !== "undefined" ? window.innerWidth - 32 : 800)}
        styles={{ body: { maxHeight: "70vh", overflow: "auto" } }}
        style={{ top: 24 }}
      >
        {active ? (
          <ReviewDetail
            review={active}
            draft={drafts[active.id] || ""}
            onDraftChange={(v) => setDrafts((prev) => ({ ...prev, [active.id]: v }))}
            busy={busyId === active.id}
            onSubmit={(score) => void submitFeedback(active.id, score)}
          />
        ) : null}
      </Modal>
    </>
  );
}

export function LearnerReviews() {
  const { campId } = useAuth();
  const [statusFilter, setStatusFilter] = useState<"pending" | "resolved">("pending");

  return (
    <AuthorListPageLayout
      header={
        <PageHeader title="导师复核" description="点击「处理」查看学员作业、评测与附件，并提交反馈" />
      }
      toolbar={
        <SearchToolbar
          leading={
            <Tabs
              size="small"
              activeKey={statusFilter}
              onChange={(k) => setStatusFilter(k as "pending" | "resolved")}
              items={[
                { key: "pending", label: "待处理" },
                { key: "resolved", label: "已处理" },
              ]}
              style={{ marginBottom: 0 }}
            />
          }
          extra={
            <Link to="/author/learners/submissions">
              <Button>查看提交资料</Button>
            </Link>
          }
        />
      }
    >
      <MentorReviewQueue campId={campId} statusFilter={statusFilter} />
    </AuthorListPageLayout>
  );
}
