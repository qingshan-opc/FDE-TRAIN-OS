import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { meApi, ApiError } from "../lib/api";
import { LearnerAccountLayout } from "../components/LearnerAccountLayout";
import { Skeleton } from "../components/Skeleton";
import { ErrorState } from "../components/ErrorState";
import { useToast } from "../components/Toast";
import { IDENTITY_LABEL } from "./profileShared";
import type { LearnerProfile } from "../lib/types";

export function Identity() {
  const toast = useToast();
  const [data, setData] = useState<LearnerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [realName, setRealName] = useState("");
  const [idNumber, setIdNumber] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await meApi.profile());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!realName.trim()) {
      toast.push("请填写真实姓名", "error");
      return;
    }
    if (idNumber.trim().length < 6) {
      toast.push("请填写有效的身份证号码", "error");
      return;
    }
    setStarting(true);
    try {
      const res = await meApi.startIdentity({ real_name: realName.trim(), id_number: idNumber.trim() });
      toast.push(res.status === "verified" ? "实名认证已通过" : "已提交实名认证申请", "success");
      void load();
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : "提交失败", "error");
    } finally {
      setStarting(false);
    }
  };

  const status = data?.identity_status || "unverified";

  return (
    <LearnerAccountLayout
      title="实名认证"
      subtitle="完成实名认证后，方可颁发上链结业证书；平台仅保存打码后的姓名与身份证后六位。"
    >
      {loading ? (
        <Skeleton rows={6} />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : (
        <>
          <div className="personnel-steps personnel-steps--desktop">
            <div className={`personnel-step ${status === "verified" ? "is-done" : status === "pending" ? "is-active" : ""}`}>
              <span>1</span>
              <p>提交身份信息</p>
            </div>
            <div className={`personnel-step ${status === "verified" ? "is-done" : ""}`}>
              <span>2</span>
              <p>平台核验</p>
            </div>
            <div className={`personnel-step ${status === "verified" ? "is-done" : ""}`}>
              <span>3</span>
              <p>颁发上链证书</p>
            </div>
          </div>

          <div className="panel stack identity-panel">
            <div className="row">
              <span className="muted">当前状态</span>
              <span className={`status-pill ${status === "verified" ? "passed" : status === "pending" ? "available" : "locked"}`}>
                {IDENTITY_LABEL[status] || status}
              </span>
            </div>

            {status === "verified" ? (
              <div className="identity-verified-card">
                <p style={{ margin: "0 0 8px", fontWeight: 600 }}>实名信息（打码展示）</p>
                <div className="identity-verified-grid">
                  <div>
                    <span className="muted">姓名</span>
                    <strong>{data?.identity_masked_name || "—"}</strong>
                  </div>
                  <div>
                    <span className="muted">身份证后六位</span>
                    <strong className="mono">{data?.identity_id_tail ? `******${data.identity_id_tail}` : "—"}</strong>
                  </div>
                </div>
                <p className="muted" style={{ margin: "12px 0 0" }}>
                  结业证书将以该实名信息上链存证，可通过官网三要素核验。
                </p>
                <Link to="/app/certificates" className="app-btn app-btn--primary app-btn--sm" style={{ marginTop: 12 }}>
                  查看结业证书
                </Link>
              </div>
            ) : status === "pending" ? (
              <p className="muted" style={{ margin: 0 }}>
                认证审核中，请留意结果通知。审核通过后即可由教研颁发正式结业证书。
              </p>
            ) : (
              <form className="identity-form identity-form--desktop" onSubmit={(e) => void onSubmit(e)}>
                <div className="identity-form__grid">
                  <label className="identity-field">
                    <span>真实姓名</span>
                    <input
                      type="text"
                      value={realName}
                      onChange={(e) => setRealName(e.target.value)}
                      placeholder="与身份证一致的姓名"
                      autoComplete="name"
                    />
                  </label>
                  <label className="identity-field">
                    <span>身份证号码</span>
                    <input
                      type="text"
                      value={idNumber}
                      onChange={(e) => setIdNumber(e.target.value.replace(/\s/g, ""))}
                      placeholder="18 位身份证号"
                      autoComplete="off"
                      inputMode="numeric"
                      maxLength={18}
                    />
                  </label>
                </div>
                <p className="muted identity-form__hint">
                  依据合规要求，完整身份证号不会存入平台数据库，仅保留末六位用于证书公开核验。
                </p>
                <button type="submit" className="app-btn app-btn--primary" disabled={starting}>
                  {starting ? "提交中…" : "提交实名认证"}
                </button>
              </form>
            )}
          </div>
        </>
      )}
    </LearnerAccountLayout>
  );
}
