import { useEffect, useMemo, useRef, useState } from "react";
import { mediaApi, ApiError } from "../lib/api";
import type { CapsuleMedia } from "../lib/types";
import { ErrorState } from "./ErrorState";

function parseTranscript(transcript: string): { t: number | null; text: string; raw: string }[] {
  return transcript
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((raw) => {
      const m = raw.match(/^(\d{1,2}):(\d{2})\s+(.+)$/);
      if (m) {
        const t = Number(m[1]) * 60 + Number(m[2]);
        return { t, text: m[3], raw };
      }
      return { t: null, text: raw, raw };
    });
}

/** Tear down a media element so the previous Range stream is fully released. */
function disposeMediaElement(el: HTMLMediaElement | null) {
  if (!el) return;
  try {
    el.pause();
    // Clear sources without el.load() — load() after empty src fires a noisy
    // MEDIA_ERR_SRC_NOT_SUPPORTED that races with the next lesson's player.
    el.removeAttribute("src");
    while (el.firstChild) el.removeChild(el.firstChild);
    el.removeAttribute("srcObject");
  } catch {
    /* ignore dispose races during unmount */
  }
}

/**
 * Presign with stale-while-revalidate: keep the previous URL while refreshing
 * the same objectKey so the <video> does not unmount/flash (common in local
 * Vite→API→MinIO Range streams + React StrictMode remounts).
 */
function usePresignedUrl(objectKey: string | undefined, campId: string | null | undefined) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [tick, setTick] = useState(0);
  const loadedKeyRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    if (!objectKey) {
      loadedKeyRef.current = undefined;
      setUrl(null);
      setError(null);
      setLoading(false);
      return;
    }

    const switched = loadedKeyRef.current !== objectKey;
    if (switched) {
      loadedKeyRef.current = objectKey;
      // Only blank the player when switching lessons — not on retry/StrictMode.
      setUrl(null);
      setError(null);
    }

    setLoading(true);
    (async () => {
      try {
        const res = await mediaApi.presign(objectKey, campId || undefined);
        if (cancelled) return;
        // Cache-bust only on explicit retry; first load stays stable.
        const next =
          tick > 0
            ? `${res.url}${res.url.includes("?") ? "&" : "?"}_r=${tick}`
            : res.url;
        setUrl(next);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : "媒资加载失败");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [objectKey, campId, tick]);

  return { url, error, loading, retry: () => setTick((t) => t + 1) };
}

function isAbortMediaError(el: HTMLMediaElement): boolean {
  const err = el.error;
  // MEDIA_ERR_ABORTED = 1：切换 src / 卸载时常见，不是真实播放失败
  return !err || err.code === err.MEDIA_ERR_ABORTED || err.code === 1;
}

function PendingVideoPlaceholder({ title }: { title?: string }) {
  return (
    <section className="media-block media-block--pending" aria-label={title || "视频待上传"}>
      <div className="media-pending">
        <strong>{title || "口播课件"}</strong>
        <p>视频待上传。可先完成下方知识卡片与概念验收答题，视频上线后回看即可。</p>
      </div>
    </section>
  );
}

export function CapsuleVideo({
  media,
  campId,
  onEnded,
}: {
  media: CapsuleMedia;
  campId?: string | null;
  onEnded?: () => void;
}) {
  const pending = !media.object_key || Boolean(media.pending);
  const objectKey = pending ? undefined : media.object_key;
  const { url, error, loading, retry } = usePresignedUrl(objectKey, campId);
  const poster = usePresignedUrl(pending ? undefined : media.poster_key, campId);
  const captions = usePresignedUrl(pending ? undefined : media.captions_vtt_key, campId);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const errorTimerRef = useRef<number | null>(null);
  const playGenerationRef = useRef(0);
  const autoRetryRef = useRef(0);
  const disposingRef = useRef(false);

  // 换课时清空错误态，避免上一课的失败横幅残留到下一课
  useEffect(() => {
    setPlaybackError(null);
    autoRetryRef.current = 0;
    disposingRef.current = false;
    if (errorTimerRef.current != null) {
      window.clearTimeout(errorTimerRef.current);
      errorTimerRef.current = null;
    }
    playGenerationRef.current += 1;
  }, [objectKey]);

  // 仅在卸载或切换课节时释放旧流；同课 URL 刷新不 dispose，避免播放中闪黑
  useEffect(() => {
    const el = videoRef.current;
    return () => {
      disposingRef.current = true;
      disposeMediaElement(el);
      if (errorTimerRef.current != null) {
        window.clearTimeout(errorTimerRef.current);
        errorTimerRef.current = null;
      }
    };
  }, [objectKey]);

  const retryPlayback = () => {
    setPlaybackError(null);
    autoRetryRef.current = 0;
    retry();
  };

  const onVideoError = () => {
    if (disposingRef.current) return;
    const el = videoRef.current;
    if (!el || isAbortMediaError(el)) return;
    // Local Vite proxy → MinIO often emits a transient network error during
    // Range seeks while the buffer is already healthy — ignore those.
    if (el.currentTime > 0.15 && el.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      return;
    }
    const gen = playGenerationRef.current;
    if (errorTimerRef.current != null) window.clearTimeout(errorTimerRef.current);
    errorTimerRef.current = window.setTimeout(() => {
      if (playGenerationRef.current !== gen) return;
      if (disposingRef.current) return;
      const cur = videoRef.current;
      if (!cur || isAbortMediaError(cur)) return;
      if (cur.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) return;
      if (cur.currentTime > 0.15) return;
      // Soft retry: keep current element; only re-presign with cache buster.
      if (autoRetryRef.current < 1) {
        autoRetryRef.current += 1;
        retry();
        return;
      }
      setPlaybackError("视频加载或播放出错，请重试");
    }, 400);
  };

  const clearTransientError = () => {
    if (errorTimerRef.current != null) {
      window.clearTimeout(errorTimerRef.current);
      errorTimerRef.current = null;
    }
    setPlaybackError(null);
    autoRetryRef.current = 0;
  };

  if (pending) {
    return <PendingVideoPlaceholder title={media.title} />;
  }

  return (
    <section className="media-block media-video" aria-label={media.title || "视频"}>
      {media.title && <h4 className="media-title">{media.title}</h4>}
      {loading && !url && <p className="muted">视频加载中…</p>}
      {error && <ErrorState title="视频不可用" message={error} onRetry={retry} />}
      {playbackError && !error && (
        <ErrorState title="视频播放失败" message={playbackError} onRetry={retryPlayback} />
      )}
      {/* Keep the <video> mounted even after a probe error — some MinIO
          stream URLs reject HEAD while GET still works, and hiding the
          element on the first error makes the learner-facing player vanish. */}
      {url && (
        <div className="media-video-frame">
          <video
            key={objectKey || "video"}
            ref={videoRef}
            controls
            playsInline
            preload="auto"
            src={url}
            poster={poster.url || undefined}
            onEnded={onEnded}
            onError={onVideoError}
            onLoadedData={clearTransientError}
            onCanPlay={clearTransientError}
            onPlaying={clearTransientError}
          >
            {captions.url && (
              <track kind="captions" src={captions.url} srcLang="zh" label="中文字幕" default />
            )}
            您的浏览器不支持视频播放。
          </video>
        </div>
      )}
    </section>
  );
}

