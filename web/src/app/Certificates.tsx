import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { meApi, ApiError } from "../lib/api";
import { LearnerAccountLayout } from "../components/LearnerAccountLayout";
import { Skeleton } from "../components/Skeleton";
import { ErrorState } from "../components/ErrorState";
import { Empty } from "../components/Empty";
import type { CertificateItem, LearnerProfile } from "../lib/types";

const STATUS_LABEL: Record<string, string> = {
  issued: "已颁发",
  in_progress: "进行中",
  revoked: "已撤销",
};

const STATUS_CLASS: Record<string, string> = {
  issued: "passed",
  in_progress: "available",
  revoked: "",
};

export function Certificates() {
  const [items, setItems] = useState<CertificateItem[]>([]);
  const [profile, setProfile] = useState<LearnerProfile | null>(null);
  const [source, setSource] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [certRes, profileRes] = await Promise.all([meApi.certificates(), meApi.profile()]);
      setItems(certRes.items);
      setSource(certRes.source);
      setProfile(profileRes);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const identityOk = profile?.identity_status === "verified";

  return (
    <LearnerAccountLayout
      title="结业证书"
      subtitle="实名认证通过后由教研正式颁发；证书摘要上链存证，可在官网三要素核验。"
    >
      {!loading && !error && (
        <div className="cert-status-banner cert-status-banner--desktop">
          <div className={`cert-status-banner__item ${identityOk ? "ok" : ""}`}>
            <strong>实名认证</strong>
            <span>{identityOk ? "已完成" : "未完成"}</span>
            {!identityOk && (
              <Link to="/app/identity" className="app-btn app-btn--ghost app-btn--sm">
                去认证
              </Link>
            )}
          </div>
          <div className="cert-status-banner__item">
            <strong>上链存证</strong>
            <span>颁证后自动锚定</span>
          </div>
          <div className="cert-status-banner__item">
            <strong>公开核验</strong>
            <a href="/verify" className="app-btn app-btn--ghost app-btn--sm" target="_blank" rel="noreferrer">
              官网核验
            </a>
          </div>
        </div>
      )}

      {loading ? (
        <Skeleton rows={4} />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : items.length === 0 ? (
        <Empty
          title="暂无正式结业证书"
          description={
            identityOk
              ? "完成营期学习后，教研将颁发上链结业证书并在此展示"
              : "请先完成实名认证，再完成营期学习，由教研颁发正式证书"
          }
          actionLabel={identityOk ? "刷新" : "去实名认证"}
          onAction={() => {
            if (identityOk) void load();
            else window.location.assign("/app/identity");
          }}
        />
      ) : (
        <>
          {source === "legacy_evidence" && (
            <p className="muted cert-legacy-note">
              以下为学习进度摘要，非正式结业证书。完成实名认证并由教研颁证后，方可上链核验。
            </p>
          )}
          <div className="cert-list cert-list--desktop">
            {items.map((cert) => (
              <div key={cert.id} className="panel cert-card cert-card--desktop">
                <div className="cert-card__main">
                  <div className="cert-card__title-row">
                    <p style={{ fontWeight: 600, margin: 0 }}>{cert.course_title || cert.camp_id}</p>
                    {cert.on_chain && <span className="status-pill passed">已上链</span>}
                    {cert.legacy && <span className="status-pill locked">进度摘要</span>}
                  </div>
                  <p className="mono muted" style={{ margin: "6px 0 4px", fontSize: 12 }}>
                    {cert.cert_id || "证书编号待生成"}
                  </p>
                  {cert.chain_tx_hash && (
                    <p className="mono muted cert-chain-line" title={cert.chain_tx_hash}>
                      链上交易 {cert.chain_tx_hash.slice(0, 14)}…
                      {cert.chain_network ? ` · ${cert.chain_network}` : ""}
                    </p>
                  )}
                  <p className="muted" style={{ margin: 0, fontSize: 13 }}>
                    {cert.issued_at ? `颁发于 ${new Date(cert.issued_at).toLocaleDateString()}` : cert.legacy ? "尚未正式颁证" : "未颁发"}
                  </p>
                </div>
                <div className="row cert-card__actions">
                  <span className={`status-pill ${STATUS_CLASS[cert.status] || ""}`}>
                    {STATUS_LABEL[cert.status] || cert.status}
                  </span>
                  {cert.cert_id && !cert.legacy && (
                    <a
                      className="app-btn app-btn--ghost app-btn--sm"
                      href={`/verify?cert_id=${encodeURIComponent(cert.cert_id)}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      三要素核验 →
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </LearnerAccountLayout>
  );
}
