import type { ReactNode } from "react";
import { Group, Panel, Separator, type Layout } from "react-resizable-panels";

export type MobilePane = "code" | "preview" | "log";

export function IdeWorkbench({
  toolbar,
  meta,
  banners,
  mobilePane,
  onMobilePane,
  defaultLayout,
  onLayoutChanged,
  explorer,
  editor,
  preview,
  bottom,
  fab,
  dialogs,
}: {
  toolbar: ReactNode;
  meta?: ReactNode;
  banners?: ReactNode;
  mobilePane: MobilePane;
  onMobilePane: (p: MobilePane) => void;
  defaultLayout?: { files?: number; editor?: number; preview?: number };
  onLayoutChanged?: (layout: Layout) => void;
  explorer: ReactNode;
  editor: ReactNode;
  preview: ReactNode;
  bottom: ReactNode;
  fab?: ReactNode;
  dialogs?: ReactNode;
}) {
  return (
    <div className="lab-ide" aria-label="Lab 工作台">
      {toolbar}
      {banners}
      {meta}
      <div className="lab-ide-mobile-tabs" role="tablist" aria-label="移动端面板">
        {(
          [
            ["code", "代码"],
            ["preview", "预览"],
            ["log", "日志"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={mobilePane === id}
            className={mobilePane === id ? "active" : ""}
            onClick={() => onMobilePane(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className={`lab-ide-body pane-${mobilePane}`}>
        <Group
          orientation="horizontal"
          className="ide-panel-group"
          defaultLayout={{
            files: defaultLayout?.files ?? 18,
            editor: defaultLayout?.editor ?? 42,
            preview: defaultLayout?.preview ?? 40,
          }}
          onLayoutChanged={onLayoutChanged}
        >
          <Panel id="files" minSize={12} className="ide-panel-files">
            {explorer}
          </Panel>
          <Separator className="ide-resize-handle" />
          <Panel id="editor" minSize={25} className="ide-panel-editor">
            {editor}
          </Panel>
          <Separator className="ide-resize-handle" />
          <Panel id="preview" minSize={18} className="ide-panel-preview">
            {preview}
          </Panel>
        </Group>
      </div>

      {bottom}
      {fab}
      {dialogs}
    </div>
  );
}
