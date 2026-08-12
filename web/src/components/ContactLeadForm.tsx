import { useState, type FormEvent } from "react";
import { siteApi } from "../lib/api";
import { LANDING_FOOTER_BUSINESS_EMAIL } from "../app/landingShared";

type Props = {
  emailFallback?: string;
  title?: string;
  subtitle?: string;
  compact?: boolean;
};

export function ContactLeadForm({
  emailFallback = LANDING_FOOTER_BUSINESS_EMAIL,
  title = "预约培训咨询",
  subtitle = "企业、高校与政府组织 — 留下需求，顾问将在 1 个工作日内回复。",
  compact = false,
}: Props) {
  const [name, setName] = useState("");
  const [org, setOrg] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mailto = `mailto:${emailFallback}?subject=${encodeURIComponent("培训咨询")}`;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("请填写姓名");
      return;
    }
    setBusy(true);
    setError(null);
    setOk(false);
    try {
      await siteApi.contact({
        name: trimmed,
        org: org.trim() || undefined,
        email: email.trim() || undefined,
        message: message.trim() || undefined,
      });
      setOk(true);
      setName("");
      setOrg("");
      setEmail("");
      setMessage("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "提交失败，请稍后重试或使用邮件联系");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`landing-contact-form${compact ? " landing-contact-form--compact" : ""}`}>
      {!compact ? (
        <div style={{ marginBottom: 16 }}>
          <h2 style={{ margin: "0 0 8px" }}>{title}</h2>
          {subtitle ? <p className="muted" style={{ margin: 0 }}>{subtitle}</p> : null}
        </div>
      ) : null}

      <form onSubmit={onSubmit} noValidate>
        <div className="ink-field">
          <label htmlFor="contact-lead-name">姓名 *</label>
          <input
            id="contact-lead-name"
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoComplete="name"
            placeholder="您的姓名"
          />
        </div>
        <div className="ink-field">
          <label htmlFor="contact-lead-org">组织 / 单位</label>
          <input
            id="contact-lead-org"
            name="org"
            value={org}
            onChange={(e) => setOrg(e.target.value)}
            autoComplete="organization"
            placeholder="公司或机构名称"
          />
        </div>
        <div className="ink-field">
          <label htmlFor="contact-lead-email">邮箱</label>
          <input
            id="contact-lead-email"
            name="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            placeholder="方便回复的邮箱"
          />
        </div>
        <div className="ink-field">
          <label htmlFor="contact-lead-message">需求说明</label>
          <textarea
            id="contact-lead-message"
            name="message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={compact ? 3 : 4}
            className="landing-contact-form__textarea"
            placeholder="组织规模、培训目标、期望开课时间等"
          />
        </div>

        {error ? <p className="ink-err-msg" role="alert">{error}</p> : null}
        {ok ? (
          <p className="muted landing-contact-form__ok" role="status">
            已收到，顾问将尽快与您联系。
          </p>
        ) : null}

        <div className="landing-contact-form__actions">
          <button type="submit" className="ink-btn ink-btn--ochre" disabled={busy}>
            {busy ? "提交中…" : "提交咨询"}
          </button>
          <a className="ink-btn ink-btn--ghost" href={mailto}>
            或发邮件
          </a>
        </div>
      </form>
    </div>
  );
}
