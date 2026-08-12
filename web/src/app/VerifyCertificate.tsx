import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { certApi, siteApi, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { LandingTopbar } from "../components/LandingTopbar";
import { LandingFooter } from "../components/LandingFooter";
import { Skeleton } from "../components/Skeleton";
import { FALLBACK_LANDING_TABS, VERIFY_PATH } from "./landingShared";
import type { CertificateVerifyResult, LandingPayload } from "../lib/types";

const FALLBACK: LandingPayload = {
  title: "青山在",
  tagline: "",
  brand: { name: "青山在" },
  cta: { login: "/login", app: "/app/courses" },
  tabs: FALLBACK_LANDING_TABS,
  hero_video: null,
};

export function VerifyCertificate() {
  const { user, defaultHome } = useAuth();
  const nav = useNavigate();
  const { certId: routeCertId } = useParams();
  const [searchParams] = useSearchParams();
  const [site, setSite] = useState<LandingPayload>(FALLBACK);
  const [certId, setCertId] = useState(routeCertId || searchParams.get("cert_id") || "");
  const [publicResult, setPublicResult] = useState<CertificateVerifyResult | null>(null);
  const [publicLoading, setPublicLoading] = useState(false);
  const [publicError, setPublicError] = useState<string | null>(null);
  const [publicSubmitted, setPublicSubmitted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void siteApi.landing().then((res) => {
      if (!cancelled) setSite(res);
    }).catch(() => {
      if (!cancelled) setSite(FALLBACK);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (routeCertId) setCertId(routeCertId);
    else {
      const q = searchParams.get("cert_id");
      if (q) setCertId(q);
    }
  }, [routeCertId, searchParams]);

  const onPublicLookup = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    const cid = certId.trim();
    if (!cid) {
      setPublicError("请填写证书编号");
      return;
    }
    setPublicLoading(true);
    setPublicError(null);
    setPublicSubmitted(true);
    try {
      setPublicResult(await certApi.verify(cid));
    } catch (err) {
      setPublicResult(null);
      setPublicError(err instanceof ApiError ? err.message : "查询失败");
    } finally {
      setPublicLoading(false);
    }
  }, [certId]);

  useEffect(() => {
    if (routeCertId?.trim()) {
      void onPublicLookup();
    }
  }, [routeCertId]); // eslint-disable-line react-hooks/exhaustive-deps

  const chainPublic = publicResult?.chain_public;
  const txHash = chainPublic?.tx_hash || publicResult?.chain_tx_hash;
  const hasChainPublic = Boolean(txHash || chainPublic?.holder_name);
  const chainOnly = Boolean(publicResult?.chain_only);
  const publicOk = Boolean(publicResult?.valid);
  const notFound = publicSubmitted && publicResult && !publicOk && !hasChainPublic;
  const brandName = site.brand?.name || "青山在";
  const appHref = user ? defaultHome || "/app/courses" : site.cta?.app || "/app/courses";

  const goToChainDetail = () => {
    if (txHash) {
      nav(`/chain/tx/${txHash}`);
    }
  };

  return (
    <div className="mk-home ink-site landing-page-verify">
      <LandingTopbar
        activeTab="verify"
        headerSolid
        brandName={brandName}
        loginHref={site.cta?.login || "/login"}
        appHref={appHref}
        user={user}
        tabs={site.tabs}
      />

      <main className="verify-page-main">
        <div className="verify-card panel">
          <p className="verify-page-eyebrow">官方核验</p>
          <h1>结业证书公开核验</h1>
          <p className="muted verify-page-lead">
            输入证书编号查询链上存证，进入链上详情页后可输入完整身份证号进行本地哈希核验。
          </p>

          <form className="verify-form" onSubmit={(e) => void onPublicLookup(e)}>
            <label className="identity-field">
              <span>证书编号</span>
              <input
                type="text"
                value={certId}
                onChange={(e) => setCertId(e.target.value)}
                placeholder="如 FDE-XXXXXXXXXX"
                className="mono"
              />
            </label>
            <button type="submit" className="ink-btn ink-btn--ochre verify-form__submit" disabled={publicLoading}>
              {publicLoading ? "查询中…" : "查询"}
            </button>
          </form>

          {publicLoading ? (
            <Skeleton rows={4} />
          ) : publicError ? (
            <p className="verify-result verify-result--error">{publicError}</p>
          ) : publicSubmitted && publicResult ? (
            <div className={`verify-result ${publicOk || hasChainPublic ? "verify-result--ok" : "verify-result--fail"}`}>
              <span
                className={`status-pill ${publicOk ? "passed" : hasChainPublic ? "passed" : "locked"}`}
                style={{ width: "fit-content" }}
              >
                {notFound
                  ? "未找到证书"
                  : publicResult.status === "revoked"
                    ? "证书已撤销"
                    : chainOnly
                      ? "链上可查"
                      : publicOk
                        ? "证书有效"
                        : "证书无效"}
              </span>
              {publicResult.message && !notFound && <p className="muted">{publicResult.message}</p>}
              {(publicOk || hasChainPublic) && (
                <div className="verify-result__detail">
                  <p>
                    <strong>课程：</strong>
                    {publicResult.course_title || chainPublic?.course_title || "—"}
                  </p>
                  {chainPublic?.holder_name && (
                    <p>
                      <strong>链上姓名：</strong>
                      {chainPublic.holder_name}
                    </p>
                  )}
                </div>
              )}
              {txHash && (publicOk || hasChainPublic) && (
                <div className="verify-result__actions">
                  <button type="button" className="ink-btn ink-btn--ochre" onClick={goToChainDetail}>
                    查看链上详情并核验
                  </button>
                  <p className="muted verify-result__hint">
                    在链上交易详情页点击「证书核验」，输入完整身份证号即可完成本地哈希比对。
                  </p>
                </div>
              )}
              {!txHash && hasChainPublic && (
                <p className="muted">该记录暂无链上交易哈希，请前往链浏览器搜索证书编号。</p>
              )}
            </div>
          ) : null}

          <p className="verify-page-foot">
            <Link to="/">返回首页</Link>
            <span aria-hidden="true"> · </span>
            <Link to="/chain">证书链浏览器</Link>
            <span aria-hidden="true"> · </span>
            <Link to={VERIFY_PATH}>刷新本页</Link>
          </p>
        </div>
      </main>

      <LandingFooter brandName={brandName} appHref={appHref} />
    </div>
  );
}
