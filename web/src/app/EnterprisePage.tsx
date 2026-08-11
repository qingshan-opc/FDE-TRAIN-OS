import { useEffect, useRef, useState } from "react";
import { LandingTopbar } from "../components/LandingTopbar";
import { LandingFooter } from "../components/LandingFooter";
import { siteApi } from "../lib/api";
import { useAuth } from "../lib/auth";
import { applyPageSeo, SITE_DEFAULT_TITLE } from "../lib/seo";
import type { LandingPayload } from "../lib/types";
import {
  FALLBACK_LANDING_TABS,
  LANDING_FOOTER_BUSINESS_EMAIL,
  LANDING_PARTNERS,
} from "./landingShared";

const FALLBACK_FACTS = [
  { n: "01", t: "任务驱动课纲", d: "每一天都是一个可交付的真实工作任务，而不是知识点堆砌。" },
  { n: "02", t: "Agent 实训环境", d: "学员在隔离工作区内使用真实 Agent 完成交付，过程全程留痕。" },
  { n: "03", t: "可核验结业证书", d: "结业证书公开可查，组织能验证每一位学员的真实产出。" },
];

const FALLBACK: LandingPayload = {
  title: "青山在",
  tagline: "为政府、高校与企业交付可验收的数字化人才训练",
  hero_video: null,
  brand: { name: "青山在" },
  cta: { login: "/login", app: "/app/courses" },
  tabs: FALLBACK_LANDING_TABS,
  enterprise: {
    title: "企业与机构培训",
    subtitle: "从课纲设计到结业验收，每一天都是可交付的真实工作任务",
    facts: FALLBACK_FACTS,
    mentors: [],
  },
};

const CN_IDX = ["壹", "贰", "叁", "肆", "伍", "陆"] as const;

