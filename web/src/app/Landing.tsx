import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { LandingTopbar } from "../components/LandingTopbar";
import { LandingHeroFocus } from "../components/LandingHeroFocus";
import { scrollPageToTop } from "../lib/scrollPageToTop";
import { LandingFooter } from "../components/LandingFooter";
import { siteApi } from "../lib/api";
import { useAuth } from "../lib/auth";
import { applyPageSeo, SITE_DEFAULT_TITLE } from "../lib/seo";
import type { LandingHeroCopy, LandingPayload } from "../lib/types";
import {
  FALLBACK_LANDING_TABS,
  LANDING_FALLBACK_OPEN_COURSES,
  LANDING_FOOTER_TRAINING_EMAIL,
  LANDING_PARTNERS,
  resolveLandingTabs,
} from "./landingShared";

const CONTACT_EMAIL = LANDING_FOOTER_TRAINING_EMAIL;
const SLOGAN = "为政府、高校与企业交付可验收的数字化人才训练";
const LANDING_HERO = "/landing/hero.png";
const LANDING_STORY_REVISION = "20260722-agnes";

const LANDING_STORY_POSTERS = [
  "/landing/story-task.png",
  "/landing/story-agent.png",
  "/landing/story-cert.png",
] as const;

const LANDING_STORY_VIDEOS = [
  "/landing/story-task.mp4",
  "/landing/story-agent.mp4",
  "/landing/story-cert.mp4",
] as const;

const PARTNERS = LANDING_PARTNERS;

const STORY_FALLBACK = [
  {
    title: "任务驱动课纲",
    summary: "每一天围绕一个可验收交付展开，学员在真实工作场景中完成产出。",
  },
  {
    title: "Agent 实训环境",
    summary: "隔离工作区 + 全程留痕，组织能核验每一位学员的真实能力。",
  },
  {
    title: "可核验结业证书",
    summary: "结业证书公开可查，组织能验证每一位学员的真实产出。",
  },
];

type StorySlide = {
  id: string;
  title: string;
  summary: string;
  poster: string;
  streamUrl?: string | null;
};

function buildStorySlides(): StorySlide[] {
  return STORY_FALLBACK.map((item, i) => ({
    id: `story-${i}`,
    title: item.title,
    summary: item.summary,
    poster: `${LANDING_STORY_POSTERS[i] || LANDING_STORY_POSTERS[0]}?v=${LANDING_STORY_REVISION}`,
    streamUrl: `${LANDING_STORY_VIDEOS[i] || LANDING_STORY_VIDEOS[0]}?v=${LANDING_STORY_REVISION}`,
  }));
}

const FALLBACK_FACTS = [
  { n: "01", t: "任务驱动课纲", d: "每一天都是一个可交付的真实工作任务，而不是知识点堆砌。" },
  { n: "02", t: "Agent 实训环境", d: "学员在隔离工作区内使用真实 Agent 完成交付，过程全程留痕。" },
  { n: "03", t: "可核验结业证书", d: "结业证书公开可查，组织能验证每一位学员的真实产出。" },
];

const FALLBACK_HERO: LandingHeroCopy = {
  eyebrow: "FDE LEARNING OS",
  empty_title: "课程宣传片筹备中",
  title_lines: ["让每一次学习", "都留下可验证的证据"],
  title_em: "可验证",
  cta_primary: "进入学习",
  cta_secondary: "了解企业培训",
  bg_image: LANDING_HERO,
  proof: [
    { value: "21", label: "天任务驱动训练" },
    { value: "100%", label: "交付全程留痕" },
    { value: "3", label: "类机构同行验证" },
  ],
};

const FALLBACK: LandingPayload = {
  title: "青山在",
  tagline: SLOGAN,
  hero_video: null,
  brand: { name: "青山在", footer: "© 青山在 · FDE Learning OS" },
  hero: FALLBACK_HERO,
  seo: {
    title: SITE_DEFAULT_TITLE,
    description: "为政府、高校与企业交付可验收的数字化人才训练。任务驱动课纲、Agent 实训环境、可核验结业证书。",
    keywords: "青山在,FDE,数字化人才,企业培训,训练营,Agent实训,结业证书,可验收交付",
    og_image: LANDING_HERO,
  },
  cta: { login: "/login", app: "/app/courses" },
  tabs: FALLBACK_LANDING_TABS,
  enterprise: {
    title: "企业与机构培训",
    subtitle: "从课纲设计到结业验收，每一天都是可交付的真实工作任务",
    facts: FALLBACK_FACTS,
    mentors: [],
  },
  open_courses: LANDING_FALLBACK_OPEN_COURSES,
  about: {
    title: "关于我们",
    body: "青山在是新一代数字化人才训练品牌，由杭州灵梧智能科技有限公司运营。我们面向政府、高校与企业，交付可验收、可留痕、可核验的 FDE 训练营与机构培训项目。",
  },
};

