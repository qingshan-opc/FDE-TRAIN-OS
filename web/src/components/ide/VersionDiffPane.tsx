import { DiffEditor } from "@monaco-editor/react";
import { monacoLanguageOf } from "../../lib/fileTypes";
import "../../lib/monacoSetup";

export function VersionDiffPane({
  path,
  original,
  modified,
  onClose,
}: {
  path: string;
  original: string;
  modified: string;
  onClose: () => void;
}) {
  return (
    <div className="ide-version-diff" aria-label="版本差异">
      <div className="lab-ide-preview-head row" style={{ justifyContent: "space-between" }}>
        <span>
          对比 · <span className="mono">{path}</span>（左：快照 · 右：当前）
        </span>
        <button type="button" onClick={onClose}>
          关闭
        </button>
      </div>
      <div className="ide-diff-body">
        <DiffEditor
          height="100%"
          language={monacoLanguageOf(path)}
          original={original}
          modified={modified}
          options={{
            readOnly: true,
            renderSideBySide: true,
            minimap: { enabled: false },
            fontSize: 12,
            automaticLayout: true,
          }}
          loading={<div className="muted" style={{ padding: 12 }}>加载 Diff…</div>}
        />
      </div>
    </div>
  );
}