export function EnterprisePage() {
  const { user } = useAuth();
  const [data, setData] = useState<LandingPayload>(FALLBACK);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await siteApi.landing();
        if (cancelled) return;
        setData({
          ...FALLBACK,
          ...res,
          brand: { ...FALLBACK.brand, ...(res.brand || {}) },
          cta: { ...FALLBACK.cta, ...(res.cta || {}) },
          tabs: FALLBACK.tabs,
          enterprise: res.enterprise || FALLBACK.enterprise,
        });
      } catch {
        if (!cancelled) setData(FALLBACK);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return applyPageSeo(
      {
        title: "企业与机构培训 · 青山在",
        description:
          data.enterprise?.subtitle ||
          "为政府、高校与企业交付可验收的数字化人才训练。任务驱动课纲、Agent 实训环境、可核验结业证书。",
        keywords: "青山在,企业培训,机构培训,数字化人才,Agent实训,结业证书",
      },
      SITE_DEFAULT_TITLE,
    );
  }, [data.enterprise?.subtitle]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const nodes = root.querySelectorAll<HTMLElement>(".ink-reveal");
    const mark = (el: Element) => {
      el.classList.add("in");
      el.setAttribute("data-revealed", "1");
    };
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting) {
            mark(en.target);
            io.unobserve(en.target);
          }
        });
      },
      { threshold: 0.12 },
    );
    nodes.forEach((el) => {
      if (el.getAttribute("data-revealed") === "1") mark(el);
      else io.observe(el);
    });
    return () => io.disconnect();
  }, [data.enterprise]);

  const brandName = data.brand?.name || "青山在";
  const appHref = user ? "/app/courses" : data.cta?.app || "/app/courses";
  const enterprise = data.enterprise || FALLBACK.enterprise!;
  const facts =
    enterprise.facts && enterprise.facts.length > 0 ? enterprise.facts : FALLBACK_FACTS;
  const mentors = enterprise.mentors?.filter((m) => m.name) || [];
  const mailto = `mailto:${LANDING_FOOTER_BUSINESS_EMAIL}?subject=${encodeURIComponent("培训咨询")}`;

  return (
    <div className="mk-home ink-site" ref={rootRef}>
      <LandingTopbar
        activeTab="enterprise"
        headerSolid
        brandName={brandName}
        loginHref={data.cta?.login || "/login"}
        appHref={appHref}
        user={user}
        tabs={data.tabs}
      />

      <section className="ink-ent-hero">
        <div className="ink-wrap">
          <div className="ink-sec-head ink-reveal" style={{ marginBottom: 28, textAlign: "left" }}>
            <div className="ink-sec-kicker" style={{ justifyContent: "flex-start" }}>
              ENTERPRISE &amp; INSTITUTIONS
            </div>
            <h1 className="ink-sec-title" style={{ fontSize: "clamp(32px, 5vw, 48px)" }}>
              {enterprise.title || "企业与机构培训"}
            </h1>
            <p className="ink-sec-sub" style={{ marginLeft: 0, maxWidth: 640 }}>
              {enterprise.subtitle}
            </p>
          </div>
          <div className="ink-hero-cta ink-reveal ink-reveal-d1">
            <a className="ink-btn ink-btn--ochre ink-btn--lg" href={mailto}>
              预约培训咨询
            </a>
            <a className="ink-btn ink-btn--ghost ink-btn--lg" href="#ent-facts">
              了解交付能力
            </a>
          </div>
        </div>
      </section>

      <section className="ink-section ink-pains" id="ent-facts">
        <div className="ink-wrap">
          <div className="ink-sec-head ink-reveal">
            <div className="ink-sec-kicker">可验收交付</div>
            <h2 className="ink-sec-title">三项核心能力</h2>
            <p className="ink-sec-sub">组织看到的不是出勤率，而是每一位学员的真实产出与能力轨迹。</p>
          </div>
          <div className="ink-ent-facts">
            {facts.map((f, i) => (
              <article
                key={f.n}
                className={`ink-ent-fact ink-reveal${i ? ` ink-reveal-d${Math.min(i, 3)}` : ""}`}
                data-idx={CN_IDX[i] || f.n}
              >
                <div className="ink-ent-fact__n">能力 · {CN_IDX[i] || f.n}</div>
                <h3>{f.t}</h3>
                <p>{f.d}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="ink-section" id="mentors">
        <div className="ink-wrap">
          <div className="ink-sec-head ink-reveal">
            <div className="ink-sec-kicker">授课导师</div>
            <h2 className="ink-sec-title">与一线实践者同行</h2>
            <p className="ink-sec-sub">可在后台为企业培训班配置真实导师信息。</p>
          </div>
          <div className="ink-mentor-grid">
            {(mentors.length > 0
              ? mentors
              : [
                  { id: "p0", name: "", title: "待配置真实讲课素材" },
                  { id: "p1", name: "", title: "可在后台配置导师信息" },
                  { id: "p2", name: "", title: "支持头像与职称" },
                ]
            ).map((m, i) => (
              <div
                key={m.id || i}
                className={`ink-mentor-card ink-reveal${i ? ` ink-reveal-d${Math.min(i, 3)}` : ""}`}
              >
                <div className="ink-mentor-avatar" aria-hidden="true">
                  {m.avatar_url ? (
                    <img src={m.avatar_url} alt="" />
                  ) : (
                    (m.name || "导")[0]
                  )}
                </div>
                <div>
                  <strong>{m.name || "待补充"}</strong>
                  <p>{m.title || "可在后台为该企业培训班配置导师信息"}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="ink-section ink-works" id="partners">
        <div className="ink-wrap">
          <div className="ink-sec-head ink-reveal">
            <div className="ink-sec-kicker">合作伙伴</div>
            <h2 className="ink-sec-title">与政府、高校与园区同行</h2>
            <p className="ink-sec-sub">已为多家机构交付可验收的数字化人才训练项目</p>
          </div>
          <div className="ink-partner-grid">
            {LANDING_PARTNERS.map((p, i) => (
              <article
                key={p.id}
                className={`ink-partner-card ink-reveal${i ? ` ink-reveal-d${Math.min(i, 3)}` : ""}`}
              >
                <img src={p.logo} alt={p.logoAlt} />
                <p className="ink-partner-card__name">{p.name}</p>
                <p className="ink-partner-card__tag">{p.tag}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="ink-ent-cta">
        <div className="ink-wrap ink-reveal">
          <h2>从课纲到结业，一次谈妥可验收交付</h2>
          <p>告诉我们组织规模与培训目标，课程顾问将在 1 个工作日内与您对接方案。</p>
          <a className="ink-btn ink-btn--ochre ink-btn--lg" href={mailto}>
            预约培训咨询
          </a>
        </div>
      </section>

      <LandingFooter brandName={brandName} appHref={appHref} footerText={data.brand?.footer} />
    </div>
  );
}
