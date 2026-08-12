import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { LandingFooter } from "../components/LandingFooter";
import { LandingTopbar, LOGIN_PATH, PURCHASE_PATH } from "../components/LandingTopbar";
import { siteApi } from "../lib/api";
import { useAuth } from "../lib/auth";
import { applyPageSeo, SITE_DEFAULT_TITLE } from "../lib/seo";
import type { LandingPayload } from "../lib/types";
import { FALLBACK_LANDING_TABS } from "./landingShared";
import {
  INK_FAQ,
  INK_FEATURES,
  INK_HERO,
  INK_PAIN_TURN,
  INK_PAINS,
  INK_PRICE_PERKS,
  INK_TRAE_ROLES,
  INK_SEO,
  INK_SYLLABUS_WEEKS,
  INK_VOICES,
  INK_WORKS,
} from "./inkCampContent";

const FALLBACK: LandingPayload = {
  title: "青山在",
  tagline: "成为前沿部署工程师，打通AI与业务的最后一公里",
  hero_video: null,
  brand: { name: "青山在", footer: "© 青山在 · FDE 训练营" },
  cta: { login: "/login", app: "/app/courses" },
  tabs: FALLBACK_LANDING_TABS,
  seo: {
    title: INK_SEO.title,
    description: INK_SEO.description,
    keywords: INK_SEO.keywords,
  },
};

const FEAT_META = [
  "ROLES: pm · ui · fe · be · qa · ops",
  "LOOP: plan → act → reflect",
  "SKILL: align · report · push",
  "EVIDENCE: gated milestones",
  "DELIVERABLE: running product",
  "ACCESS: lifetime replay",
] as const;

