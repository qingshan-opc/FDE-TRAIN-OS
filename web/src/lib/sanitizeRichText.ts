/**
 * Allowlist sanitize for CMS rich snippets (FAQ / pain.turn).
 * Keeps <b>/<strong>/<em>/<i>/<br>; strips scripts, handlers, other tags.
 */
export function sanitizeRichText(html: string): string {
  if (!html) return "";
  let s = String(html);
  s = s.replace(/<\s*(script|style|iframe|object|embed)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, "");
  s = s.replace(/<\s*(script|style|iframe|object|embed)[^>]*\/?\s*>/gi, "");
  s = s.replace(/\son\w+\s*=\s*(['"])[\s\S]*?\1/gi, "");
  s = s.replace(/\son\w+\s*=\s*[^\s>]+/gi, "");
  s = s.replace(/javascript:/gi, "");
  const allowed = new Set(["b", "strong", "em", "i", "br"]);
  s = s.replace(/<\/?([a-zA-Z0-9]+)(\s[^>]*)?>/g, (match, tag: string) => {
    const t = tag.toLowerCase();
    if (!allowed.has(t)) return "";
    if (t === "br") return "<br />";
    if (match.startsWith("</")) return `</${t}>`;
    return `<${t}>`;
  });
  return s;
}
