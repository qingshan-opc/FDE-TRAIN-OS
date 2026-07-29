import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";

/**
 * 内部文档阅读页：把 class/ 下的 Markdown 课件渲染成系统内图文页。
 * URL: /docs/<path>  →  原文取自 /course-assets/<path>（StaticFiles 挂 class/）。
 * 相对图片/链接按文档所在目录解析回 /course-assets 或 /docs 路由。
 */

function resolveRelative(baseDir: string, rel: string): string {
  const parts = (baseDir ? baseDir.split("/") : []).filter(Boolean);
  for (const seg of rel.split("/")) {
    if (seg === "." || seg === "") continue;
    if (seg === "..") parts.pop();
    else parts.push(seg);
  }
  return parts.join("/");
}

export function DocReaderPage() {
  const location = useLocation();
  const docPath = useMemo(
    () => decodeURIComponent(location.pathname.replace(/^\/docs\/?/, "")),
    [location.pathname],
  );
  const baseDir = docPath.includes("/") ? docPath.slice(0, docPath.lastIndexOf("/")) : "";
  const [source, setSource] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setSource(null);
    setError(null);
    if (!docPath || docPath.includes("..")) {
      setError("文档路径无效");
      return;
    }
    fetch(`/course-assets/${docPath}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();
        if (!cancelled) setSource(text);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "加载失败");
      });
    return () => {
      cancelled = true;
    };
  }, [docPath]);

  const title = useMemo(() => {
    if (!source) return docPath;
    const m = source.match(/^#\s+(.+)$/m);
    return m ? m[1].trim() : docPath;
  }, [source, docPath]);

  return (
    <div className="doc-reader-shell">
      <header className="doc-reader-topbar">
        <div className="doc-reader-topbar-inner">
          <Link to="/app" className="doc-reader-back">
            ← 返回学习台
          </Link>
          <span className="doc-reader-crumb muted">课程文档 · {docPath}</span>
        </div>
      </header>
      <main className="doc-reader-main">
        {error ? (
          <div className="doc-reader-state">
            <h2>文档加载失败</h2>
            <p className="muted">
              {error} · <code>/course-assets/{docPath}</code>
            </p>
          </div>
        ) : source === null ? (
          <div className="doc-reader-state">
            <p className="muted">加载中…</p>
          </div>
        ) : (
          <article className="doc-reader-article">
            <h1 className="doc-reader-title">{title}</h1>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeSanitize]}
              components={{
                img({ src, alt }) {
                  const raw = typeof src === "string" ? src : "";
                  const resolved = /^https?:\/\//.test(raw)
                    ? raw
                    : `/course-assets/${resolveRelative(baseDir, raw)}`;
                  return <img src={resolved} alt={alt || ""} loading="lazy" />;
                },
                a({ href, children }) {
                  const raw = typeof href === "string" ? href : "";
                  if (/^https?:\/\//.test(raw)) {
                    return (
                      <a href={raw} target="_blank" rel="noreferrer">
                        {children}
                      </a>
                    );
                  }
                  const resolved = resolveRelative(baseDir, raw);
                  if (resolved.endsWith(".md")) {
                    return <Link to={`/docs/${resolved}`}>{children}</Link>;
                  }
                  return (
                    <a href={`/course-assets/${resolved}`} target="_blank" rel="noreferrer">
                      {children}
                    </a>
                  );
                },
              }}
            >
              {source}
            </ReactMarkdown>
          </article>
        )}
      </main>
    </div>
  );
}