export function CapsuleAudioScreen({
  media,
  campId,
  onEnded,
}: {
  media: CapsuleMedia;
  campId?: string | null;
  onEnded?: () => void;
}) {
  const { url, error, loading, retry } = usePresignedUrl(media.object_key, campId);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const lines = useMemo(() => parseTranscript(media.transcript || ""), [media.transcript]);

  useEffect(() => {
    const el = audioRef.current;
    return () => disposeMediaElement(el);
  }, [media.object_key]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el || !lines.some((l) => l.t != null)) return;
    const onTime = () => {
      const t = el.currentTime;
      let idx = 0;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].t != null && (lines[i].t as number) <= t + 0.25) idx = i;
      }
      setActiveIdx(idx);
    };
    el.addEventListener("timeupdate", onTime);
    return () => el.removeEventListener("timeupdate", onTime);
  }, [lines, media.object_key]);

  const seek = (t: number | null) => {
    if (t == null || !audioRef.current) return;
    audioRef.current.currentTime = t;
    void audioRef.current.play();
  };

  return (
    <section className="media-block media-audio-screen" aria-label={media.title || "语音屏"}>
      <div className="media-audio-bar">
        <div>
          <h4 className="media-title">{media.title || "语音讲解"}</h4>
          {media.duration_sec != null && <p className="muted num">约 {media.duration_sec}s</p>}
        </div>
        {loading && !url && <p className="muted">音频加载中…</p>}
        {error && <ErrorState title="语音不可用" message={error} onRetry={retry} />}
        {url && (
          <audio
            key={media.object_key || "audio"}
            ref={audioRef}
            controls
            preload="auto"
            src={url}
            onEnded={onEnded}
          />
        )}
      </div>
      {lines.length > 0 && (
        <div className="media-transcript" role="list">
          {lines.map((line, i) => (
            <button
              key={`${i}-${line.raw}`}
              type="button"
              role="listitem"
              className={`media-transcript-line ${i === activeIdx ? "is-active" : ""} ${
                line.t != null ? "is-seekable" : ""
              }`}
              onClick={() => seek(line.t)}
              disabled={line.t == null}
            >
              {line.t != null && (
                <span className="media-ts num">
                  {String(Math.floor(line.t / 60)).padStart(2, "0")}:
                  {String(Math.floor(line.t % 60)).padStart(2, "0")}
                </span>
              )}
              <span>{line.text}</span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

export function CapsuleMediaStack({
  items,
  campId,
  onMediaEnded,
}: {
  items?: CapsuleMedia[];
  campId?: string | null;
  /** Optional — fired when a video/audio item finishes playing (e.g. to
   * auto-mark a capsule as "watched"). */
  onMediaEnded?: (media: CapsuleMedia) => void;
}) {
  if (!items?.length) return null;
  return (
    <div className="media-stack">
      {items.map((m, i) =>
        m.kind === "video" ? (
          <CapsuleVideo
            key={`${m.kind}-${m.object_key || m.title || "video"}-${i}`}
            media={m}
            campId={campId}
            onEnded={onMediaEnded ? () => onMediaEnded(m) : undefined}
          />
        ) : (
          <CapsuleAudioScreen
            key={`${m.kind}-${m.object_key || m.title || "audio"}-${i}`}
            media={m}
            campId={campId}
            onEnded={onMediaEnded ? () => onMediaEnded(m) : undefined}
          />
        ),
      )}
    </div>
  );
}
