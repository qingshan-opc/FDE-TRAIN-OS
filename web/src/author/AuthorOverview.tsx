import { useEffect, useState, type CSSProperties } from "react";
import { Card, Col, Row, Skeleton, Statistic, Typography, List, Space } from "antd";
import {
  BookOutlined,
  BranchesOutlined,
  FileTextOutlined,
  FolderOpenOutlined,
  GlobalOutlined,
  InboxOutlined,
  PlaySquareOutlined,
  ReadOutlined,
  TeamOutlined,
  ArrowRightOutlined,
} from "@ant-design/icons";
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

const KPIS = [
  { key: "courses", title: "课程", icon: <BookOutlined /> },
  { key: "draft_versions", title: "草稿版本", icon: <BranchesOutlined /> },
  { key: "pending_submissions", title: "待处理提交", icon: <InboxOutlined /> },
  { key: "documents", title: "文档", icon: <FileTextOutlined /> },
  { key: "videos", title: "视频", icon: <PlaySquareOutlined /> },
  { key: "learners", title: "学员", icon: <TeamOutlined /> },
] as const;

const SHORTCUTS = [
  { title: "网站维护", desc: "站点信息 / 公开课 / 导师", href: "/author/site/settings", icon: <GlobalOutlined /> },
  { title: "资源中心", desc: "文档库 / 视频库 / 素材包", href: "/author/resources/documents", icon: <FolderOpenOutlined /> },
  { title: "课程设计", desc: "课程与大纲 / 版本", href: "/author/curriculum/courses", icon: <ReadOutlined /> },
  { title: "学员中心", desc: "报名 / 提交资料", href: "/author/learners", icon: <TeamOutlined /> },
];

export function AuthorOverview() {
  const { campId } = useAuth();
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
            {KPIS.map((k, i) => (
              <Col xs={12} md={8} lg={4} key={k.key}>
                <Card size="small" className="author-kpi anim-rise" style={{ "--i": i } as CSSProperties}>
                  <div className="author-kpi__icon" aria-hidden>
                    {k.icon}
                  </div>
                  <Statistic title={k.title} value={data?.[k.key] ?? 0} />
                </Card>
              </Col>
            ))}
          </Row>

          <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
            {SHORTCUTS.map((s, i) => (
              <Col xs={24} md={12} key={s.href}>
                <Link to={s.href} style={{ textDecoration: "none" }}>
                  <Card size="small" className="author-shortcut anim-rise" style={{ "--i": 6 + i } as CSSProperties}>
                    <div className="author-shortcut__icon" aria-hidden>
                      {s.icon}
                    </div>
                    <div className="author-shortcut__body">
                      <Typography.Title level={5} style={{ margin: 0 }}>
                        {s.title}
                      </Typography.Title>
                      <Typography.Text type="secondary">{s.desc}</Typography.Text>
                    </div>
                    <ArrowRightOutlined className="author-shortcut__arrow" aria-hidden />
                  </Card>
                </Link>
              </Col>
            ))}
          </Row>

          <Card size="small" title="最近操作" className="anim-rise" style={{ marginTop: 16, "--i": 10 } as CSSProperties}>
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
