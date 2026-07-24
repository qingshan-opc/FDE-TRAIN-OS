import { Link } from "react-router-dom";
import type { LandingPayload } from "../lib/types";

export function OpenCoursesPanel({ data }: { data: LandingPayload["open_courses"] }) {
  const courses = data || [];
  const playable = courses.filter((c) => c.published !== false);
  return (
    <div className="landing-open-list">
      <p className="landing-eyebrow mono">OPEN COURSES</p>
      <h2 className="landing-panel-title">公开课</h2>
      {playable.length === 0 ? (
        <p className="muted">公开课视频待发布。教研可在后台「站点公开课」上传，不会用虚构案例充数。</p>
      ) : (
        <div className="landing-open-rail">
          {playable.map((c) => (
            <article className="landing-open-card" key={c.id}>
              <div className="landing-open-media">
                {c.stream_url ? (
                  <video
                    controls
                    playsInline
                    preload="none"
                    poster={c.poster_url || undefined}
                    src={c.stream_url}
                  >
                    您的浏览器不支持视频播放。
                  </video>
                ) : (
                  <div className="landing-open-media-empty">媒资待上传</div>
                )}
              </div>
              <div className="landing-open-card-head">
                {c.level && <span className="status-pill available">{c.level}</span>}
                {typeof c.minutes === "number" && <span className="muted mono">{c.minutes} 分钟</span>}
              </div>
              <h3>{c.title}</h3>
              {c.summary && <p className="muted">{c.summary}</p>}
              <Link to="/login" className="btn-ghost landing-open-card-cta">
                报名完整营期 →
              </Link>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