const TRUST = [
  { num: "21", unit: "天", label: "结构化训练" },
  { num: "3", unit: "周", label: "能力递进" },
  { num: "6", unit: "岗", label: "AI 岗位协作" },
  { num: "永久", unit: "", label: "课程回放" },
] as const;

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      className={`mk-chevron${open ? " is-open" : ""}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

export function Landing() {
  const { user, defaultHome } = useAuth();
  const [data, setData] = useState<LandingPayload>(FALLBACK);
  const [headerSolid, setHeaderSolid] = useState(false);
  const [openDay, setOpenDay] = useState<string>("W1-D1");
  const [openFaq, setOpenFaq] = useState<number>(0);
  const [heroExit, setHeroExit] = useState(0);
  const [painIn, setPainIn] = useState(false);
  const [seamActive, setSeamActive] = useState(false);
  const painRef = useRef<HTMLElement | null>(null);
  const purchaseHref = user ? PURCHASE_PATH : LOGIN_PATH;
  const brandName = data.brand?.name || "青山在";
  const appHref = user ? defaultHome || "/app/courses" : data.cta?.app || "/app/courses";

  const outlineDays = useMemo(
    () =>
      INK_SYLLABUS_WEEKS.flatMap((week, wi) =>
        (week.days || []).map((day, di) => ({
          id: `W${wi + 1}-${day.d}`,
          week: week.week,
          weekTitle: week.title,
          ...day,
          defaultOpen: wi === 0 && di === 0,
        })),
      ),
    [],
  );

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
          tabs: FALLBACK_LANDING_TABS,
          seo: {
            ...FALLBACK.seo,
            ...(res.seo || {}),
            title: INK_SEO.title,
            description: res.seo?.description || INK_SEO.description,
          },
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
    applyPageSeo({
      title: data.seo?.title || SITE_DEFAULT_TITLE,
      description: data.seo?.description,
      keywords: data.seo?.keywords,
    });
  }, [data.seo]);

  useEffect(() => {
    const onScroll = () => {
      setHeaderSolid(window.scrollY > 24);
      const hero = document.getElementById("top");
      if (!hero || prefersReducedMotion()) {
        setHeroExit(0);
        return;
      }
      const rect = hero.getBoundingClientRect();
      const span = Math.max(rect.height * 0.42, 1);
      const raw = (-rect.top) / span;
      setHeroExit(Math.min(1, Math.max(0, raw)));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const el = painRef.current;
    if (!el) return;
    if (prefersReducedMotion()) {
      setPainIn(true);
      setSeamActive(false);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setSeamActive(true);
        setPainIn(true);
        io.disconnect();
      },
      { threshold: 0.18, rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.pageYOffset - 72;
    window.scrollTo({ top, behavior: "smooth" });
  };

  return (
    <div className="mk-home">
      <LandingTopbar
        activeTab="home"
        headerSolid={headerSolid}
        brandName={brandName}
        loginHref={data.cta?.login || LOGIN_PATH}
        appHref={appHref}
        user={user}
        tabs={data.tabs}
        purchaseHref={purchaseHref}
      />

      <main>
        {/* Hero */}
        <header
          className={`mk-hero${heroExit > 0.08 ? " is-leaving" : ""}`}
          id="top"
          style={{ ["--mk-hero-exit" as string]: String(heroExit) }}
        >
          <div className="mk-hero-glow" aria-hidden="true" />
          <div className="mk-hero-glow mk-hero-glow--2" aria-hidden="true" />
          <div className="mk-wrap mk-hero-inner">
            <span className="mk-badge">
              <span className="mk-badge__dot" aria-hidden="true" />
              {INK_HERO.eyebrow}
            </span>
            <h1>
              {INK_HERO.titleLead}
              <span className="mk-grad">{INK_HERO.titleEm}</span>
              <br />
              {INK_HERO.titleLine2}
            </h1>
            <p className="mk-hero-sub">
              {INK_HERO.sub}
            </p>
            <div className="mk-hero-ctas">
              <Link to={purchaseHref} className="mk-btn mk-btn--primary">
                {INK_HERO.ctaPrimary}
              </Link>
              <button type="button" className="mk-btn mk-btn--ghost" onClick={() => scrollTo("outline")}>
                {INK_HERO.ctaSecondary} ↓
              </button>
            </div>

            <div className="mk-terminal" aria-hidden="true">
              <div className="mk-terminal__bar">
                <i />
                <i />
                <i />
                <span>trae — zsh</span>
              </div>
              <pre>
                <span className="c-prompt">$</span> <span className="c-cmd">trae create-team</span>{" "}
                <span className="c-flag">--roles</span> pm,ui,fe,be,qa,ops{"\n"}
                <span className="c-ok">✓</span> 6 个岗位智能体已就位，等待你的指令{"\n\n"}
                <span className="c-prompt">$</span> <span className="c-cmd">@产品经理</span> 写清本周可验收交付{"\n"}
                <span className="c-comment"># 需求文档已写入 workspace/PRD.md</span>
                {"\n\n"}
                <span className="c-prompt">$</span> <span className="c-cmd">trae gate</span>{" "}
                <span className="c-flag">--week</span> 1{"\n"}
                <span className="c-ok">✓ GATE 通过 · 产品可演示</span>
                <span className="mk-cursor" />
              </pre>
            </div>

            <div className="mk-trust">
              {TRUST.map((t) => (
                <div className="mk-trust-item" key={t.label}>
                  <div className="mk-trust-num">
                    {t.num}
                    {t.unit ? <em>{t.unit}</em> : null}
                  </div>
                  <div className="mk-trust-label">{t.label}</div>
                </div>
              ))}
            </div>
          </div>
        </header>

        <div className={`mk-screen-seam${seamActive ? " is-active" : ""}`} aria-hidden="true">
          <span className="mk-screen-seam__beam" />
        </div>

        {/* Pain */}
        <section
          className={`mk-section mk-reveal-section${painIn ? " is-in" : ""}`}
          id="pain"
          ref={painRef}
        >
          <div className="mk-wrap">
            <span className="mk-section-tag mk-reveal-item">// 你现在的处境</span>
            <h2 className="mk-section-title mk-reveal-item">
              AI 写代码的时代，
              <br />
              你却卡在「会聊不会交」
            </h2>
            <p className="mk-section-sub mk-reveal-item">问题不是再买一门课，而是缺一套能交付、能落地、能沟通的 FDE 训练。</p>
            <div className="mk-pain-grid">
              {INK_PAINS.map((p, i) => (
                <div className={`mk-pain-card mk-reveal-item mk-reveal-d${i + 1}`} key={p.title}>
                  <span className="mk-pain-id">PAIN_0{i + 1}</span>
                  <h3>{p.title}</h3>
                  <p>{p.body}</p>
                </div>
              ))}
            </div>
            <div className="mk-pain-quote mk-reveal-item mk-reveal-d4">
              <span dangerouslySetInnerHTML={{ __html: INK_PAIN_TURN }} />
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="mk-section mk-section--band" id="features">
          <div className="mk-wrap">
            <span className="mk-section-tag">// 为什么不一样</span>
            <h2 className="mk-section-title">
              不是教你写代码，
              <br />
              是教你<span className="mk-accent">指挥交付</span>
            </h2>
            <div className="mk-feat-grid">
              {INK_FEATURES.map((f, i) => (
                <div className="mk-feat-card" key={f.title}>
                  <div className={`mk-feat-icon${i % 2 === 1 ? " mk-feat-icon--green" : ""}`}>
                    <span className="mono">{String(i + 1).padStart(2, "0")}</span>
                  </div>
                  <h3>{f.title}</h3>
                  <p>{f.body}</p>
                  <span className="mk-feat-meta">{FEAT_META[i] || f.no}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Outline accordion */}
        <section className="mk-section" id="outline">
          <div className="mk-wrap">
            <span className="mk-section-tag">// 三周路线图</span>
            <h2 className="mk-section-title">21 天，从交付到沟通</h2>
            <p className="mk-section-sub">
              点开每一天，查看主题、产出与 GATE。前三周课纲均已开放预览。
            </p>
            <div className="mk-outline">
              {outlineDays.map((day) => {
                const open = openDay === day.id;
                return (
                  <div className={`mk-day${open ? " is-open" : ""}`} key={day.id}>
                    <button
                      type="button"
                      className="mk-day-head"
                      aria-expanded={open}
                      onClick={() => setOpenDay(open ? "" : day.id)}
                    >
                      <span className="mk-day-num">{day.d}</span>
                      <span className="mk-day-title">
                        <span className="mk-day-week">{day.week}</span>
                        {day.t}
                      </span>
                      <span className="mk-day-meta">
                        <span>{day.s}</span>
                        <Chevron open={open} />
                      </span>
                    </button>
                    <div className="mk-day-body" hidden={!open}>
                      <div className="mk-day-body-inner">
                        <p className="mk-day-desc">
                          {day.week} · {day.weekTitle}。本日聚焦「{day.t}」，产出物：{day.s}。
                        </p>
                        <div className="mk-day-output">
                          <h4>OUTPUT / GATE</h4>
                          <ul>
                            {day.out.map((item) => (
                              <li key={item} className={item.includes("GATE") ? "is-gate" : undefined}>
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Method / roles */}
        <section className="mk-section mk-section--band" id="method">
          <div className="mk-wrap">
            <span className="mk-section-tag">// 学习方式</span>
            <h2 className="mk-section-title">
              你是指挥官，
              <br />
              六岗位 AI 是施工队
            </h2>
            <p className="mk-section-sub">用 @岗位 交接任务，像真实软件团队一样协作；你负责判断、验收与推进。</p>
            <div className="mk-roles">
              {INK_TRAE_ROLES.map((r) => (
                <div className="mk-role" key={r.title}>
                  <div className="mk-role-token mono">{r.token}</div>
                  <h3>{r.title}</h3>
                  <p>{r.desc.replace(/\n/g, " · ")}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Works */}
        <section className="mk-section" id="works">
          <div className="mk-wrap">
            <span className="mk-section-tag">// 学员成果</span>
            <h2 className="mk-section-title">毕业带走可运行作品</h2>
            <p className="mk-section-sub">不是练习题，是能写进述职与协作现场的真实交付。</p>
            <div className="mk-works">
              {INK_WORKS.map((w) => (
                <article className="mk-work" key={w.title}>
                  <div className="mk-work-shot" style={{ background: `linear-gradient(145deg, ${w.path}, ${w.fill})` }}>
                    <div className="mk-work-mock">
                      <b>{w.title}</b>
                      {"\n"}status: <span className="ok">accepted</span>
                      {"\n"}owner: {w.who}
                    </div>
                  </div>
                  <div className="mk-work-body">
                    <span className="mk-work-tag">{w.tag}</span>
                    <h3>{w.title}</h3>
                    <p>{w.body}</p>
                    <div className="mk-work-author">
                      <span className="mk-work-av" style={{ background: w.sun }}>
                        {w.who.slice(0, 1)}
                      </span>
                      <span>{w.who}</span>
                      <span className="mk-work-chip">{w.badge}</span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Reviews */}
        <section className="mk-section mk-section--band" id="reviews">
          <div className="mk-wrap">
            <span className="mk-section-tag">// 学员评价</span>
            <h2 className="mk-section-title">他们怎么说</h2>
            <div className="mk-reviews">
              {INK_VOICES.map((v) => (
                <blockquote className="mk-review" key={v.name}>
                  <span className="mk-qmark mono" aria-hidden="true">
                    “
                  </span>
                  <p>{v.quote}</p>
                  <footer className="mk-review-who">
                    <span className="mk-work-av" style={{ background: "var(--mk-accent-soft)", color: "var(--mk-accent)" }}>
                      {v.name.slice(0, 1)}
                    </span>
                    <div>
                      <strong>{v.name}</strong>
                      <span>{v.meta}</span>
                    </div>
                  </footer>
                </blockquote>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section className="mk-section" id="pricing">
          <div className="mk-wrap mk-price-layout">
            <div>
              <span className="mk-section-tag">// 定价</span>
              <h2 className="mk-section-title">一次报名，三周能力递进</h2>
              <p className="mk-section-sub">登录后即可选购开通。含课纲、实训资源、答疑支持与永久回放。</p>
              <ul className="mk-perk-list">
                {INK_PRICE_PERKS.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>
            <div className="mk-price-card">
              <div className="mk-price-label mono">FDE CAMP · EARLY</div>
              <div className="mk-price-num">
                ¥1,980<em>/人</em>
              </div>
              <p className="mk-price-note">FDE 训练营 · 开营名额有限</p>
              <Link to={purchaseHref} className="mk-btn mk-btn--primary mk-btn--block">
                {INK_HERO.ctaPrimary}
              </Link>
              <Link to={user ? appHref : LOGIN_PATH} className="mk-btn mk-btn--ghost mk-btn--block">
                {user ? "进入学习平台" : "先登录账号"}
              </Link>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="mk-section mk-section--band" id="faq">
          <div className="mk-wrap">
            <span className="mk-section-tag">// FAQ</span>
            <h2 className="mk-section-title">常见问题</h2>
            <div className="mk-faq">
              {INK_FAQ.map((item, i) => {
                const open = openFaq === i;
                return (
                  <div className={`mk-faq-item${open ? " is-open" : ""}`} key={item.q}>
                    <button
                      type="button"
                      className="mk-faq-q"
                      aria-expanded={open}
                      onClick={() => setOpenFaq(open ? -1 : i)}
                    >
                      <span>{item.q}</span>
                      <Chevron open={open} />
                    </button>
                    <div className="mk-faq-a" hidden={!open}>
                      <p dangerouslySetInnerHTML={{ __html: item.a }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="mk-final-cta">
          <div className="mk-wrap">
            <h2>准备好当指挥官了吗？</h2>
            <p>21 天完成产品交付、Agent 与企业沟通特训——把 AI 真正变成你的施工队。</p>
            <div className="mk-hero-ctas">
              <Link to={purchaseHref} className="mk-btn mk-btn--primary mk-btn--lg">
                {INK_HERO.ctaPrimary}
              </Link>
              <button type="button" className="mk-btn mk-btn--ghost mk-btn--lg" onClick={() => scrollTo("outline")}>
                先看三周大纲
              </button>
            </div>
          </div>
        </section>
      </main>

      <LandingFooter brandName={brandName} appHref={appHref} footerText={data.brand?.footer} />
    </div>
  );
}
