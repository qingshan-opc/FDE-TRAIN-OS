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

function usePresignedUrl(objectKey: string | undefined, campId: string | null | undefined) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (!objectKey) return;
    setLoading(true);
    setError(null);
    try {
      const res = await mediaApi.presign(objectKey, campId || undefined);
      setUrl(res.url);
    } catch (err) {
      setUrl(null);
      setError(err instanceof ApiError ? err.message : "媒资加载失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [objectKey, campId]);

  return { url, error, loading, retry: () => void load() };
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
  const { url, error, loading, retry } = usePresignedUrl(media.object_key, campId);
  const poster = usePresignedUrl(media.poster_key, campId);
  const captions = usePresignedUrl(media.captions_vtt_key, campId);
  const [playbackError, setPlaybackError] = useState<string | null>(null);

  const retryPlayback = () => {
    setPlaybackError(null);
    retry();
  };

  return (
    <section className="media-block media-video" aria-label={media.title || "视频"}>
      {media.title && <h4 className="media-title">{media.title}</h4>}
      {loading && <p className="muted">视频加载中…</p>}
      {error && <ErrorState title="视频不可用" message={error} onRetry={retry} />}
      {playbackError && !error && (
        <ErrorState title="视频播放失败" message={playbackError} onRetry={retryPlayback} />
      )}
      {/* Keep the <video> mounted even after a probe error — some MinIO
          presigned URLs reject HEAD while GET still works, and hiding the
          element on the first error makes the learner-facing player vanish. */}
      {url && (
        <div className="media-video-frame">
          <video
            key={url}
            controls
            playsInline
            preload="none"
            src={url}
            poster={poster.url || undefined}
            onEnded={onEnded}
            onError={() => setPlaybackError("视频加载或播放出错，请重试")}
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
  }, [lines, url]);

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
        {loading && <p className="muted">音频加载中…</p>}
        {error && <ErrorState title="语音不可用" message={error} onRetry={retry} />}
        {url && <audio ref={audioRef} controls preload="metadata" src={url} onEnded={onEnded} />}
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
            key={`${m.kind}-${m.object_key}-${i}`}
            media={m}
            campId={campId}
            onEnded={onMediaEnded ? () => onMediaEnded(m) : undefined}
          />
        ) : (
          <CapsuleAudioScreen
            key={`${m.kind}-${m.object_key}-${i}`}
            media={m}
            campId={campId}
            onEnded={onMediaEnded ? () => onMediaEnded(m) : undefined}
          />
        ),
      )}
    </div>
  );
}
