import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { Card, Col, Row, Skeleton, Statistic, Typography, Tooltip } from "antd";
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
  QuestionCircleOutlined,
} from "@ant-design/icons";
import { Link } from "react-router-dom";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
} from "recharts";
import { authorApi, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { PageHeader, useErrorModal } from "../components/crud";

type DayPoint = { date: string; users?: number; minutes?: number; count?: number; opens?: number };

type Overview = {
  courses: number;
  draft_versions: number;
  pending_submissions: number;
  pending_reviews?: number;
  documents: number;
  videos: number;
  videos_library?: number;
  videos_open_courses?: number;
  videos_site?: number;
  learners: number;
  open_courses?: number;
  paid_orders?: number;
  gross_fen?: number;
  shared_fen?: number;
  pending_share_fen?: number;
  learn_active_users_7d?: DayPoint[];
  learn_duration_minutes_7d?: DayPoint[];
  open_course_clicks_7d?: DayPoint[];
  capsule_opens_7d?: DayPoint[];
  submission_trend_7d?: DayPoint[];
  metrics_note?: Record<string, string>;
};

function yuanFromFen(fen: number | undefined) {
  return Number(fen || 0) / 100;
}

const KPIS: Array<{
  key: keyof Overview;
  title: string;
  icon: ReactNode;
  href?: string;
  tip?: string;
  format?: "money";
}> = [
  {
    key: "gross_fen",
    title: "已收款",
    icon: <InboxOutlined />,
    href: "/author/finance",
    tip: "全平台已支付订单金额（退款不计）",
    format: "money",
  },
  {
    key: "shared_fen",
    title: "已分账",
    icon: <TeamOutlined />,
    href: "/author/finance",
    tip: "微信分账状态为 finished 的金额",
    format: "money",
  },
  { key: "courses", title: "课程", icon: <BookOutlined /> },
  { key: "draft_versions", title: "草稿版本", icon: <BranchesOutlined />, href: "/author/curriculum/versions" },
  { key: "pending_submissions", title: "待处理提交", icon: <InboxOutlined />, href: "/author/learners/submissions" },
  { key: "pending_reviews", title: "待导师复核", icon: <TeamOutlined />, href: "/author/learners/reviews" },
  { key: "documents", title: "文档", icon: <FileTextOutlined />, href: "/author/resources/documents" },
  {
    key: "videos",
    title: "视频资源",
    icon: <PlaySquareOutlined />,
    href: "/author/resources/videos",
    tip: "视频库未删除 + 公开课视频 + 站点 Hero",
  },
  { key: "open_courses", title: "公开课", icon: <PlaySquareOutlined />, href: "/author/site/open-courses" },
  { key: "learners", title: "学员", icon: <TeamOutlined />, href: "/author/learners" },
];

const SHORTCUTS = [
  { title: "网站维护", desc: "站点信息 / 公开课 / 导师", href: "/author/site/settings", icon: <GlobalOutlined /> },
  { title: "资源中心", desc: "文档库 / 视频库 / 素材包", href: "/author/resources/documents", icon: <FolderOpenOutlined /> },
  { title: "课程设计", desc: "课程与大纲 / 版本", href: "/author/curriculum/courses", icon: <ReadOutlined /> },
  { title: "学员中心", desc: "报名 / 提交 / 导师复核", href: "/author/learners", icon: <TeamOutlined /> },
];

function shortDate(iso: string): string {
  // 2026-07-27 → 07-27
  return iso.length >= 10 ? iso.slice(5) : iso;
}

function ChartCard({
  title,
  tip,
  children,
  delay = 0,
}: {
  title: string;
  tip?: string;
  children: ReactNode;
  delay?: number;
}) {
  return (
    <Card
      size="small"
      className="anim-rise author-chart-card"
      style={{ "--i": delay } as CSSProperties}
      title={
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          {title}
          {tip ? (
            <Tooltip title={tip}>
              <QuestionCircleOutlined style={{ color: "var(--color-muted)", fontSize: 13 }} />
            </Tooltip>
          ) : null}
        </span>
      }
    >
      <div style={{ width: "100%", height: 220 }}>{children}</div>
    </Card>
  );
}

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
          setData(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [campId]);

  const chartRows = useMemo(() => {
    if (!data) return [];
    const users = data.learn_active_users_7d || [];
    const minutes = data.learn_duration_minutes_7d || [];
    const clicks = data.open_course_clicks_7d || [];
    const opens = data.capsule_opens_7d || [];
    const subs = data.submission_trend_7d || [];
    const n = Math.max(users.length, minutes.length, clicks.length, opens.length, subs.length, 7);
    const rows = [];
    for (let i = 0; i < n; i++) {
      const date = users[i]?.date || minutes[i]?.date || clicks[i]?.date || opens[i]?.date || subs[i]?.date || "";
      rows.push({
        date,
        label: shortDate(date),
        users: users[i]?.users ?? 0,
        minutes: minutes[i]?.minutes ?? 0,
        clicks: clicks[i]?.count ?? 0,
        opens: opens[i]?.opens ?? 0,
        submissions: subs[i]?.count ?? 0,
      });
    }
    return rows;
  }, [data]);

  const videoTip =
    data &&
    `库内 ${data.videos_library ?? 0} · 公开课 ${data.videos_open_courses ?? 0} · 站点 ${data.videos_site ?? 0}`;

  useErrorModal(error, {
    title: "概览加载失败",
    onRetry: () => window.location.reload(),
  });

  return (
    <div className="author-overview">
      <PageHeader title="概览" description="教研台运营指标、近 7 日趋势与快捷入口" />
      {loading ? (
        <Skeleton active paragraph={{ rows: 6 }} />
      ) : (
        <>
          {data && (
            <>
              <Row gutter={[12, 12]}>
                {KPIS.map((k, i) => {
                  const raw = data[k.key];
                  const num = typeof raw === "number" ? raw : 0;
                  const value = k.format === "money" ? yuanFromFen(num) : num;
                  const tip = k.key === "videos" ? videoTip || k.tip : k.tip;
                  const inner = (
                    <Card size="small" className="author-kpi anim-rise" style={{ "--i": i } as CSSProperties}>
                      <div className="author-kpi__icon" aria-hidden>
                        {k.icon}
                      </div>
                      <Statistic
                        title={
                          tip ? (
                            <Tooltip title={tip}>
                              <span>
                                {k.title} <QuestionCircleOutlined style={{ fontSize: 12 }} />
                              </span>
                            </Tooltip>
                          ) : (
                            k.title
                          )
                        }
                        prefix={k.format === "money" ? "¥" : undefined}
                        precision={k.format === "money" ? 2 : 0}
                        value={value}
                      />
                    </Card>
                  );
                  return (
                    <Col xs={12} sm={8} md={6} lg={3} key={String(k.key)}>
                      {k.href ? (
                        <Link to={k.href} style={{ textDecoration: "none", color: "inherit" }}>
                          {inner}
                        </Link>
                      ) : (
                        inner
                      )}
                    </Col>
                  );
                })}
              </Row>

              <Row gutter={[12, 12]} style={{ marginTop: 16 }}>
                <Col xs={24} lg={12}>
                  <ChartCard title="近 7 日学员学习人数" tip="当日打开过课节（capsule.open）的去重学员数" delay={1}>
                    <ResponsiveContainer>
                      <AreaChart data={chartRows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="gUsers" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#0d9488" stopOpacity={0.35} />
                            <stop offset="100%" stopColor="#0d9488" stopOpacity={0.02} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(15,46,42,0.08)" />
                        <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 12 }} width={36} />
                        <RechartsTooltip />
                        <Area type="monotone" dataKey="users" name="学习人数" stroke="#0d9488" fill="url(#gUsers)" strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </ChartCard>
                </Col>
                <Col xs={24} lg={12}>
                  <ChartCard
                    title="近 7 日学习时长（估算·分钟）"
                    tip={data.metrics_note?.learn_duration || "按课节打开次数估算"}
                    delay={2}
                  >
                    <ResponsiveContainer>
                      <BarChart data={chartRows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(15,46,42,0.08)" />
                        <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 12 }} width={40} />
                        <RechartsTooltip />
                        <Bar dataKey="minutes" name="分钟" fill="#159688" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartCard>
                </Col>
                <Col xs={24} lg={12}>
                  <ChartCard
                    title="近 7 日公开课点击人数"
                    tip={data.metrics_note?.open_course_clicks || "公开课视频播放去重人数"}
                    delay={3}
                  >
                    <ResponsiveContainer>
                      <AreaChart data={chartRows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="gClicks" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#2563eb" stopOpacity={0.3} />
                            <stop offset="100%" stopColor="#2563eb" stopOpacity={0.02} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(15,46,42,0.08)" />
                        <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 12 }} width={36} />
                        <RechartsTooltip />
                        <Area type="monotone" dataKey="clicks" name="点击人数" stroke="#2563eb" fill="url(#gClicks)" strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </ChartCard>
                </Col>
                <Col xs={24} lg={12}>
                  <ChartCard title="近 7 日课节打开 / 提交" tip="课节打开次数与作业提交条数对比" delay={4}>
                    <ResponsiveContainer>
                      <BarChart data={chartRows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(15,46,42,0.08)" />
                        <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 12 }} width={40} />
                        <RechartsTooltip />
                        <Legend />
                        <Bar dataKey="opens" name="课节打开" fill="#14b8a6" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="submissions" name="提交" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartCard>
                </Col>
              </Row>

              <Typography.Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0, fontSize: 12 }}>
                视频资源 = 视频库 {data.videos_library ?? 0} + 公开课视频 {data.videos_open_courses ?? 0} + 站点 Hero{" "}
                {data.videos_site ?? 0}
                。学习时长为估算值，非精确心跳计时。
              </Typography.Paragraph>

              <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
                {SHORTCUTS.map((s, i) => (
                  <Col xs={24} md={12} key={s.href}>
                    <Link to={s.href} style={{ textDecoration: "none" }}>
                      <Card size="small" className="author-shortcut anim-rise" style={{ "--i": 8 + i } as CSSProperties}>
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
            </>
          )}
        </>
      )}
    </div>
  );
}
