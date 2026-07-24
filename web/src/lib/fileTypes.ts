export type IdeLanguage =
  | "html"
  | "css"
  | "javascript"
  | "typescript"
  | "json"
  | "yaml"
  | "markdown"
  | "sql"
  | "shell"
  | "plaintext";

export type PreviewKind = "html" | "markdown" | "json" | "yaml" | "image" | "none";

const EXT_MAP: Record<string, { language: IdeLanguage; preview: PreviewKind; mime: string }> = {
  ".html": { language: "html", preview: "html", mime: "text/html" },
  ".htm": { language: "html", preview: "html", mime: "text/html" },
  ".css": { language: "css", preview: "none", mime: "text/css" },
  ".js": { language: "javascript", preview: "none", mime: "text/javascript" },
  ".jsx": { language: "javascript", preview: "none", mime: "text/javascript" },
  ".ts": { language: "typescript", preview: "none", mime: "text/typescript" },
  ".tsx": { language: "typescript", preview: "none", mime: "text/typescript" },
  ".json": { language: "json", preview: "json", mime: "application/json" },
  ".yaml": { language: "yaml", preview: "yaml", mime: "text/yaml" },
  ".yml": { language: "yaml", preview: "yaml", mime: "text/yaml" },
  ".md": { language: "markdown", preview: "markdown", mime: "text/markdown" },
  ".markdown": { language: "markdown", preview: "markdown", mime: "text/markdown" },
  ".sql": { language: "sql", preview: "none", mime: "application/sql" },
  ".sh": { language: "shell", preview: "none", mime: "text/x-shellscript" },
  ".bash": { language: "shell", preview: "none", mime: "text/x-shellscript" },
  ".txt": { language: "plaintext", preview: "none", mime: "text/plain" },
  ".png": { language: "plaintext", preview: "image", mime: "image/png" },
  ".jpg": { language: "plaintext", preview: "image", mime: "image/jpeg" },
  ".jpeg": { language: "plaintext", preview: "image", mime: "image/jpeg" },
  ".gif": { language: "plaintext", preview: "image", mime: "image/gif" },
  ".webp": { language: "plaintext", preview: "image", mime: "image/webp" },
  ".svg": { language: "plaintext", preview: "image", mime: "image/svg+xml" },
};

const BINARY_EXT = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".pdf", ".zip", ".woff", ".woff2", ".ico"]);

export function extOf(path: string): string {
  const base = path.split("/").pop() || path;
  const i = base.lastIndexOf(".");
  return i >= 0 ? base.slice(i).toLowerCase() : "";
}

export function languageOf(path: string): IdeLanguage {
  return EXT_MAP[extOf(path)]?.language || "plaintext";
}

export function previewKindOf(path: string): PreviewKind {
  return EXT_MAP[extOf(path)]?.preview || "none";
}

export function mimeOf(path: string): string {
  return EXT_MAP[extOf(path)]?.mime || "text/plain";
}

export function isBinaryPath(path: string): boolean {
  return BINARY_EXT.has(extOf(path));
}

export function isEditablePath(path: string): boolean {
  return !isBinaryPath(path);
}

export function fileIcon(path: string): string {
  const lang = languageOf(path);
  switch (lang) {
    case "html":
      return "🌐";
    case "css":
      return "🎨";
    case "javascript":
    case "typescript":
      return "⚡";
    case "json":
      return "{}";
    case "yaml":
      return "⚙";
    case "markdown":
      return "📝";
    case "sql":
      return "🗄";
    case "shell":
      return "💻";
    default:
      return isBinaryPath(path) ? "🖼" : "📄";
  }
}

export function monacoLanguageOf(path: string): string {
  const lang = languageOf(path);
  if (lang === "shell") return "shell";
  if (lang === "yaml") return "yaml";
  return lang;
}
