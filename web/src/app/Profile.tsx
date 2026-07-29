import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { meApi, authApi, ApiError } from "../lib/api";
import type { UserAttribution } from "../lib/types";
import { LearnerAccountLayout } from "../components/LearnerAccountLayout";
import { Skeleton } from "../components/Skeleton";
import { ErrorState } from "../components/ErrorState";
import { useToast } from "../components/Toast";
import { MemoriesUploader } from "../components/coach/MemoriesUploader";
import {
  IconAccountCertificate,
  IconAccountIdentity,
  IconSectionCamp,
  IconSectionProfile,
} from "../components/learnerAccountIcons";
import { IDENTITY_CLASS, IDENTITY_LABEL } from "./profileShared";
import type { LearnerProfile } from "../lib/types";

function navUserLabel(profile: LearnerProfile): string {
  const name = profile.display_name?.trim();
  if (name && /[\u4e00-\u9fff]/.test(name)) return name;
  if (profile.identity_masked_name) return profile.identity_masked_name.replace(/\*+$/, "") || "学员";
  return "学员";
}

export function Profile() {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [data, setData] = useState<LearnerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [attribution, setAttribution] = useState<UserAttribution | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const profile = await meApi.profile();
      setData(profile);
      setDisplayName(profile.display_name || "");
      const me = await authApi.me();
      setAttribution(me.attribution || null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onSaveName = async () => {
    if (!displayName.trim()) return;
    setSaving(true);
    try {
      const profile = await meApi.updateProfile({ display_name: displayName.trim() });
      setData(profile);
      toast.push("已保存", "success");
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : "保存失败", "error");
    } finally {
      setSaving(false);
    }
  };

  const onAvatarChange = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      const res = await meApi.uploadAvatar(file);
      setData(res.profile);
      toast.push("头像已更新", "success");
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : "上传失败", "error");
    } finally {
      setUploading(false);
    }
  };

  const label = data ? navUserLabel(data) : "学员";

  return (
    <LearnerAccountLayout title="个人中心" subtitle="管理账号资料、实名认证与结业证书">
      {loading ? (
        <Skeleton rows={8} />
      ) : error || !data ? (
        <ErrorState message={error || "暂无数据"} onRetry={() => void load()} />
      ) : (
        <>
          <div className="profile-overview-grid">
            <section className="panel profile-base-panel">
              <h2 className="profile-section-title">
                <IconSectionProfile className="profile-section-title__icon" />
                基本资料
              </h2>
              <div className="profile-header profile-header--desktop">
                <button
                  type="button"
                  className="profile-avatar profile-avatar--lg profile-avatar--upload"
                  onClick={() => fileRef.current?.click()}
                  aria-label="上传头像"
                >
                  {data.avatar_url ? (
                    <img src={data.avatar_url} alt="" className="profile-avatar__img" />
                  ) : (
                    label[0]?.toUpperCase() || "学"
                  )}
                  <span className="profile-avatar__badge">{uploading ? "…" : "更换头像"}</span>
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  hidden
                  onChange={(e) => void onAvatarChange(e.target.files?.[0])}
                />
                <div className="profile-base-panel__fields">
                  <label className="personnel-field">
                    <span className="muted">显示名称</span>
                    <div className="personnel-field__row">
                      <input
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="中文昵称"
                      />
                      <button
                        type="button"
                        className="app-btn app-btn--ghost app-btn--sm"
                        disabled={saving}
                        onClick={() => void onSaveName()}
                      >
                        {saving ? "保存中…" : "保存"}
                      </button>
                    </div>
                  </label>
                  <div className="profile-meta-row">
                    <span className="muted">登录邮箱</span>
                    <span className="mono">{data.email}</span>
                  </div>
                  <div className="row profile-badge-row">
                    <span className="status-pill">角色 {data.role === "learner" ? "学员" : data.role === "author" ? "教研" : "管理员"}</span>
                    <span className={`status-pill ${IDENTITY_CLASS[data.identity_status] || ""}`}>
                      实名 {IDENTITY_LABEL[data.identity_status] || data.identity_status}
                    </span>
                  </div>
                </div>
              </div>
            </section>

            <section className="panel profile-base-panel">
              <h2 className="profile-section-title">渠道归属</h2>
              {attribution ? (
                <div className="profile-meta-row">
                  <span className="muted">已绑定机构</span>
                  <span>
                    {attribution.org_name || attribution.org_id}
                    {attribution.invite_code ? ` · ${attribution.invite_code}` : ""}
                  </span>
                </div>
              ) : (
                <p className="muted" style={{ margin: 0, lineHeight: 1.55 }}>
                  未绑定机构渠道。机构归因仅支持通过机构提供的注册链接完成注册时自动绑定，注册后不支持自行填写邀请码。
                </p>
              )}
            </section>

            <section className="panel profile-status-panel">
              <h2 className="profile-section-title">
                <IconAccountIdentity className="profile-section-title__icon" />
                认证与证书
              </h2>
              <div className="profile-status-cards">
                <Link to="/app/identity" className="profile-status-card">
                  <span className="profile-status-card__icon" aria-hidden>
                    <IconAccountIdentity />
                  </span>
                  <div className="profile-status-card__body">
                  <span className="profile-status-card__label">实名认证</span>
                  <strong>{IDENTITY_LABEL[data.identity_status] || data.identity_status}</strong>
                  <p className="muted">
                    {data.identity_status === "verified"
                      ? `${data.identity_masked_name || "—"} · 后六位 ${data.identity_id_tail || "—"}`
                      : "完成实名后方可颁发正式结业证书"}
                  </p>
                  <span className="profile-status-card__link">{data.identity_status === "verified" ? "查看详情" : "去认证"}</span>
                  </div>
                </Link>
                <Link to="/app/certificates" className="profile-status-card">
                  <span className="profile-status-card__icon" aria-hidden>
                    <IconAccountCertificate />
                  </span>
                  <div className="profile-status-card__body">
                  <span className="profile-status-card__label">结业证书</span>
                  <strong>我的证书</strong>
                  <p className="muted">教研颁发、链上存证，支持官网三要素核验</p>
                  <span className="profile-status-card__link">查看证书</span>
                  </div>
                </Link>
              </div>
            </section>
          </div>

          <section className="panel profile-camps-panel">
            <h2 className="profile-section-title">
              <IconSectionCamp className="profile-section-title__icon" />
              我的营期
            </h2>
            {data.camps.length === 0 ? (
              <p className="muted" style={{ margin: 0 }}>
                暂未加入任何营期
              </p>
            ) : (
              <div className="row profile-camps-row">
                {data.camps.map((c) => (
                  <span key={c.id} className="status-pill mono">
                    {c.name || c.id}
                  </span>
                ))}
              </div>
            )}
          </section>

          <MemoriesUploader />
        </>
      )}
    </LearnerAccountLayout>
  );
}