function emphasizeLine(line: string, em?: string): ReactNode {
  const needle = (em || "").trim();
  if (!needle || !line.includes(needle)) return line;
  const parts = line.split(needle);
  return parts.map((part, i) => (
    <Fragment key={i}>
      {part}
      {i < parts.length - 1 ? <em>{needle}</em> : null}
    </Fragment>
  ));
}

function renderHeroTitle(hero: LandingHeroCopy, siteTitle: string): ReactNode {
  const lines = (hero.title_lines || []).map((s) => String(s || "").trim()).filter(Boolean);
  if (lines.length > 0) {
    return lines.map((line, i) => (
      <Fragment key={i}>
        {i > 0 ? <br /> : null}
        {emphasizeLine(line, hero.title_em)}
      </Fragment>
    ));
  }
  return siteTitle;
}

function StoryVideoStrip({ slides }: { slides: StorySlide[] }) {
  const [active, setActive] = useState(0);
  const count = slides.length;

  if (count === 0) return null;

  const prev = () => setActive((i) => (i - 1 + count) % count);
  const next = () => setActive((i) => (i + 1) % count);
  const slot = (offset: number) => slides[(active + offset + count) % count];

  return (
    <section className="landing-story-video scene-section" aria-label="培训现场短视频">
      <header className="landing-story-video__header">
        <p className="landing-story-video__tag mono">TRAINING IN ACTION</p>
        <h2 className="landing-story-video__title">看见真实交付，而不是幻灯片培训</h2>
        <p className="landing-story-video__lead">
          三段品牌叙事短片，带你快速感受任务驱动、证据留痕的训练方式。
        </p>
      </header>

      <div className="landing-story-video__viewport">
        {count > 1 && (
          <button type="button" className="landing-story-video__nav landing-story-video__nav--prev" onClick={prev} aria-label="上一段">
            ‹
          </button>
        )}
        <ul className="landing-story-video__track">
          {count > 1 && (
            <li className="landing-story-video__item is-before" onClick={prev}>
              <StoryVideoCard slide={slot(-1)} preview />
            </li>
          )}
          <li className="landing-story-video__item is-active">
            <StoryVideoCard slide={slides[active]} playing muted loop autoPlay playsInline />
          </li>
          {count > 1 && (
            <li className="landing-story-video__item is-after" onClick={next}>
              <StoryVideoCard slide={slot(1)} preview />
            </li>
          )}
        </ul>
        {count > 1 && (
          <button type="button" className="landing-story-video__nav landing-story-video__nav--next" onClick={next} aria-label="下一段">
            ›
          </button>
        )}
      </div>
    </section>
  );
}

function StoryVideoCard({
  slide,
  preview,
  playing,
  muted,
  loop,
  autoPlay,
  playsInline,
}: {
  slide: StorySlide;
  preview?: boolean;
  playing?: boolean;
  muted?: boolean;
  loop?: boolean;
  autoPlay?: boolean;
  playsInline?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const shouldPlay = Boolean(playing && !preview);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !autoPlay) return;
    const play = () => {
      void video.play().catch(() => {});
    };
    play();
    video.addEventListener("loadeddata", play);
    return () => video.removeEventListener("loadeddata", play);
  }, [autoPlay, slide.streamUrl]);

  return (
    <div className="landing-story-video__content">
      <div className="landing-story-video__frame">
        {preview || !slide.streamUrl || !shouldPlay ? (
          <img className="landing-story-video__media" src={slide.poster} alt={slide.title} loading="lazy" />
        ) : (
          <video
            ref={videoRef}
            className="landing-story-video__media landing-story-video__media--inline"
            src={slide.streamUrl}
            poster={slide.poster}
            muted={muted}
            loop={loop}
            autoPlay={autoPlay}
            playsInline={playsInline ?? true}
            preload="auto"
            controls={false}
            disablePictureInPicture
            aria-label={slide.title}
          />
        )}
      </div>
    </div>
  );
}

