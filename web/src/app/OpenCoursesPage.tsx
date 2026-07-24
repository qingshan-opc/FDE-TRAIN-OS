import { useEffect, useState } from "react";
import { LandingTopbar } from "../components/LandingTopbar";
import { LandingFooter } from "../components/LandingFooter";
import { siteApi } from "../lib/api";
import { useAuth } from "../lib/auth";
import type { LandingPayload } from "../lib/types";
import { LANDING_FALLBACK_OPEN_COURSES } from "./landingShared";
import { OpenCoursesPanel } from "./OpenCoursesPanel";

const FALLBACK: LandingPayload = {
  title: "青山在",
  tagline: "",
  hero_video: null,
  open_courses: LANDING_FALLBACK_OPEN_COURSES,
  brand: { name: "青山在" },
  cta: { login: "/login", app: "/app/courses" },
};

export function OpenCoursesPage() {
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
  const contactEmail = data.contact?.email;

  return (
    <div className="landing landing-page-open">
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
          <OpenCoursesPanel data={data.open_courses} />
        </div>
      </main>

      <LandingFooter brandName={brandName} appHref={appHref} contactEmail={contactEmail} />
    </div>
  );
}
