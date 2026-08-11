import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { siteApi } from "../lib/api";
import type { LandingOpenCourse } from "../lib/types";
import { LANDING_FALLBACK_OPEN_COURSES } from "./landingShared";

const INTRO_ID = "fde-intro";

export function CourseIntro({ onContinue }: { onContinue: () => void }) {
  const [intro, setIntro] = useState<LandingOpenCourse | null>(null);
  const [loading, setLoading] = useState(true);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [retryTick, setRetryTick] = useState(0);

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

  useEffect(() => {
    setPlaybackError(null);
  }, [course?.stream_url, retryTick]);

  const streamSrc = course?.stream_url
    ? `${course.stream_url}${course.stream_url.includes("?") ? "&" : "?"}v=${retryTick}`
    : null;

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
        ) : streamSrc ? (
          <>
            <video
              key={streamSrc}
              controls
              playsInline
              preload="metadata"
              poster={course?.poster_url || undefined}
              src={streamSrc}
              onError={() => setPlaybackError("视频加载失败，媒资可能未就绪，请重试")}
              onLoadedData={() => setPlaybackError(null)}
              onCanPlay={() => setPlaybackError(null)}
            >
              您的浏览器不支持视频播放。
            </video>
            {playbackError ? (
              <div className="course-intro-media-error" role="alert">
                <p>{playbackError}</p>
                <button type="button" className="btn-ghost" onClick={() => setRetryTick((t) => t + 1)}>
                  重试
                </button>
              </div>
            ) : null}
          </>
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