function PartnersPanel({ sectionRef }: { sectionRef?: (el: HTMLElement | null) => void }) {
  return (
    <section
      className="landing-partners scene-section"
      id="partners"
      ref={sectionRef}
      aria-label="合作伙伴"
    >
      <header className="landing-partners__header">
        <p className="landing-partners__tag mono">PARTNERS</p>
        <h2 className="landing-partners__title">与政府、高校与园区同行</h2>
        <p className="landing-partners__lead">已为多家机构交付可验收的数字化人才训练项目</p>
      </header>
      <div className="landing-partners__grid">
        {PARTNERS.map((p) => (
          <article className="landing-partners__card" key={p.id}>
            <div className="landing-partners__logo">
              <img src={p.logo} alt={p.logoAlt} loading="lazy" />
            </div>
            <p className="landing-partners__name">{p.name}</p>
            <p className="landing-partners__tagline">{p.tag}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function EnterprisePanel({
  data,
  contactEmail,
  images,
}: {
  data: NonNullable<LandingPayload["enterprise"]>;
  contactEmail: string;
  images: string[];
}) {
  const mentors = data.mentors && data.mentors.length > 0 ? data.mentors : null;
  const facts =
    data.facts && data.facts.length > 0
      ? data.facts.map((f, i) => ({
          n: f.n || String(i + 1).padStart(2, "0"),
          t: f.t || "",
          d: f.d || "",
        }))
      : FALLBACK_FACTS;
  return (
    <div className="landing-panel-grid">
      <div className="landing-panel-copy">
        <p className="landing-eyebrow mono">ENTERPRISE &amp; INSTITUTIONS</p>
        <h2 className="landing-panel-title">{data.title}</h2>
        <p className="landing-panel-subtitle">{data.subtitle}</p>
        <ol className="landing-fact-list">
          {facts.map((f, i) => (
            <li key={f.n}>
              {images[i] ? (
                <div className="landing-fact-media">
                  <img src={images[i]} alt="" loading="lazy" />
                </div>
              ) : (
                <span className="landing-fact-n mono">{f.n}</span>
              )}
              <div>
                <strong>{f.t}</strong>
                <p className="muted">{f.d}</p>
              </div>
            </li>
          ))}
        </ol>
        <a
          className="landing-panel-cta"
          href={`mailto:${contactEmail}?subject=${encodeURIComponent("培训咨询预约")}`}
        >
          预约培训咨询
          <span className="landing-panel-cta__arrow" aria-hidden="true">
            →
          </span>
        </a>
      </div>

      <aside className="landing-mentor-rail">
        <p className="landing-mentor-rail-label mono">授课导师</p>
        {mentors ? (
          <div className="landing-mentor-list">
            {mentors.map((m, i) => (
              <div className="landing-mentor-card" key={m.id || i}>
                <div className="landing-mentor-avatar" aria-hidden="true">
                  {m.avatar_url ? (
                    <img src={m.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
                  ) : (
                    (m.name || "导")[0]
                  )}
                </div>
                <div>
                  <strong>{m.name || "待补充"}</strong>
                  {m.title && <p className="muted">{m.title}</p>}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="landing-mentor-list">
            {[0, 1, 2].map((i) => (
              <div className="landing-mentor-card is-placeholder" key={i}>
                <div className="landing-mentor-avatar is-placeholder" aria-hidden="true" />
                <div>
                  <strong>待配置真实讲课素材</strong>
                  <p className="muted">可在后台为该企业培训班配置导师信息</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </aside>
    </div>
  );
}

export function Landing() {
  const { user } = useAuth();
  const [data, setData] = useState<LandingPayload>(FALLBACK);
  const tabs = resolveLandingTabs(data.tabs);
  const scrollTabIds = tabs.filter((t) => t.id === "enterprise").map((t) => t.id);
  const [activeTab, setActiveTab] = useState<string>(scrollTabIds[0] || "enterprise");
  const [headerSolid, setHeaderSolid] = useState(false);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await siteApi.landing();
        if (cancelled) return;
        // 与本地 FALLBACK 深合并，避免接口缺字段时标题/Hero 跳动
        setData({
          ...FALLBACK,
          ...res,
          brand: { ...FALLBACK.brand, ...(res.brand || {}) },
          hero: { ...FALLBACK_HERO, ...(res.hero || {}) },
          seo: { ...FALLBACK.seo, ...(res.seo || {}), title: SITE_DEFAULT_TITLE },
          cta: { ...FALLBACK.cta, ...(res.cta || {}) },
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
    // 首页页签固定为品牌全称，与 index.html 一致，禁止中途改成「青山在」或「FDE Learning OS」
    return applyPageSeo({ ...FALLBACK.seo, ...data.seo, title: SITE_DEFAULT_TITLE }, SITE_DEFAULT_TITLE);
  }, [data.seo?.description, data.seo?.keywords, data.seo?.og_image]);

  useEffect(() => {
    const onScroll = () => setHeaderSolid(window.scrollY > 32);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        const top = visible[0]?.target.id;
        if (top) setActiveTab(top);
      },
      { rootMargin: "-20% 0px -55% 0px", threshold: [0, 0.15, 0.35] },
    );
    scrollTabIds.forEach((id) => {
      const el = sectionRefs.current[id];
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [scrollTabIds.join("|")]);

  const scrollToSection = (id: string) => {
    setActiveTab(id);
    const target = sectionRefs.current[id] || document.getElementById(id);
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const onTabClick = (_id: string) => {
    scrollPageToTop("smooth");
    setActiveTab("enterprise");
  };

  const appHref = user ? "/app/courses" : data.cta?.app || "/app/courses";
  const enterprise = data.enterprise || FALLBACK.enterprise!;
  const contactEmail = data.contact?.email || CONTACT_EMAIL;
  const brandName = data.brand?.name || data.title || FALLBACK.brand?.name || "青山在";
  const siteTitle = data.title || brandName;
  const hero = { ...FALLBACK_HERO, ...(data.hero || {}) };
  const heroEyebrow = hero.eyebrow || FALLBACK_HERO.eyebrow || "FDE LEARNING OS";
  // 站点信息「标语」→ Hero 副标题；缺省回落默认口号
  const slogan = (data.tagline || "").trim() || SLOGAN;
  const footerText = data.brand?.footer || FALLBACK.brand?.footer;
  const storySlides = buildStorySlides();
  const storyImages = [...LANDING_STORY_POSTERS];
  const heroFallback = hero.bg_image || LANDING_HERO;
  // 有上传海报时优先用流地址；坏图/占位图由 LandingHeroFocus 回退到静态底图
  const heroBg = data.hero_video?.poster_url || heroFallback;
  const proof =
    hero.proof && hero.proof.length > 0
      ? hero.proof
      : FALLBACK_HERO.proof || [];
  const primaryCta = user ? "进入学习平台" : hero.cta_primary || "进入学习";
  const secondaryCta = hero.cta_secondary || "了解企业培训";

  return (
    <div className="landing">
      <LandingTopbar
        activeTab={activeTab}
        headerSolid={headerSolid}
        brandName={brandName}
        loginHref={data.cta?.login || "/login"}
        appHref={appHref}
        user={user}
        tabs={data.tabs}
        onSectionClick={onTabClick}
      />

      <section className="landing-hero scene-product-hero">
        <LandingHeroFocus src={heroBg} fallbackSrc={heroFallback} />
        <div className="landing-hero__content">
          <p className="landing-hero__eyebrow mono">{heroEyebrow}</p>
          <h1 className="landing-hero__title">{renderHeroTitle(hero, siteTitle)}</h1>
          <p className="landing-hero__subtitle">{slogan}</p>
          <div className="landing-hero__actions">
            <Link to={appHref} className="landing-hero-btn landing-hero-btn--primary">
              {primaryCta}
            </Link>
            <button type="button" className="landing-hero-btn" onClick={() => scrollToSection("enterprise")}>
              {secondaryCta}
            </button>
          </div>
        </div>
        <div className="landing-hero__proof" aria-hidden="false">
          {proof.map((item, i) => (
            <Fragment key={`${item.value}-${item.label}-${i}`}>
              {i > 0 ? <span className="landing-hero__proof-divider" aria-hidden="true" /> : null}
              <div className="landing-hero__proof-item">
                <strong className="num">{item.value}</strong>
                <span>{item.label}</span>
              </div>
            </Fragment>
          ))}
        </div>
      </section>

      <StoryVideoStrip slides={storySlides} />
      <PartnersPanel
        sectionRef={(el) => {
          sectionRefs.current.partners = el;
        }}
      />

      <section
        className="landing-section landing-section--alt"
        id="enterprise"
        ref={(el) => {
          sectionRefs.current.enterprise = el;
        }}
      >
        <div className="landing-section-inner">
          <EnterprisePanel data={enterprise} images={storyImages} contactEmail={contactEmail} />
        </div>
      </section>

      <LandingFooter
        brandName={brandName}
        appHref={appHref}
        contactEmail={contactEmail}
        footerText={footerText}
      />
    </div>
  );
}
