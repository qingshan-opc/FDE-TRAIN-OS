export type PageSeo = {
  title?: string | null;
  description?: string | null;
  keywords?: string | null;
  og_image?: string | null;
};

/** 全站默认页签标题：与 index.html / INK_SEO 保持一致，避免首屏闪烁 */
export const SITE_DEFAULT_TITLE = "青山在 · FDE 训练营 —— 成为前沿部署工程师";

function upsertMeta(attr: "name" | "property", key: string, content: string) {
  const selector = `meta[${attr}="${key}"]`;
  let el = document.head.querySelector(selector) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.content = content;
}

function absolutize(url: string): string {
  if (!url) return url;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `${window.location.origin}${url.startsWith("/") ? "" : "/"}${url}`;
}

/** 规范化页签标题，避免「青山在」/「FDE Learning OS」单独出现导致切换闪烁 */
export function resolvePageTitle(seo?: PageSeo | null): string {
  const raw = (seo?.title || "").trim();
  if (!raw) return SITE_DEFAULT_TITLE;
  if (raw === "青山在" || raw === "FDE Learning OS" || raw === "FDE Learning OS — 两周课学员与教研工作台") {
    return SITE_DEFAULT_TITLE;
  }
  return raw;
}

/**
 * Apply document title + common SEO / Open Graph tags.
 * 不在 cleanup 里回滚 title（SPA 切换会闪）；仅当新标题不同才写入。
 */
export function applyPageSeo(seo: PageSeo | null | undefined, fallbackTitle = SITE_DEFAULT_TITLE): () => void {
  const title = resolvePageTitle(seo) || fallbackTitle || SITE_DEFAULT_TITLE;
  const description = (seo?.description || "").trim();
  const keywords = (seo?.keywords || "").trim();
  const ogImage = (seo?.og_image || "").trim();

  if (document.title !== title) {
    document.title = title;
  }

  if (description) upsertMeta("name", "description", description);
  if (keywords) upsertMeta("name", "keywords", keywords);

  upsertMeta("property", "og:type", "website");
  upsertMeta("property", "og:locale", "zh_CN");
  upsertMeta("property", "og:title", title);
  if (description) upsertMeta("property", "og:description", description);
  upsertMeta("property", "og:url", window.location.href);
  if (ogImage) upsertMeta("property", "og:image", absolutize(ogImage));

  upsertMeta("name", "twitter:card", ogImage ? "summary_large_image" : "summary");
  upsertMeta("name", "twitter:title", title);
  if (description) upsertMeta("name", "twitter:description", description);
  if (ogImage) upsertMeta("name", "twitter:image", absolutize(ogImage));

  let canonical = document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!canonical) {
    canonical = document.createElement("link");
    canonical.rel = "canonical";
    document.head.appendChild(canonical);
  }
  if (canonical.href !== window.location.href) {
    canonical.href = window.location.href;
  }

  // 不回滚 title / meta，避免 effect 重跑或 StrictMode 双调用时页签闪烁
  return () => undefined;
}
