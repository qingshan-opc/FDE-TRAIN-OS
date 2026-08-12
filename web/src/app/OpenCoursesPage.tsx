import { useEffect, useState } from "react";
import { LandingFooter } from "../components/LandingFooter";
import { LandingTopbar } from "../components/LandingTopbar";
import { siteApi } from "../lib/api";
import { useAuth } from "../lib/auth";
import { applyPageSeo, SITE_DEFAULT_TITLE } from "../lib/seo";
import type { LandingPayload } from "../lib/types";
import {
  FALLBACK_LANDING_TABS,
  LANDING_FALLBACK_OPEN_CATEGORIES,
  LANDING_FALLBACK_OPEN_COURSES,
} from "./landingShared";
import { resolveRouteSeo } from "./resolveLandingContent";
import { OpenCoursesPanel } from "./OpenCoursesPanel";

const FALLBACK: LandingPayload = {
  title: "青山在",
  tagline: "",
  hero_video: null,
  open_course_categories: LANDING_FALLBACK_OPEN_CATEGORIES,
  open_courses: LANDING_FALLBACK_OPEN_COURSES,
  brand: { name: "青山在" },
  cta: { login: "/login", app: "/app/courses" },
  tabs: FALLBACK_LANDING_TABS,
};

export function OpenCoursesPage() {
  const { user, defaultHome } = useAuth();
  const [data, setData] = useState<LandingPayload>(FALLBACK);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await siteApi.landing();
        if (!cancelled) setData({ ...FALLBACK, ...res, tabs: FALLBACK_LANDING_TABS });
      } catch {
        if (!cancelled) setData(FALLBACK);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return applyPageSeo(resolveRouteSeo("open", data), SITE_DEFAULT_TITLE);
  }, [data]);

  const brandName = data.brand?.name || "青山在";
  const appHref = user ? defaultHome || "/app/courses" : data.cta?.app || "/app/courses";

  return (
    <div className="mk-home ink-site landing-page-open">
      <LandingTopbar
        activeTab="open"
        headerSolid
        brandName={brandName}
        loginHref={data.cta?.login || "/login"}
        appHref={appHref}
        user={user}
        tabs={data.tabs}
      />

      <main className="landing-open-page">
        <div className="landing-section-inner">
          <OpenCoursesPanel
            data={data.open_courses}
            categories={data.open_course_categories}
          />
        </div>
      </main>

      <LandingFooter brandName={brandName} appHref={appHref} footer={data.footer} />
    </div>
  );
}
