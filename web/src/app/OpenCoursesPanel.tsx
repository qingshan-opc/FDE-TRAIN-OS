import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { LandingOpenCourse, LandingOpenCourseCategory, LandingPayload } from "../lib/types";

type Props = {
  data: LandingPayload["open_courses"];
  categories?: LandingPayload["open_course_categories"];
};

function OpenCourseVideo({ course }: { course: LandingOpenCourse }) {
  const [tick, setTick] = useState(0);
  const [failed, setFailed] = useState(false);
  const src = course.stream_url
    ? `${course.stream_url}${course.stream_url.includes("?") ? "&" : "?"}v=${tick}`
    : null;

  useEffect(() => {
    setFailed(false);
  }, [course.id, course.stream_url]);

  if (!src) return <div className="landing-open-media-empty">媒资待上传</div>;

  return (
    <>
      <video
        key={src}
        controls
        playsInline
        preload="metadata"
        poster={course.poster_url || undefined}
        src={src}
        onError={() => setFailed(true)}
        onLoadedData={() => setFailed(false)}
        onCanPlay={() => setFailed(false)}
      >
        您的浏览器不支持视频播放。
      </video>
      {failed ? (
        <div className="landing-open-media-empty">
          <p className="muted" style={{ marginBottom: 8 }}>
            视频加载失败
          </p>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => {
              setFailed(false);
              setTick((t) => t + 1);
            }}
          >
            重试
          </button>
        </div>
      ) : null}
    </>
  );
}

export function OpenCoursesPanel({ data, categories }: Props) {
  const courses = (data || []).filter((c) => c.published !== false);
  const cats = useMemo(() => {
    const published = (categories || [])
      .filter((c) => c.published !== false)
      .slice()
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    // Only show categories that have at least one published course (or all if none matched)
    const withCourses = published.filter((cat) => courses.some((c) => c.category_id === cat.id));
    return withCourses.length > 0 ? withCourses : published;
  }, [categories, courses]);

  const uncategorized = courses.filter(
    (c) => !c.category_id || !cats.some((cat) => cat.id === c.category_id),
  );

  const tabs: Array<{ id: string; name: string }> = [
    ...cats.map((c) => ({ id: c.id, name: c.name })),
    ...(uncategorized.length > 0 && cats.length > 0
      ? [{ id: "__uncategorized__", name: "其他" }]
      : []),
  ];

  const defaultTab =
    tabs.find((t) =>
      t.id === "__uncategorized__"
        ? uncategorized.length > 0
        : courses.some((c) => c.category_id === t.id),
    )?.id || tabs[0]?.id;

  const [active, setActive] = useState<string | undefined>(undefined);
  const activeId = active && tabs.some((t) => t.id === active) ? active : defaultTab;

  const visible: LandingOpenCourse[] = useMemo(() => {
    if (!activeId) return courses;
    if (activeId === "__uncategorized__") return uncategorized;
    return courses.filter((c) => c.category_id === activeId);
  }, [activeId, courses, uncategorized]);

  return (
    <div className="landing-open-list">
      <p className="landing-eyebrow mono">OPEN COURSES</p>
      <h2 className="landing-panel-title">公开课</h2>
      {courses.length === 0 ? (
        <p className="muted">公开课视频待发布。教研可在后台「站点公开课」上传，不会用虚构案例充数。</p>
      ) : (
        <>
          {tabs.length > 1 ? (
            <div className="landing-open-tabs" role="tablist" aria-label="公开课分类">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={t.id === activeId}
                  className={`landing-open-tab${t.id === activeId ? " is-active" : ""}`}
                  onClick={() => setActive(t.id)}
                >
                  {t.name}
                </button>
              ))}
            </div>
          ) : null}
          <div className="landing-open-rail">
            {visible.map((c) => (
              <article className="landing-open-card" key={c.id}>
                <div className="landing-open-media">
                  <OpenCourseVideo course={c} />
                </div>
                <div className="landing-open-card-head">
                  {c.level && <span className="status-pill available">{c.level}</span>}
                  {typeof c.minutes === "number" && (
                    <span className="muted mono">{c.minutes} 分钟</span>
                  )}
                </div>
                <h3>{c.title}</h3>
                {c.summary && <p className="muted">{c.summary}</p>}
                <Link to="/app/shop" className="ink-btn ink-btn--ghost landing-open-card-cta">
                  登录选购完整营期 →
                </Link>
              </article>
            ))}
          </div>
          {visible.length === 0 ? (
            <p className="muted" style={{ marginTop: 12 }}>
              该分类下暂无公开课。
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}

// keep type exports reachable for consumers that import categories shape
export type { LandingOpenCourse, LandingOpenCourseCategory };
