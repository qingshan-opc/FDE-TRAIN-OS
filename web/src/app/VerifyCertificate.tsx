import { useCallback, useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
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
  const { user } = useAuth();
  const { certId: routeCertId } = useParams();
  const [searchParams] = useSearchParams();
  const [site, setSite] = useState<LandingPayload>(FALLBACK);
  const [certId, setCertId] = useState(routeCertId || searchParams.get("cert_id") || "");
  const [realName, setRealName] = useState("");
  const [idTail, setIdTail] = useState("");
  const [result, setResult] = useState<CertificateVerifyResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

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

  const onVerify = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    const cid = certId.trim();
    const name = realName.trim();
    const tail = idTail.trim();
    if (!cid || !name || tail.length !== 6) {
      setError("请填写证书编号、姓名与身份证后六位");
      return;
    }
    setLoading(true);
    setError(null);
    setSubmitted(true);
    try {
      setResult(await certApi.verifyChallenge({ cert_id: cid, real_name: name, id_tail: tail }));
    } catch (err) {
      setResult(null);
      setError(err instanceof ApiError ? err.message : "核验失败");
    } finally {
      setLoading(false);
    }
  }, [certId, realName, idTail]);

  const ok = Boolean(result?.valid && result?.verified_identity);
  const brandName = site.brand?.name || "青山在";
  const appHref = user ? "/app/courses" : site.cta?.app || "/app/courses";

  return (
    <div className="landing landing-page-verify">
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
            输入证书编号、持证人姓名与身份证后六位。通过三要素匹配后，展示证书有效性及链上存证信息。
          </p>

          <form className="verify-form" onSubmit={(e) => void onVerify(e)}>
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
            <label className="identity-field">
              <span>持证人姓名</span>
              <input type="text" value={realName} onChange={(e) => setRealName(e.target.value)} placeholder="与身份证一致" />
            </label>
            <label className="identity-field">
              <span>身份证后六位</span>
              <input
                type="text"
                value={idTail}
                onChange={(e) => setIdTail(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="6 位数字"
                inputMode="numeric"
                maxLength={6}
                className="mono"
              />
            </label>
            <button type="submit" className="app-btn app-btn--primary verify-form__submit" disabled={loading}>
              {loading ? "核验中…" : "立即核验"}
            </button>
          </form>

          {loading ? (
            <Skeleton rows={4} />
          ) : error ? (
            <p className="verify-result verify-result--error">{error}</p>
          ) : submitted && result ? (
            <div className={`verify-result ${ok ? "verify-result--ok" : "verify-result--fail"}`}>
              <span className={`status-pill ${ok ? "passed" : "locked"}`} style={{ width: "fit-content" }}>
                {ok ? "证书有效 · 三要素通过" : "未通过核验"}
              </span>
              {!ok && result.message && <p className="muted">{result.message}</p>}
              {ok && (
                <div className="verify-result__detail">
                  <p>
                    <strong>课程：</strong>
                    {result.course_title || "—"}
                  </p>
                  <p>
                    <strong>持证人：</strong>
                    {result.learner_name || "—"}
                  </p>
                  <p>
                    <strong>颁发日期：</strong>
                    {result.issued_at ? new Date(result.issued_at).toLocaleDateString() : "—"}
                  </p>
                  {result.on_chain && result.chain_tx_hash && (
                    <>
                      <p>
                        <strong>链上网络：</strong>
                        {result.chain_network || "—"}
                      </p>
                      <p className="mono verify-chain-hash">
                        <strong>链上交易：</strong>
                        {result.chain_tx_hash}
                      </p>
                    </>
                  )}
                </div>
              )}
            </div>
          ) : null}

          <p className="verify-page-foot">
            <Link to="/">返回首页</Link>
            <span aria-hidden="true"> · </span>
            <Link to={VERIFY_PATH}>刷新本页</Link>
          </p>
        </div>
      </main>

      <LandingFooter brandName={brandName} appHref={appHref} contactEmail={site.contact?.email} />
    </div>
  );
}
