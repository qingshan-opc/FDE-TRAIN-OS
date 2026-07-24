export type OpenTab = {
  path: string;
  dirty?: boolean;
  diagnostics?: number;
};

export function EditorTabs({
  tabs,
  activePath,
  onSelect,
  onClose,
}: {
  tabs: OpenTab[];
  activePath: string | null;
  onSelect: (path: string) => void;
  onClose: (path: string) => void;
}) {
  if (!tabs.length) {
    return <div className="ide-tabs empty muted">未打开文件</div>;
  }
  return (
    <div className="ide-tabs" role="tablist" aria-label="打开的文件">
      {tabs.map((t) => {
        const name = t.path.split("/").pop() || t.path;
        const active = t.path === activePath;
        return (
          <div key={t.path} className={`ide-tab${active ? " active" : ""}`} role="presentation">
            <button
              type="button"
              role="tab"
              aria-selected={active}
              className="ide-tab-btn"
              title={t.path}
              onClick={() => onSelect(t.path)}
            >
              {name}
              {t.dirty ? " •" : ""}
              {t.diagnostics ? (
                <span className="ide-tab-diag" title={`${t.diagnostics} 个问题`}>
                  {t.diagnostics}
                </span>
              ) : null}
            </button>
            <button
              type="button"
              className="ide-tab-close"
              aria-label={`关闭 ${name}`}
              tabIndex={-1}
              onClick={(e) => {
                e.stopPropagation();
                onClose(t.path);
              }}
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}
