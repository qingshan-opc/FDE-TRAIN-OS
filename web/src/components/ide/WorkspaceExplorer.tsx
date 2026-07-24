import { useMemo, useState } from "react";
import type { WorkspaceFile } from "../../lib/types";
import { buildFileTree, flattenTreeRows } from "../../lib/fileTree";
import { fileIcon } from "../../lib/fileTypes";

export type ExplorerAction =
  | { type: "new-file"; parentDir: string }
  | { type: "new-dir"; parentDir: string }
  | { type: "rename"; path: string; kind: "file" | "dir" }
  | { type: "delete"; path: string; kind: "file" | "dir" };

export function WorkspaceExplorer({
  files,
  selectedPath,
  onSelect,
  hasBuckets,
  locked,
  onAction,
}: {
  files: WorkspaceFile[];
  selectedPath: string | null;
  onSelect: (path: string) => void;
  hasBuckets?: boolean;
  locked?: boolean;
  onAction?: (action: ExplorerAction) => void;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set([""]));
  const [menu, setMenu] = useState<{ x: number; y: number; path: string; kind: "file" | "dir" } | null>(
    null,
  );
  const [focusDir, setFocusDir] = useState("");

  const primary = useMemo(() => files.filter((f) => f.bucket === "primary"), [files]);
  const history = useMemo(() => files.filter((f) => f.bucket !== "primary"), [files]);
  const showBuckets = Boolean(hasBuckets && files.some((f) => f.bucket));

  const toggle = (path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const parentOf = (path: string) => {
    const i = path.lastIndexOf("/");
    return i >= 0 ? path.slice(0, i) : "";
  };

  const toolbar = (
    <div className="ide-explorer-toolbar">
      <button
        type="button"
        disabled={locked || !onAction}
        title="新建文件"
        onClick={() => onAction?.({ type: "new-file", parentDir: focusDir })}
      >
        +文件
      </button>
      <button
        type="button"
        disabled={locked || !onAction}
        title="新建文件夹"
        onClick={() => onAction?.({ type: "new-dir", parentDir: focusDir })}
      >
        +文件夹
      </button>
    </div>
  );

  const renderGroup = (label: string, groupFiles: WorkspaceFile[], empty: string) => {
    const tree = buildFileTree(groupFiles);
    const rows = flattenTreeRows(tree, expanded);
    return (
      <div className="ide-explorer-group">
        <div className="file-tree-group-label">{label}</div>
        {groupFiles.length === 0 ? (
          <p className="muted" style={{ padding: "2px 8px 8px", fontSize: 12 }}>
            {empty}
          </p>
        ) : (
          <ul className="file-tree ide-file-tree" role="tree" aria-label={label}>
            {rows.map((row) => {
              if (row.kind === "dir") {
                const open = expanded.has(row.path);
                return (
                  <li
                    key={row.id}
                    role="treeitem"
                    aria-expanded={open}
                    aria-selected={focusDir === row.path}
                    className={`ide-tree-dir${focusDir === row.path ? " selected" : ""}`}
                    style={{ paddingLeft: 8 + row.depth * 12 }}
                    onClick={() => {
                      toggle(row.path);
                      setFocusDir(row.path);
                      setMenu(null);
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setFocusDir(row.path);
                      setMenu({ x: e.clientX, y: e.clientY, path: row.path, kind: "dir" });
                    }}
                  >
                    <span className="ide-tree-caret">{open ? "▾" : "▸"}</span>
                    <span className="ide-tree-icon">📁</span>
                    <span>{row.name}</span>
                  </li>
                );
              }
              return (
                <li
                  key={row.id}
                  role="treeitem"
                  aria-selected={selectedPath === row.path}
                  className={selectedPath === row.path ? "selected" : ""}
                  style={{ paddingLeft: 8 + row.depth * 12 }}
                  onClick={() => {
                    setFocusDir(parentOf(row.path));
                    onSelect(row.path);
                    setMenu(null);
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setFocusDir(parentOf(row.path));
                    setMenu({ x: e.clientX, y: e.clientY, path: row.path, kind: "file" });
                  }}
                  title={row.path}
                >
                  <span className="ide-tree-icon">{row.icon || fileIcon(row.path)}</span>
                  <span className="ide-tree-name">{row.name}</span>
                  {row.bucket === "inherited" && (
                    <span className="muted" style={{ fontSize: 11 }}>
                      {" "}
                      · 沿用
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    );
  };

  const body =
    files.length === 0 ? (
      <p className="muted" style={{ padding: 8, fontSize: 12 }}>
        点「生成」产出文件，或用上方按钮新建
      </p>
    ) : showBuckets ? (
      <>
        {renderGroup("本日作业", primary, "暂无，点「生成」产出")}
        {renderGroup("项目历史", history, "暂无")}
      </>
    ) : (
      renderGroup("工作区", files, "暂无")
    );

  return (
    <aside className="lab-ide-files ide-explorer" onClick={() => setMenu(null)}>
      <div className="lab-ide-files-head">
        <span>文件</span>
        {toolbar}
      </div>
      {body}
      {menu && onAction && !locked && (
        <div
          className="ide-context-menu"
          style={{ left: menu.x, top: menu.y }}
          role="menu"
          onClick={(e) => e.stopPropagation()}
        >
          {menu.kind === "dir" && (
            <>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  onAction({ type: "new-file", parentDir: menu.path });
                  setMenu(null);
                }}
              >
                新建文件
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  onAction({ type: "new-dir", parentDir: menu.path });
                  setMenu(null);
                }}
              >
                新建文件夹
              </button>
            </>
          )}
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onAction({ type: "rename", path: menu.path, kind: menu.kind });
              setMenu(null);
            }}
          >
            重命名
          </button>
          <button
            type="button"
            role="menuitem"
            className="danger"
            onClick={() => {
              onAction({ type: "delete", path: menu.path, kind: menu.kind });
              setMenu(null);
            }}
          >
            删除
          </button>
        </div>
      )}
    </aside>
  );
}
