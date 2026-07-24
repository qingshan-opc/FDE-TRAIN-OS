/** Inline same-directory stylesheet/script refs for iframe srcdoc preview. */

const LINK_RE = /<link\b[^>]*\bhref=["']([^"']+)["'][^>]*>/gi;
const SCRIPT_RE = /<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>\s*<\/script>/gi;

function isRelativeAsset(ref: string): boolean {
  if (!ref || ref.startsWith("http://") || ref.startsWith("https://") || ref.startsWith("//")) {
    return false;
  }
  return !ref.startsWith("/");
}

function dirname(path: string): string {
  const i = path.lastIndexOf("/");
  return i >= 0 ? path.slice(0, i) : "";
}

function joinPath(dir: string, ref: string): string {
  const clean = ref.replace(/^\.\//, "");
  if (!dir) return clean;
  return `${dir}/${clean}`.replace(/\/+/g, "/");
}

export async function buildHtmlSrcdoc(
  htmlPath: string,
  htmlContent: string,
  readFile: (path: string) => Promise<string | null>,
): Promise<string> {
  let doc = htmlContent;

  const dir = dirname(htmlPath);
  const linkMatches = [...htmlContent.matchAll(LINK_RE)];
  for (const m of linkMatches) {
    const ref = m[1];
    if (!isRelativeAsset(ref)) continue;
    const assetPath = joinPath(dir, ref);
    const css = await readFile(assetPath);
    if (css == null) continue;
    const styleTag = `<style data-inlined-from="${ref}">\n${css}\n</style>`;
    doc = doc.replace(m[0], styleTag);
  }

  const scriptMatches = [...htmlContent.matchAll(SCRIPT_RE)];
  for (const m of scriptMatches) {
    const ref = m[1];
    if (!isRelativeAsset(ref)) continue;
    const assetPath = joinPath(dir, ref);
    const js = await readFile(assetPath);
    if (js == null) continue;
    const scriptTag = `<script data-inlined-from="${ref}">\n${js}\n</script>`;
    doc = doc.replace(m[0], scriptTag);
  }

  return doc;
}

/** Ensure iframe HTML uses device width so layouts fill the preview panel. */
export function injectPreviewViewport(html: string): string {
  if (/<meta[^>]+name=["']viewport["']/i.test(html)) return html;
  const viewport = '<meta name="viewport" content="width=device-width, initial-scale=1">';
  if (/<head[\s>]/i.test(html)) return html.replace(/<head[^>]*>/i, (m) => `${m}${viewport}`);
  return `<!doctype html><html><head>${viewport}</head><body>${html}</body></html>`;
}

/** Allow inlined workspace scripts/styles inside Lab preview iframes (parent CSP is stricter). */
export function injectPreviewCsp(html: string): string {
  const csp =
    "<meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob: https:;\">";
  const withViewport = injectPreviewViewport(html);
  if (/<head[\s>]/i.test(withViewport)) return withViewport.replace(/<head[^>]*>/i, (m) => `${m}${csp}`);
  return `<!doctype html><html><head>${csp}</head><body>${html}</body></html>`;
}
