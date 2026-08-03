import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { siteApi } from "../lib/api";
import type { LandingOpenCourse } from "../lib/types";
import { LANDING_FALLBACK_OPEN_COURSES } from "./landingShared";

const INTRO_ID = "fde-intro";

export function CourseIntro({ onContinue }: { onContinue: () => void }) {
  const [intro, setIntro] = useState<LandingOpenCourse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await siteApi.landing();
        const found =
          (data.open_courses || []).find((c) => c.id === INTRO_ID && c.published !== false) || null;
        if (!cancelled) setIntro(found);
      } catch {
        if (!cancelled) setIntro(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const course = useMemo(() => {
    if (intro?.stream_url) return intro;
    return LANDING_FALLBACK_OPEN_COURSES.find((c) => c.id === INTRO_ID) || null;
  }, [intro]);

  return (
    <div className="course-intro" aria-label="课程介绍">
      <header className="course-intro-head anim-rise" style={{ "--i": 0 } as CSSProperties}>
        <div>
          <p className="course-intro-kicker">课程介绍</p>
          <h1>{course?.title || "FDE 训练营导论"}</h1>
          {course?.summary && <p className="course-intro-sub muted">{course.summary}</p>}
        </div>
        <button type="button" className="btn-primary course-intro-continue" onClick={onContinue}>
          进入学习
        </button>
      </header>

      <div className="course-intro-media anim-rise" style={{ "--i": 1 } as CSSProperties}>
        {loading && !course?.stream_url ? (
          <div className="course-intro-media-empty muted">加载课程介绍视频…</div>
        ) : course?.stream_url ? (
          <video
            key={course.stream_url}
            controls
            playsInline
            preload="metadata"
            poster={course.poster_url || undefined}
            src={course.stream_url}
          >
            您的浏览器不支持视频播放。
          </video>
        ) : (
          <div className="course-intro-media-empty muted">课程介绍视频待上传</div>
        )}
      </div>

      {course?.level && (
        <p className="course-intro-meta muted anim-rise" style={{ "--i": 2 } as CSSProperties}>
          {course.level}
          {typeof course.minutes === "number" ? ` · 约 ${course.minutes} 分钟` : ""}
        </p>
      )}
    </div>
  );
}
