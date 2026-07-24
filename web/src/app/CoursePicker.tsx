import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { dayApi, meApi, progressApi, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import {
  buildCapabilityRadar,
  buildRecentActivity,
  type ActivityItem,
  type EvidenceItem,
} from "../lib/capabilityRadar";
import { resolveNextTarget, summarizeProgress, type ProgressSummary } from "../lib/taskTargets";
import type { DaySummary, EnrollmentRecord, Passport } from "../lib/types";
import { Nav } from "../components/Nav";
import { CapabilityRadar } from "../components/CapabilityRadar";
import { CourseProgressRing } from "../components/CourseProgressRing";
import { Skeleton } from "../components/Skeleton";
import { ErrorState } from "../components/ErrorState";
import { Empty } from "../components/Empty";
import { useToast } from "../components/Toast";

const STATUS_LABEL: Record<string, string> = {
  active: "进行中",
  pending: "待激活",
  completed: "已结业",
  cancelled: "已取消",
};

type CampProgress = ProgressSummary & { pendingTasks: number };

function StatIcon({ children }: { children: ReactNode }) {
  return <span className="course-stat-icon">{children}</span>;
}

export function CoursePicker() {
  const nav = useNavigate();
  const toast = useToast();
  const { user, switchEnrollment } = useAuth();
  const [items, setItems] = useState<EnrollmentRecord[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [dashLoading, setDashLoading] = useState(false);
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progressByCamp, setProgressByCamp] = useState<Record<string, CampProgress>>({});
  const [activeDays, setActiveDays] = useState<DaySummary[]>([]);
  const [passport, setPassport] = useState<Passport | null>(null);
  const [evidence, setEvidence] = useState<EvidenceItem[]>([]);
  const [recent, setRecent] = useState<ActivityItem[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await meApi.enrollments();
      setItems(res.items || []);
      setActiveId(res.active_enrollment_id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const activeEnrollment = useMemo(
    () => items.find((it) => it.enrollment_id === activeId) || items[0] || null,
    [items, activeId],
  );

  useEffect(() => {
    if (!user || !items.length) return;
    let cancelled = false;
    (async () => {
      setDashLoading(true);
      try {
        const campIds = [...new Set(items.map((it) => it.camp_id).filter(Boolean))] as string[];
        const progressMap: Record<string, CampProgress> = {};
        await Promise.all(
          campIds.map(async (campId) => {
            try {
              const res = await dayApi.list(campId);
              const summary = summarizeProgress(res.days, res.weeks);
              progressMap[campId] = { ...summary, pendingTasks: summary.pending };
              if (!cancelled && activeEnrollment?.camp_id === campId) {
                setActiveDays(res.days);
              }
            } catch {
              /* camp may be inactive */
            }
          }),
        );
        if (!cancelled) setProgressByCamp(progressMap);

        const [evRes, passRes] = await Promise.all([
          progressApi.evidence(user.id).catch(() => ({ items: [] as EvidenceItem[] })),
          progressApi.passport(user.id).catch(() => null),
        ]);
        if (cancelled) return;
        const evItems = (evRes.items || []) as EvidenceItem[];
        setEvidence(evItems);
        setPassport(passRes);
        setRecent(buildRecentActivity(evItems, 6));
      } finally {
        if (!cancelled) setDashLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, items, activeEnrollment?.camp_id]);

  const radarAxes = useMemo(() => buildCapabilityRadar(passport, evidence), [passport, evidence]);
  const activeProgress = activeEnrollment?.camp_id ? progressByCamp[activeEnrollment.camp_id] : null;
  const nextTarget = useMemo(() => resolveNextTarget(activeDays), [activeDays]);

  const stats = useMemo(() => {
    const activeCourses = items.filter((it) => it.status === "active").length;
    const avgPct =
      Object.values(progressByCamp).length > 0
        ? Math.round(Object.values(progressByCamp).reduce((s, p) => s + p.pct, 0) / Object.values(progressByCamp).length)
        : 0;
    return {
      courses: items.length,
      activeCourses,
      progress: activeProgress?.pct ?? avgPct,
      evidence: passport?.evidence_count ?? evidence.length,
      pending: activeProgress?.pendingTasks ?? 0,
      tracks: (passport?.tracks.agent ? 1 : 0) + (passport?.tracks.sim ? 1 : 0),
    };
  }, [items, progressByCamp, activeProgress, passport, evidence.length]);

  const onEnter = async (enrollmentId: string) => {
    setSwitchingId(enrollmentId);
    try {
      await switchEnrollment(enrollmentId);
      nav("/app");
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : "切换课程失败", "error");
    } finally {
      setSwitchingId(null);
    }
  };

  const onContinueActive = () => {
    if (!activeEnrollment) return;
    if (nextTarget) {
      nav(`/app/day/${nextTarget.day}?node=${encodeURIComponent(nextTarget.nodeId)}`);
      return;
    }
    void onEnter(activeEnrollment.enrollment_id);
  };

  return (
    <div className="course-picker-shell">
      <Nav variant="learner" />
      <div className="course-picker-page">
        {!loading && !error && items.length > 0 && (
          <div className="course-dashboard-stats">
            <div className="course-stat-card">
              <StatIcon>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                </svg>
              </StatIcon>
              <div>
                <span className="course-stat-label">已报名</span>
                <strong className="course-stat-value">{stats.courses}</strong>
                <span className="course-stat-hint">{stats.activeCourses} 门进行中</span>
              </div>
            </div>
            <div className="course-stat-card course-stat-card--accent">
              <CourseProgressRing pct={stats.progress} size={52} stroke={5} />
              <div>
                <span className="course-stat-label">当前进度</span>
                <strong className="course-stat-value">{stats.progress}%</strong>
                <span className="course-stat-hint">待办 {stats.pending} 项</span>
              </div>
            </div>
            <div className="course-stat-card">
              <StatIcon>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              </StatIcon>
              <div>
                <span className="course-stat-label">学习证据</span>
                <strong className="course-stat-value">{stats.evidence}</strong>
                <span className="course-stat-hint">Lab / 测验留痕</span>
              </div>
            </div>
            <div className="course-stat-card">
              <StatIcon>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2l3 7h7l-5.5 4 2 7L12 17l-6.5 3 2-7L2 9h7z" />
                </svg>
              </StatIcon>
              <div>
                <span className="course-stat-label">双轨认证</span>
                <strong className="course-stat-value">{stats.tracks}/2</strong>
                <span className="course-stat-hint">Agent · Sim</span>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <Skeleton rows={8} />
        ) : error ? (
          <ErrorState message={error} onRetry={() => void load()} />
        ) : items.length === 0 ? (
          <Empty
            title="暂无已报名课程"
            description="使用邀请码加入营期，或联系顾问了解企业培训与公开课"
            actionLabel="返回首页咨询"
            onAction={() => nav("/")}
          />
        ) : (
          <div className="course-dashboard-grid">
            <section className="course-dashboard-main">
              {activeEnrollment && (
                <article className="course-spotlight">
                  <div className="course-spotlight-visual" aria-hidden>
                    <div className="course-spotlight-orb course-spotlight-orb--a" />
                    <div className="course-spotlight-orb course-spotlight-orb--b" />
                    <div className="course-spotlight-grid" />
                    {activeProgress && (
                      <div className="course-spotlight-ring-wrap">
                        <CourseProgressRing pct={activeProgress.pct} size={88} stroke={6} />
                      </div>
                    )}
                  </div>
                  <div className="course-spotlight-body">
                    <span className="course-feature-badge">继续学习</span>
                    <h2>{activeEnrollment.course_title || activeEnrollment.offering_title || "未命名课程"}</h2>
                    {activeEnrollment.offering_title && activeEnrollment.offering_title !== activeEnrollment.course_title && (
                      <p className="course-spotlight-desc">{activeEnrollment.offering_title}</p>
                    )}
                    {activeProgress && (
                      <div className="course-spotlight-meta">
                        <span>
                          第 {activeProgress.weekLabel} · 已完成 {activeProgress.passed}/{activeProgress.total} 节点
                        </span>
                      </div>
                    )}
                    {activeProgress && (
                      <div className="course-progress-track" role="progressbar" aria-valuenow={activeProgress.pct}>
                        <div className="course-progress-track-fill" style={{ width: `${activeProgress.pct}%` }} />
                      </div>
                    )}
                    <div className="course-spotlight-actions">
                      <button type="button" className="btn-primary" onClick={onContinueActive}>
                        {nextTarget?.label ? `继续 · ${nextTarget.label}` : "进入课程工作台"}
                      </button>
                      {activeEnrollment.camp_id && <span className="course-spotlight-camp">营期 {activeEnrollment.camp_id}</span>}
                    </div>
                  </div>
                </article>
              )}

              <div className="course-section-head">
                <div>
                  <h2>我的课程</h2>
                  <p className="muted">点击卡片切换营期并进入学习</p>
                </div>
                <span className="course-section-count">{items.length} 门</span>
              </div>

              <div className="course-picker-grid">
                {items.map((it) => {
                  const active = it.enrollment_id === activeId;
                  const progress = it.camp_id ? progressByCamp[it.camp_id] : null;
                  const busy = switchingId === it.enrollment_id;
                  return (
                    <article
                      key={it.enrollment_id}
                      className={`course-card ${active ? "is-active" : ""} ${busy ? "is-busy" : ""}`}
                    >
                      <button
                        type="button"
                        className="course-card-hit"
                        disabled={busy}
                        onClick={() => void onEnter(it.enrollment_id)}
                      >
                        <div className="course-card-top">
                          <CourseProgressRing pct={progress?.pct ?? 0} size={42} stroke={4} />
                          <div className="course-card-titles">
                            <h3>{it.course_title || it.offering_title || "未命名课程"}</h3>
                            {it.offering_title && it.offering_title !== it.course_title && (
                              <p>{it.offering_title}</p>
                            )}
                          </div>
                          {active && <span className="course-card-badge">当前</span>}
                        </div>
                        <div className="course-card-meta">
                          {it.camp_id && <span className="course-card-camp">{it.camp_id}</span>}
                          <span className={`course-card-status course-card-status--${it.status}`}>
                            {STATUS_LABEL[it.status] || it.status}
                          </span>
                        </div>
                        {progress && (
                          <p className="course-card-foot">
                            进度 {progress.pct}% · 待办 {progress.pendingTasks}
                          </p>
                        )}
                        <span className="course-card-enter">{busy ? "切换中…" : active ? "进入课程 →" : "开始学习 →"}</span>
                      </button>
                    </article>
                  );
                })}
              </div>
            </section>

            <aside className="course-dashboard-radar">
              <section className="course-glass-card">
                <div className="course-glass-head">
                  <h3>能力雷达</h3>
                  <span className="course-glass-tag">能力护照</span>
                </div>
                <p className="course-aside-hint">从 Lab 证据与标签估算六维能力</p>
                {dashLoading && !passport ? <Skeleton rows={4} /> : <CapabilityRadar axes={radarAxes} />}
                {passport && (
                  <div className="course-passport-row">
                    <span className={`course-passport-chip ${passport.tracks.agent ? "ok" : ""}`}>Agent</span>
                    <span className={`course-passport-chip ${passport.tracks.sim ? "ok" : ""}`}>Sim</span>
                    <span className="course-passport-id mono">{passport.cert_id}</span>
                  </div>
                )}
              </section>
            </aside>

            <aside className="course-dashboard-records">
              <section className="course-glass-card course-glass-card--records">
                <div className="course-glass-head">
                  <h3>学习记录</h3>
                  <span className="course-glass-tag">{recent.length} 条</span>
                </div>
                {dashLoading && recent.length === 0 ? (
                  <Skeleton rows={3} />
                ) : recent.length === 0 ? (
                  <p className="course-empty-hint">完成 Lab 或测验后，记录会出现在这里</p>
                ) : (
                  <ul className="course-timeline">
                    {recent.map((item, idx) => (
                      <li key={item.id} className="course-timeline-item">
                        <span className="course-timeline-dot" data-first={idx === 0 ? "1" : undefined} />
                        {item.href ? (
                          <Link to={item.href} className="course-timeline-body">
                            <strong>{item.title}</strong>
                            <span>{item.subtitle}</span>
                            <time>{item.at}</time>
                          </Link>
                        ) : (
                          <div className="course-timeline-body">
                            <strong>{item.title}</strong>
                            <span>{item.subtitle}</span>
                            <time>{item.at}</time>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}
