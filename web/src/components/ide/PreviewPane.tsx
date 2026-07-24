import { lazy, Suspense, useMemo } from "react";
import { previewKindOf } from "../../lib/fileTypes";
import { injectPreviewViewport } from "../../lib/htmlPreview";

const MarkdownPreview = lazy(() =>
  import("./MarkdownPreview").then((m) => ({ default: m.MarkdownPreview })),
);

function tryFormatJson(text: string): string {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}

export function PreviewPane({
  path,
  content,
  previewMode,
  previewUrl,
  previewHtml,
}: {
  path: string | null;
  content: string;
  previewMode: "url" | "srcdoc";
  previewUrl: string | null;
  previewHtml: string | null;
}) {
  const kind = path ? previewKindOf(path) : "none";

  const structured = useMemo(() => {
    if (kind === "json") return tryFormatJson(content);
    if (kind === "yaml") return content;
    return "";
  }, [kind, content]);

  const srcDoc =
    previewMode === "srcdoc" && kind === "html" ? injectPreviewViewport(previewHtml || content) : "";

  return (
    <div className="lab-ide-preview ide-preview">
      <div className="lab-ide-preview-head">
        预览 · {kind === "none" ? "不可预览" : kind}
      </div>
      <div className="ide-preview-body">
        {kind === "html" && previewMode === "url" && previewUrl ? (
          <div className="ide-preview-frame-wrap">
            <iframe title="作品预览" className="lab-preview-frame" src={previewUrl} sandbox="allow-scripts allow-same-origin" />
          </div>
        ) : kind === "html" && previewMode === "srcdoc" && srcDoc ? (
          <div className="ide-preview-frame-wrap">
            <iframe
              key={`${path ?? ""}:${srcDoc.length}`}
              title="作品预览"
              className="lab-preview-frame"
              srcDoc={srcDoc}
              sandbox="allow-scripts"
            />
          </div>
        ) : kind === "markdown" && content ? (
          <Suspense fallback={<p className="muted" style={{ padding: 12 }}>渲染 Markdown…</p>}>
            <MarkdownPreview source={content} />
          </Suspense>
        ) : kind === "json" || kind === "yaml" ? (
          <pre className="ide-structure-preview">{structured || content || "（空）"}</pre>
        ) : kind === "image" && previewUrl ? (
          <div className="ide-image-preview">
            <img src={previewUrl} alt={path || "image"} />
          </div>
        ) : (
          <p className="muted" style={{ padding: 12, fontSize: 13 }}>
            {path
              ? "此文件类型无富预览。HTML / Markdown / YAML / JSON / 图片可在此查看。"
              : "生成或打开 HTML / Markdown 后点「运行」"}
          </p>
        )}
      </div>
    </div>
  );
}
