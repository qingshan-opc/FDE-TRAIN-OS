import { useEffect, useState } from "react";
import { Card, Col, Row, Skeleton, Statistic, Typography, List, Space, theme } from "antd";
import { Link } from "react-router-dom";
import { authorApi, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { PageHeader } from "../components/crud";

type Overview = {
  courses: number;
  draft_versions: number;
  pending_submissions: number;
  documents: number;
  videos: number;
  learners: number;
  recent_actions?: { title: string; at?: string; href?: string }[];
};

const SHORTCUTS = [
  { title: "网站维护", desc: "站点信息 / 公开课 / 导师", href: "/author/site/settings" },
  { title: "资源中心", desc: "文档库 / 视频库 / 素材包", href: "/author/resources/documents" },
  { title: "课程设计", desc: "课程与大纲 / 版本", href: "/author/curriculum/courses" },
  { title: "学员中心", desc: "报名 / 提交资料", href: "/author/learners" },
];

export function AuthorOverview() {
  const { campId } = useAuth();
  const { token } = theme.useToken();
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await authorApi.overview(campId || undefined);
        if (!cancelled) setData(res);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "概览加载失败");
          setData({
            courses: 0,
            draft_versions: 0,
            pending_submissions: 0,
            documents: 0,
            videos: 0,
            learners: 0,
            recent_actions: [],
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [campId]);

  return (
    <div>
      <PageHeader title="概览" description="教研台运营指标与快捷入口" />
      {loading ? (
        <Skeleton active paragraph={{ rows: 4 }} />
      ) : (
        <>
          {error && (
            <Typography.Text type="secondary" style={{ display: "block", marginBottom: 12 }}>
              {error}（已显示占位数据）
            </Typography.Text>
          )}
          <Row gutter={[16, 16]}>
            <Col xs={12} md={8} lg={4}>
              <Card size="small"><Statistic title="课程" value={data?.courses ?? 0} /></Card>
            </Col>
            <Col xs={12} md={8} lg={4}>
              <Card size="small"><Statistic title="草稿版本" value={data?.draft_versions ?? 0} /></Card>
            </Col>
            <Col xs={12} md={8} lg={4}>
              <Card size="small"><Statistic title="待处理提交" value={data?.pending_submissions ?? 0} /></Card>
            </Col>
            <Col xs={12} md={8} lg={4}>
              <Card size="small"><Statistic title="文档" value={data?.documents ?? 0} /></Card>
            </Col>
            <Col xs={12} md={8} lg={4}>
              <Card size="small"><Statistic title="视频" value={data?.videos ?? 0} /></Card>
            </Col>
            <Col xs={12} md={8} lg={4}>
              <Card size="small"><Statistic title="学员" value={data?.learners ?? 0} /></Card>
            </Col>
          </Row>

          <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
            {SHORTCUTS.map((s) => (
              <Col xs={24} md={12} key={s.href}>
                <Link to={s.href} style={{ textDecoration: "none" }}>
                  <Card hoverable size="small" style={{ borderColor: token.colorBorderSecondary }}>
                    <Typography.Title level={5} style={{ margin: 0 }}>
                      {s.title}
                    </Typography.Title>
                    <Typography.Text type="secondary">{s.desc}</Typography.Text>
                  </Card>
                </Link>
              </Col>
            ))}
          </Row>

          <Card size="small" title="最近操作" style={{ marginTop: 16 }}>
            <List
              locale={{ emptyText: "暂无最近操作" }}
              dataSource={data?.recent_actions || []}
              renderItem={(item) => (
                <List.Item>
                  <Space>
                    {item.href ? <Link to={item.href}>{item.title}</Link> : item.title}
                    {item.at && <Typography.Text type="secondary">{item.at}</Typography.Text>}
                  </Space>
                </List.Item>
              )}
            />
          </Card>
        </>
      )}
    </div>
  );
}
