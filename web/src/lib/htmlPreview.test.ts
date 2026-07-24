import { describe, expect, it, vi } from "vitest";
import { buildHtmlSrcdoc, injectPreviewCsp } from "./htmlPreview";

describe("buildHtmlSrcdoc", () => {
  it("inlines relative css and js", async () => {
    const html = `<!doctype html>
<html><head><link rel="stylesheet" href="styles.css" /></head>
<body><h1>库存</h1><script src="app.js"></script></body></html>`;
    const read = vi.fn(async (p: string) => {
      if (p === "styles.css") return "body{color:red}";
      if (p === "app.js") return 'document.body.dataset.ok="1";';
      return null;
    });
    const out = await buildHtmlSrcdoc("index.html", html, read);
    expect(out).toContain("<style");
    expect(out).toContain("body{color:red}");
    expect(out).toContain('<script data-inlined-from="app.js">');
    expect(out).not.toContain('href="styles.css"');
    expect(out).not.toContain('src="app.js"');
  });

  it("resolves assets under subdirectories", async () => {
    const html = '<script src="./util.js"></script>';
    const read = vi.fn(async (p: string) => (p === "pages/util.js" ? "void 0;" : null));
    const out = await buildHtmlSrcdoc("pages/index.html", html, read);
    expect(read).toHaveBeenCalledWith("pages/util.js");
    expect(out).toContain("void 0;");
  });

  it("injects preview CSP meta into head", () => {
    const out = injectPreviewCsp("<html><head></head><body></body></html>");
    expect(out).toContain("Content-Security-Policy");
    expect(out).toContain("unsafe-inline");
    expect(out).toContain('name="viewport"');
  });
});
