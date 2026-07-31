import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { dayApi } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Skeleton } from "../components/Skeleton";
import { ErrorState } from "../components/ErrorState";
import { CapsuleSimTerminal, type CapsuleSimConfig } from "../components/learn/CapsuleSimTerminal";

/**
 * 独立全屏仿真实验台：从课节「全屏新窗口打开」进入。
 */
export function CapsuleSimLabPage() {
  const { day: dayParam, capsuleId = "" } = useParams<{ day: string; capsuleId: string }>();
  const day = Number(dayParam);
  const { campId } = useAuth();
  const [lab, setLab] = useState<CapsuleSimConfig | null>(null);
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [fsOn, setFsOn] = useState(false);

  useEffect(() => {
    document.title = title ? `实验台 · ${title}` : "仿真服务器实验台";
    return () => {
      document.title = "青山在 · FDE 训练营";
    };
  }, [title]);

  useEffect(() => {
    const onFs = () => setFsOn(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  useEffect(() => {
    if (!campId || !Number.isFinite(day) || day < 1 || !capsuleId) {
      setError("无效的实验台链接");
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    void dayApi
      .get(campId, day)
      .then((pkg) => {
        if (cancelled) return;
        const cap = (pkg.learn?.capsules || []).find((c) => c.id === capsuleId);
        const raw = cap?.lab as CapsuleSimConfig | undefined;
        if (!raw?.sim_kind) {
          setError("该课节没有仿真实验配置");
          setLab(null);
          return;
        }
        setTitle(cap?.title || capsuleId);
        setLab(raw);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "加载实验失败");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [campId, day, capsuleId]);

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      /* 部分浏览器需用户手势；已用大窗口兜底 */
    }
  };

  const closeTab = () => {
    // 新标签页通常没有 opener；能关则关，否则回课节
    window.close();
    window.setTimeout(() => {
      if (!document.hidden) {
        window.location.assign(`/app/day/${day}?node=d${day}-learn`);
      }
    }, 150);
  };

  return (
    <div className="capsule-sim-page">
      <header className="capsule-sim-page-bar">
        <div className="capsule-sim-page-brand">
          <span className="capsule-sim-page-kicker mono">fde-server · fullscreen</span>
          <h1>{title || "仿真服务器实验台"}</h1>
        </div>
        <div className="capsule-sim-page-actions">
          <button type="button" className="btn-ghost" onClick={() => void toggleFullscreen()}>
            {fsOn ? "退出浏览器全屏" : "浏览器全屏"}
          </button>
          <Link className="btn-ghost" to={`/app/day/${day}?node=d${day}-learn`}>
            返回课节
          </Link>
          <button type="button" className="btn-primary" onClick={closeTab}>
            关闭标签页
          </button>
        </div>
      </header>
      <main className="capsule-sim-page-body">
        {loading && (
          <div style={{ padding: 24 }}>
            <Skeleton rows={8} />
          </div>
        )}
        {!loading && error && <ErrorState message={error} />}
        {!loading && !error && lab && (
          <CapsuleSimTerminal day={day} capsuleId={capsuleId} lab={lab} variant="fullscreen" autoStart />
        )}
      </main>
    </div>
  );
}
