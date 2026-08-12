import { useEffect, useState } from "react";
import { ContactLeadForm } from "../components/ContactLeadForm";
import { LandingFooter } from "../components/LandingFooter";
import { LandingTopbar } from "../components/LandingTopbar";
import { siteApi } from "../lib/api";
import { useAuth } from "../lib/auth";
import { applyPageSeo, SITE_DEFAULT_TITLE } from "../lib/seo";
import type { LandingPayload } from "../lib/types";
import {
  FALLBACK_LANDING_TABS,
  LANDING_FALLBACK_OPEN_COURSES,
} from "./landingShared";
import {
  resolveAbout,
  resolveFooter,
  resolvePartners,
  resolveRouteSeo,
} from "./resolveLandingContent";

const SLOGAN = "为政府、高校与企业交付可验收的数字化人才训练";

const FALLBACK: LandingPayload = {
  title: "青山在",
  tagline: SLOGAN,
  hero_video: null,
  open_courses: LANDING_FALLBACK_OPEN_COURSES,
  brand: { name: "青山在" },
  cta: { login: "/login", app: "/app/courses" },
  tabs: FALLBACK_LANDING_TABS,
  about: {
    title: "关于我们",
    body: "青山在是新一代数字化人才训练品牌，由青山OPC & 灵栖智能运营。我们面向政府、高校与企业，交付可验收、可留痕、可核验的 FDE 训练营与机构培训项目。",
  },
};

export function AboutPage() {
  const { user, defaultHome } = useAuth();
  const [data, setData] = useState<LandingPayload>(FALLBACK);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await siteApi.landing();
        if (!cancelled) setData(res);
      } catch {
        if (!cancelled) setData(FALLBACK);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return applyPageSeo(resolveRouteSeo("about", data), SITE_DEFAULT_TITLE);
  }, [data]);

  const brandName = data.brand?.name || "青山在";
  const appHref = user ? defaultHome || "/app/courses" : data.cta?.app || "/app/courses";
  const about = resolveAbout(data.about);
  const partners = resolvePartners(data.partners);
  const footer = resolveFooter(data.footer);
  const contactEmail = data.contact?.email || footer.email;

  return (
    <div className="mk-home ink-site landing-page-about">
      <LandingTopbar
        activeTab="about"
        headerSolid
        brandName={brandName}
        loginHref={data.cta?.login || "/login"}
        appHref={appHref}
        user={user}
        tabs={data.tabs}
      />

      <main className="landing-about-page">
        <section className="landing-about-hero">
          <div className="landing-section-inner">
            <p className="landing-about-eyebrow mono">ABOUT QINGSHANZAI</p>
            <h1>{about.title || "关于我们"}</h1>
            <p className="landing-about-lead">{about.body}</p>
          </div>
        </section>

        <section className="landing-about-story">
          <div className="landing-section-inner landing-about-story__grid">
            {(about.story || []).map((block) => (
              <p key={block.slice(0, 24)} className="landing-about-story__p">
                {block}
              </p>
            ))}
          </div>
        </section>

        <section className="landing-about-pillars">
          <div className="landing-section-inner">
            <h2 className="landing-about-section-title">我们在做什么</h2>
            <div className="landing-about-pillars__grid">
              {(about.pillars || []).map((p) => (
                <article key={p.n} className="landing-about-pillar">
                  <span className="landing-about-pillar__n mono">{p.n}</span>
                  <h3>{p.title}</h3>
                  <p>{p.desc}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="landing-about-partners landing-about-section">
          <div className="landing-section-inner">
            <h2 className="landing-about-section-title">{about.partners_title || "合作伙伴"}</h2>
            <p className="landing-about-section__lead">
              {about.partners_lead || "与政府、高校与园区同行，持续交付可验收的数字化人才训练项目"}
            </p>
            <div className="landing-partners__grid landing-about-partners__grid">
              {partners.map((p) => (
                <article key={p.id} className="landing-partners__card">
                  <div className="landing-partners__logo">
                    <img src={p.logo} alt={p.logoAlt} loading="lazy" />
                  </div>
                  <p className="landing-partners__name">{p.name}</p>
                  <p className="landing-partners__tagline">{p.tag}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="landing-about-contact">
          <div className="landing-section-inner" style={{ maxWidth: 560 }}>
            <ContactLeadForm
              emailFallback={contactEmail}
              title={data.contact?.title || "预约培训咨询"}
              subtitle={
                data.contact?.subtitle ||
                data.contact?.note ||
                "企业、高校与政府组织 — 留下需求，顾问将在 1 个工作日内回复。"
              }
            />
            <p className="muted landing-about-contact__meta" style={{ marginTop: 16 }}>
              {contactEmail} · {footer.office}
            </p>
          </div>
        </section>
      </main>

      <LandingFooter
        brandName={brandName}
        appHref={appHref}
        footer={data.footer}
        contactEmail={contactEmail}
      />
    </div>
  );
}
