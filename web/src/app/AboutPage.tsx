import { useEffect, useState } from "react";
import { LandingTopbar } from "../components/LandingTopbar";
import { LandingFooter } from "../components/LandingFooter";
import { siteApi } from "../lib/api";
import { useAuth } from "../lib/auth";
import type { LandingPayload } from "../lib/types";
import {
  ABOUT_PILLARS,
  FALLBACK_LANDING_TABS,
  LANDING_FALLBACK_OPEN_COURSES,
  LANDING_FOOTER_BUSINESS_EMAIL,
  LANDING_FOOTER_OFFICE,
  LANDING_FOOTER_TRAINING_EMAIL,
  LANDING_PARTNERS,
} from "./landingShared";

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
    body: "青山在是新一代数字化人才训练品牌，由杭州灵梧智能科技有限公司运营。我们面向政府、高校与企业，交付可验收、可留痕、可核验的 FDE 训练营与机构培训项目。",
  },
};

const STORY_BLOCKS = [
  "传统培训擅长讲知识与演示工具，却难以回答一个关键问题：学员回到岗位后，能否独立交付可验收的成果？青山在从第一天就把「交付物」写进课纲，把「证据链」写进过程，把「可核验证书」写进结业标准。",
  "FDE Learning OS 是我们的训练操作系统：任务编排、Agent 实训环境、Lab 证据采集与 Passport 能力雷达在同一平台闭环。组织看到的不是出勤率，而是每一位学员的真实产出与能力轨迹。",
  "我们已与浙江大学、武汉大学及青山湖科技城管委会等机构开展联合培养与园区人才项目，持续验证「培训即交付」这一模式在政企场景中的可落地性。",
];

export function AboutPage() {
  const { user } = useAuth();
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

  const brandName = data.brand?.name || "青山在";
  const appHref = user ? "/app/courses" : data.cta?.app || "/app/courses";
  const contactEmail = data.contact?.email || LANDING_FOOTER_TRAINING_EMAIL;
  const about = data.about || FALLBACK.about;

  return (
    <div className="landing landing-page-about">
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
            <h1>{about?.title || "关于我们"}</h1>
            <p className="landing-about-lead">{about?.body || FALLBACK.about?.body}</p>
          </div>
        </section>

        <section className="landing-about-story">
          <div className="landing-section-inner landing-about-story__grid">
            {STORY_BLOCKS.map((block) => (
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
              {ABOUT_PILLARS.map((p) => (
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
            <h2 className="landing-about-section-title">合作伙伴</h2>
            <p className="landing-about-section__lead">与政府、高校与园区同行，持续交付可验收的数字化人才训练项目</p>
            <div className="landing-partners__grid landing-about-partners__grid">
              {LANDING_PARTNERS.map((p) => (
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
          <div className="landing-section-inner landing-about-contact__inner">
            <div>
              <h2>预约培训咨询</h2>
              <p className="muted">企业、高校与政府组织 — 留下需求，顾问将在 1 个工作日内回复。</p>
            </div>
            <div className="landing-about-contact__actions">
              <a className="btn-primary" href={`mailto:${LANDING_FOOTER_BUSINESS_EMAIL}?subject=${encodeURIComponent("培训咨询")}`}>
                邮件咨询
              </a>
              <a className="landing-panel-cta landing-panel-cta--ghost" href={`mailto:${contactEmail}?subject=${encodeURIComponent("培训咨询预约")}`}>
                培训预约
              </a>
            </div>
            <p className="muted landing-about-contact__meta">
              {LANDING_FOOTER_BUSINESS_EMAIL} · {contactEmail} · {LANDING_FOOTER_OFFICE}
            </p>
          </div>
        </section>
      </main>

      <LandingFooter brandName={brandName} appHref={appHref} contactEmail={contactEmail} />
    </div>
  );
}
