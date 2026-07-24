import { useCallback, useEffect, useState } from "react";
import { Alert, App, Button, Card, Input, Space, Table, Tabs, Tag, Typography, Empty } from "antd";
import { authorApi, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import type { MentorReview, Submission } from "../lib/types";

function MentorReviewQueue({ campId }: { campId: string | null }) {
  const { message } = App.useApp();
  const [items, setItems] = useState<MentorReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"pending" | "resolved">("pending");

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

  const submitFeedback = async (id: string) => {
    const feedback = (drafts[id] || "").trim();
    if (!feedback) return;
    setBusyId(id);
    try {
      await authorApi.submitMentorReviewFeedback(id, { feedback, status: "resolved" });
      message.success("反馈已提交");
      setItems((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "提交反馈失败");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Card title="导师复核队列" style={{ marginBottom: 16 }}>
      <Space style={{ width: "100%", justifyContent: "space-between", marginBottom: 12 }} wrap>
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
        <Button onClick={() => void load()}>刷新</Button>
      </Space>
      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 12 }} />}
      <Table
        rowKey="id"
        loading={loading}
        dataSource={items}
        pagination={false}
        locale={{ emptyText: <Empty description={`暂无${statusFilter === "pending" ? "待处理" : "已处理"}的导师复核申请`} /> }}
        expandable={{
          expandedRowRender: (r) => (
            <div>
              {r.reason && <p>学员问题：{r.reason}</p>}
              {r.diagnostics_json?.diagnosis_zh && (
                <p>
                  AI 诊断：{r.diagnostics_json.diagnosis_zh}
                  {r.diagnostics_json.next_action_zh && `（建议：${r.diagnostics_json.next_action_zh}）`}
                </p>
              )}
              {r.status === "resolved" ? (
                <Typography.Text type="secondary">导师反馈：{r.mentor_feedback || "—"}</Typography.Text>
              ) : (
                <Space direction="vertical" style={{ width: "100%" }}>
                  <Input.TextArea
                    rows={2}
                    value={drafts[r.id] || ""}
                    onChange={(e) => setDrafts((prev) => ({ ...prev, [r.id]: e.target.value }))}
                    placeholder="给学员的具体反馈与下一步建议…"
                  />
                  <Button
                    type="primary"
                    disabled={busyId === r.id || !(drafts[r.id] || "").trim()}
                    loading={busyId === r.id}
                    onClick={() => void submitFeedback(r.id)}
                  >
                    提交反馈并结案
                  </Button>
                </Space>
              )}
            </div>
          ),
        }}
        columns={[
          {
            title: "学员",
            dataIndex: "learner_id",
            render: (id: string) => <Typography.Text code>{id.slice(0, 8)}</Typography.Text>,
          },
          { title: "课次", dataIndex: "day", render: (d) => d ?? "—" },
          { title: "节点", dataIndex: "node_id", render: (n) => n || "—" },
          {
            title: "状态",
            dataIndex: "status",
            render: (s: string) => (
              <Tag color={s === "pending" ? "orange" : "green"}>{s === "pending" ? "待处理" : s === "resolved" ? "已处理" : s}</Tag>
            ),
          },
          { title: "时间", dataIndex: "created_at", render: (t) => t || "—" },
        ]}
      />
    </Card>
  );
}

export function Submissions() {
  const { campId } = useAuth();
  const [items, setItems] = useState<Submission[]>([]);
  const [jobs, setJobs] = useState<Record<string, unknown>[]>([]);
  const [evidence, setEvidence] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fallbackNote, setFallbackNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setFallbackNote(null);
    try {
      const res = await authorApi.listSubmissions({ camp_id: campId || undefined });
      setItems(res.items || []);
    } catch (err) {
      try {
        const [ev, jb] = await Promise.all([authorApi.evidence(), authorApi.jobs()]);
        setEvidence(ev.items || []);
        setJobs(jb.items || []);
        setItems([]);
        setFallbackNote(
          err instanceof ApiError
            ? `submissions API 不可用（${err.message}），已回退到 evidence / jobs`
            : "submissions API 不可用，已回退到 evidence / jobs",
        );
      } catch (err2) {
        setError(err2 instanceof ApiError ? err2.message : "加载失败");
      }
    } finally {
      setLoading(false);
    }
  }, [campId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div>
      <Space style={{ width: "100%", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <Typography.Title level={3} style={{ margin: 0 }}>
            提交物
          </Typography.Title>
          <Typography.Text type="secondary">学员 Lab / 评测提交一览</Typography.Text>
        </div>
        <Button onClick={() => void load()}>刷新</Button>
      </Space>

      <MentorReviewQueue campId={campId} />

      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} />}
      {fallbackNote && <Alert type="warning" showIcon message={fallbackNote} style={{ marginBottom: 16 }} />}

      {items.length > 0 && (
        <Card title="学员提交" style={{ marginBottom: 16 }}>
          <Table
            rowKey="id"
            loading={loading}
            dataSource={items}
            columns={[
              { title: "学员", dataIndex: "learner_id", render: (id: string) => <Typography.Text code>{id.slice(0, 8)}</Typography.Text> },
              { title: "课次", dataIndex: "day" },
              { title: "节点", dataIndex: "node_id", render: (n) => <Typography.Text code>{n}</Typography.Text> },
              {
                title: "状态",
                dataIndex: "status",
                render: (s: string) => (
                  <Tag>{s === "pending" ? "待处理" : s === "passed" ? "通过" : s === "failed" ? "未通过" : s}</Tag>
                ),
              },
              { title: "时间", dataIndex: "created_at", render: (t) => t || "—" },
            ]}
          />
        </Card>
      )}

      {!loading && !items.length && !jobs.length && !evidence.length && !error && (
        <Empty description="暂无提交" />
      )}

      {jobs.length > 0 && (
        <Card title="Agent 任务" style={{ marginBottom: 16 }}>
          <Table
            rowKey={(j) => String(j.id)}
            dataSource={jobs}
            columns={[
              { title: "ID", dataIndex: "id", render: (id) => <Typography.Text code>{String(id).slice(0, 8)}</Typography.Text> },
              { title: "学员", dataIndex: "learner_id", render: (id) => <Typography.Text code>{String(id || "").slice(0, 8)}</Typography.Text> },
              { title: "状态", dataIndex: "status", render: (s) => <Tag>{String(s)}</Tag> },
              { title: "执行器", dataIndex: "runner", render: (r) => String(r || "—") },
              { title: "时间", dataIndex: "created_at", render: (t) => String(t || "—") },
            ]}
          />
        </Card>
      )}

      {evidence.length > 0 && (
        <Card title="证据记录">
          <Table
            rowKey={(e) => String(e.id)}
            dataSource={evidence}
            columns={[
              { title: "学员", dataIndex: "learner_id", render: (id) => <Typography.Text code>{String(id || "").slice(0, 8)}</Typography.Text> },
              { title: "课次", dataIndex: "day", render: (d) => String(d ?? "—") },
              { title: "类型", dataIndex: "kind", render: (k) => String(k) },
              { title: "节点", dataIndex: "node_id", render: (n) => <Typography.Text code>{String(n || "—")}</Typography.Text> },
              { title: "时间", dataIndex: "ts", render: (t) => String(t || "—") },
            ]}
          />
        </Card>
      )}
    </div>
  );
}
