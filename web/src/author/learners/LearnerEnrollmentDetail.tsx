import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Breadcrumb, Card, Col, Row, Typography } from "antd";
import { authorApi, ApiError } from "../../lib/api";
import { PageHeader, ServerTable, useErrorModal } from "../../components/crud";
import { StatusTag } from "../../components/StatusTag";

type EnrollmentDetail = Awaited<ReturnType<typeof authorApi.getEnrollment>>;

export function LearnerEnrollmentDetail() {
  const { enrollmentId = "" } = useParams();
  const [data, setData] = useState<EnrollmentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await authorApi.getEnrollment(enrollmentId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "加载失败");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [enrollmentId]);

  useEffect(() => {
    void load();
  }, [load]);

  useErrorModal(error, { title: "加载失败", onRetry: () => void load() });

  const nodeRows = useMemo(
    () =>
      (data?.node_progress || []).map((r, i) => ({
        key: `${r.day}-${r.node_id}-${i}`,
        day: r.day,
        node_id: r.node_id,
        status: r.status,
        updated_at: r.updated_at,
      })),
    [data?.node_progress],
  );

  const capsuleRows = useMemo(
    () =>
      (data?.capsule_progress || []).map((r, i) => ({
        key: `${r.day}-${r.capsule_id}-${i}`,
        day: r.day,
        capsule_id: r.capsule_id,
        opened_at: r.opened_at,
      })),
    [data?.capsule_progress],
  );

  return (
    <div className="author-page author-page-detail">
      <Breadcrumb
        style={{ marginBottom: 12 }}
        items={[
          { title: <Link to="/author/learners">学员与课程</Link> },
          { title: data?.display_name || data?.email || enrollmentId.slice(0, 8) },
        ]}
      />
      <PageHeader
        title={data?.display_name || data?.email || "学员详情"}
        description={
          data
            ? `${data.course_title || "—"} · ${data.version_tag || "—"} · 总进度 ${Math.round(data.progress_pct || 0)}%`
            : "按课次节点与课节打开记录查看学习进度"
        }
      />
      <Row gutter={[16, 16]}>
        <Col xs={24} md={8}>
          <Card size="small" title="概览" loading={loading}>
            <Typography.Paragraph>
              <strong>状态</strong>：{data?.status ? <StatusTag status={data.status} domain="enrollment" /> : "—"}
            </Typography.Paragraph>
            <Typography.Paragraph>
              <strong>邮箱</strong>：{data?.email || "—"}
            </Typography.Paragraph>
            <Typography.Paragraph>
              <strong>提交物</strong>：{data?.submission_count ?? "—"}
            </Typography.Paragraph>
            <Typography.Paragraph>
              <strong>附件</strong>：{data?.attachment_count ?? "—"}
            </Typography.Paragraph>
            <Typography.Paragraph>
              <strong>导师复核</strong>：{(data?.mentor_reviews || []).filter((r) => r.status === "pending").length} 待处理
            </Typography.Paragraph>
            <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }}>
              节点 {nodeRows.length} · 课节打开 {capsuleRows.length}
            </Typography.Paragraph>
            <Link to="/author/learners/reviews">前往导师复核 →</Link>
          </Card>
        </Col>
        <Col xs={24} md={16}>
          <Card size="small" title="课次节点进度（learn / quiz / lab …）" loading={loading}>
            <ServerTable
              fitViewport={false}
              rowKey="key"
              loading={loading}
              data={{ items: nodeRows, total: nodeRows.length, page: 1, page_size: nodeRows.length || 20 }}
              onPageChange={() => {}}
              emptyDescription="暂无节点进度"
              columns={[
                { title: "Day", dataIndex: "day", width: 64 },
                { title: "节点", dataIndex: "node_id" },
                {
                  title: "状态",
                  dataIndex: "status",
                  render: (s: string) => <StatusTag status={s} />,
                },
                { title: "更新时间", dataIndex: "updated_at", responsive: ["md"] },
              ]}
            />
          </Card>
        </Col>
        <Col span={24}>
          <Card size="small" title="课节打开记录（capsule_progress）" loading={loading}>
            <ServerTable
              fitViewport={false}
              rowKey="key"
              loading={loading}
              data={{ items: capsuleRows, total: capsuleRows.length, page: 1, page_size: capsuleRows.length || 20 }}
              onPageChange={() => {}}
              emptyDescription="学员尚未打开任何课节"
              columns={[
                { title: "Day", dataIndex: "day", width: 64 },
                { title: "课节 ID", dataIndex: "capsule_id" },
                { title: "首次打开", dataIndex: "opened_at" },
              ]}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
