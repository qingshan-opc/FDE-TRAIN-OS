import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { App, Button, Form, Input, InputNumber, Select, Tag, Typography, List } from "antd";
import { authorApi, ApiError } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import type { Paginated } from "../../lib/listQuery";
import { useListQuery } from "../../lib/useListQuery";
import { AuthorListPageLayout, PageHeader, SearchToolbar, ServerTable, EntityModal, type EntityModalMode } from "../../components/crud";
import { StatusTag } from "../../components/StatusTag";
import { statusOptions } from "../../lib/statusLabels";

type SubmissionRow = {
  id: string;
  learner_id?: string;
  day?: number;
  node_id?: string;
  status?: string;
  score?: number | null;
  created_at?: string;
};

export function LearnerSubmissions() {
  const { campId } = useAuth();
  const { message } = App.useApp();
  const { page, page_size, q, filters, hasFilters, setPage, setFilter, reset } = useListQuery();
  const [data, setData] = useState<Paginated<SubmissionRow> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<EntityModalMode>({ kind: "closed" });
  const [reviewMode, setReviewMode] = useState<EntityModalMode>({ kind: "closed" });
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [attachments, setAttachments] = useState<Array<{ kind: string; name: string; object_key?: string; size?: number; content_type?: string }>>([]);
  const [viewForm] = Form.useForm();
  const [reviewForm] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [currentId, setCurrentId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(
        await authorApi.listSubmissionsPaged({
          camp_id: campId || undefined,
          q: q || undefined,
          day: filters.day ? Number(filters.day) : undefined,
          status: filters.status,
          page,
          page_size,
        }),
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "加载失败");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [campId, q, filters.day, filters.status, page, page_size]);

  useEffect(() => {
    void load();
  }, [load]);

  const openView = async (id: string) => {
    setCurrentId(id);
    setViewMode({ kind: "view", id });
    try {
      const d = await authorApi.getSubmission(id);
      setDetail(d);
      const atts = await authorApi.getSubmissionAttachments(id);
      const fromDetail = (d as { item?: { attachments?: typeof attachments } })?.item?.attachments;
      setAttachments(fromDetail?.length ? fromDetail : atts.items || []);
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : "加载详情失败");
    }
  };

  const item = (detail as { item?: Record<string, unknown> } | null)?.item || detail;
  const evalJson = item?.eval_json as Record<string, unknown> | undefined;
  const checks = Array.isArray(evalJson?.checks) ? (evalJson.checks as Array<Record<string, unknown>>) : [];

  return (
    <>
      <AuthorListPageLayout
        header={<PageHeader title="提交资料" description="学员提交物、附件与导师复核" />}
        toolbar={
          <SearchToolbar
            fields={[
              { key: "q", type: "search", label: "搜索", placeholder: "学员 / 节点 / 提交 ID", width: 300 },
              { key: "day", type: "input", label: "课次", placeholder: "第 N 课", width: 120 },
              {
                key: "status",
                type: "select",
                label: "状态",
                placeholder: "状态",
                width: 140,
                options: statusOptions(
                  ["submitted", "pending", "needs_review", "passed", "failed", "resolved"],
                  "submission",
                ),
              },
            ]}
            values={{ q: q || undefined, day: filters.day, status: filters.status }}
            onChange={setFilter}
            onReset={hasFilters ? reset : undefined}
            extra={
              <Link to="/author/learners/reviews">
                <Button>导师复核队列</Button>
              </Link>
            }
          />
        }
      >
        <ServerTable<SubmissionRow>
          rowKey="id"
          loading={loading}
          error={error}
          onRetry={() => void load()}
          data={data}
          onPageChange={setPage}
          columns={[
            { title: "提交 ID", dataIndex: "id", ellipsis: true },
            { title: "学员", dataIndex: "learner_id", responsive: ["md"] },
            { title: "Day", dataIndex: "day" },
            { title: "节点", dataIndex: "node_id", responsive: ["md"] },
            {
              title: "状态",
              dataIndex: "status",
              render: (s?: string) => <StatusTag status={s} domain="submission" />,
            },
            { title: "分数", dataIndex: "score", render: (n?: number | null) => n ?? "—" },
            {
              title: "操作",
              render: (_, r) => (
                <>
                  <Button type="link" onClick={() => void openView(r.id)}>
                    查看
                  </Button>
                  <Button
                    type="link"
                    onClick={() => {
                      setCurrentId(r.id);
                      reviewForm.setFieldsValue({ feedback: "", score: undefined, status: "resolved" });
                      setReviewMode({ kind: "edit", id: r.id });
                    }}
                  >
                    复核
                  </Button>
                </>
              ),
            },
          ]}
        />
      </AuthorListPageLayout>

      <EntityModal
        mode={viewMode}
        title={{ create: "详情", edit: "详情", view: "提交详情" }}
        form={viewForm}
        onClose={() => setViewMode({ kind: "closed" })}
        onSubmit={async () => undefined}
        width={720}
      >
        <Typography.Paragraph>
          <strong>ID：</strong>
          {String(item?.id || currentId || "")}
        </Typography.Paragraph>
        <Typography.Paragraph>
          <strong>状态 / 分数：</strong>
          <StatusTag status={item?.status ? String(item.status) : null} domain="submission" />{" "}
          {item?.score != null ? String(item.score) : "—"}
        </Typography.Paragraph>
        <Typography.Paragraph>
          <strong>反馈：</strong>
          {String(item?.feedback || "—")}
        </Typography.Paragraph>
        <Typography.Title level={5}>自动评测</Typography.Title>
        {checks.length === 0 ? (
          <Typography.Paragraph type="secondary">无评测明细</Typography.Paragraph>
        ) : (
          <ul style={{ margin: "0 0 16px", paddingLeft: 18 }}>
            {checks.map((c, i) => (
              <li key={String(c.id || i)}>
                <Tag color={c.ok ? "green" : "red"}>{c.ok ? "通过" : "未通过"}</Tag>
                {String(c.id || c.name || `check-${i}`)}
                {c.suggestion ? ` — ${String(c.suggestion)}` : ""}
              </li>
            ))}
          </ul>
        )}
        <Typography.Title level={5}>附件</Typography.Title>
        <List
          size="small"
          dataSource={attachments}
          locale={{ emptyText: "无附件" }}
          renderItem={(a) => (
            <List.Item>
              <Tag>{a.kind}</Tag> {a.name} {a.size != null ? `(${a.size}B)` : ""}
              {a.content_type ? ` · ${a.content_type}` : ""}
            </List.Item>
          )}
        />
      </EntityModal>

      <EntityModal
        mode={reviewMode}
        title={{ create: "复核", edit: "提交复核", view: "复核" }}
        form={reviewForm}
        submitting={submitting}
        onClose={() => setReviewMode({ kind: "closed" })}
        onSubmit={async (values: { feedback: string; score?: number; status?: string }) => {
          if (!currentId) return;
          setSubmitting(true);
          try {
            await authorApi.reviewSubmission(currentId, values);
            message.success("复核已保存");
            setReviewMode({ kind: "closed" });
            await load();
          } finally {
            setSubmitting(false);
          }
        }}
      >
        <Form.Item name="feedback" label="反馈" rules={[{ required: true }]}>
          <Input.TextArea rows={4} />
        </Form.Item>
        <Form.Item name="score" label="分数">
          <InputNumber min={0} max={100} style={{ width: "100%" }} />
        </Form.Item>
        <Form.Item name="status" label="状态" initialValue="resolved">
          <Select
            options={statusOptions(["resolved", "pending", "passed", "failed"], "submission")}
            placeholder="选择状态"
          />
        </Form.Item>
      </EntityModal>
    </>
  );
}
