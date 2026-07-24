import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { progressApi, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import type { Passport } from "../lib/types";
import {
  buildCapabilityRadar,
  buildRecentActivity,
  groupCapabilityTags,
  type EvidenceItem,
} from "../lib/capabilityRadar";
import { CapabilityRadar } from "../components/CapabilityRadar";
import { ErrorState } from "../components/ErrorState";
import { Skeleton } from "../components/Skeleton";
import { Empty } from "../components/Empty";

export function PassportView() {
  const { user } = useAuth();
  const [data, setData] = useState<Passport | null>(null);
  const [evidence, setEvidence] = useState<EvidenceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const [passRes, evRes] = await Promise.all([
        progressApi.passport(user.id),
        progressApi.evidence(user.id).catch(() => ({ items: [] as Record<string, unknown>[] })),
      ]);
      setData(passRes);
      setEvidence((evRes.items || []) as EvidenceItem[]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const radarAxes = useMemo(() => buildCapabilityRadar(data, evidence), [data, evidence]);
  const tagGroups = useMemo(() => groupCapabilityTags(data?.capability_tags || []), [data]);
  const recent = useMemo(() => buildRecentActivity(evidence, 5), [evidence]);
  const learningDays = useMemo(
    () => new Set(evidence.map((e) => e.day).filter((d): d is number => typeof d === "number")).size,
    [evidence],
  );

  if (loading) return <Skeleton rows={8} />;
  if (error) return <ErrorState message={error} onRetry={() => void load()} />;
  if (!data) {
    return (
      <Empty
        title="暂无能力护照"
        description="完成 Lab 实训并写入学习证据后，系统会自动生成双轨认证摘要"
        actionLabel="刷新"
        onAction={() => void load()}
      />
    );
  }

  const trackDone = (data.tracks.agent ? 1 : 0) + (data.tracks.sim ? 1 : 0);

  return (
    <div className="passport-view">
      <header className="passport-view__head">
        <div>
          <h2>能力护照</h2>
          <p className="muted">双轨认证摘要 · 基于学习证据自动汇总</p>
        </div>
        <button type="button" className="app-btn app-btn--ghost app-btn--sm" onClick={() => void load()}>
          刷新
        </button>
      </header>

      <div className="passport-view__cert panel">
        <p className="muted">证书编号</p>
        <p className="mono passport-view__cert-id">{data.cert_id}</p>
        <p className="passport-view__disclaimer">{data.disclaimer}</p>
        <div className="passport-view__tracks">
          <span className={`status-pill ${data.tracks.agent ? "passed" : "locked"}`}>
            Agent {data.tracks.agent ? "已认证" : "未达成"}
          </span>
          <span className={`status-pill ${data.tracks.sim ? "passed" : "locked"}`}>
            Sim {data.tracks.sim ? "已认证" : "未达成"}
          </span>
          <span className="status-pill">
            学习证据 <span className="num">{data.evidence_count}</span>
          </span>
        </div>
      </div>

      <div className="passport-view__stats">
        <div className="passport-stat">
          <span className="passport-stat__label">双轨认证</span>
          <strong className="passport-stat__value">{trackDone}/2</strong>
          <span className="passport-stat__hint">Agent · Sim</span>
        </div>
        <div className="passport-stat">
          <span className="passport-stat__label">学习证据</span>
          <strong className="passport-stat__value">{data.evidence_count}</strong>
          <span className="passport-stat__hint">Lab / 测验留痕</span>
        </div>
        <div className="passport-stat">
          <span className="passport-stat__label">活跃天数</span>
          <strong className="passport-stat__value">{learningDays}</strong>
          <span className="passport-stat__hint">有记录的学习日</span>
        </div>
        <div className="passport-stat">
          <span className="passport-stat__label">能力标签</span>
          <strong className="passport-stat__value">{data.capability_tags.length}</strong>
          <span className="passport-stat__hint">自动汇总</span>
        </div>
      </div>

      <div className="passport-view__split">
        <section className="panel passport-view__radar">
          <h3>能力雷达</h3>
          <p className="muted passport-view__section-hint">从 Lab 证据与标签估算六维能力</p>
          <CapabilityRadar axes={radarAxes} />
        </section>

        <section className="panel passport-view__tags">
          <h3>能力标签</h3>
          <p className="muted passport-view__section-hint">按认证、进度与平台技能分组</p>
          {tagGroups.length === 0 ? (
            <p className="muted">完成实训与测验后，标签会自动出现</p>
          ) : (
            <div className="passport-tag-groups">
              {tagGroups.map((group) => (
                <div key={group.title} className="passport-tag-group">
                  <p className="passport-tag-group__title">{group.title}</p>
                  <div className="passport-tag-group__items">
                    {group.items.map((label) => (
                      <span key={label} className="status-pill">
                        {label}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="panel passport-view__recent">
        <div className="passport-view__recent-head">
          <h3>最近学习</h3>
          {recent.length > 0 && <span className="passport-view__recent-count">{recent.length} 条</span>}
        </div>
        {recent.length === 0 ? (
          <p className="muted">完成 Lab 或测验后，记录会出现在这里</p>
        ) : (
          <ul className="passport-recent-list">
            {recent.map((item) => (
              <li key={item.id} className="passport-recent-item">
                <div className="passport-recent-item__main">
                  {item.href ? (
                    <Link to={item.href} className="passport-recent-item__title">
                      {item.title}
                    </Link>
                  ) : (
                    <span className="passport-recent-item__title">{item.title}</span>
                  )}
                  <span className="muted">{item.subtitle}</span>
                </div>
                <time className="passport-recent-item__time">{item.at}</time>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
