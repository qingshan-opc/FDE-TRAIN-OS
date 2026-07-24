import { useEffect, useId, useState } from "react";
import { Dialog } from "../Dialog";

export type ExplorerCrudMode = "new-file" | "new-dir" | "rename" | "delete";

export function ExplorerCrudDialog({
  open,
  mode,
  initialValue,
  targetPath,
  busy,
  onClose,
  onConfirm,
}: {
  open: boolean;
  mode: ExplorerCrudMode | null;
  initialValue: string;
  targetPath?: string;
  busy?: boolean;
  onClose: () => void;
  onConfirm: (value: string) => void;
}) {
  const inputId = useId();
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    if (open) setValue(initialValue);
  }, [open, initialValue, mode]);

  if (!open || !mode) return null;

  const titles: Record<ExplorerCrudMode, string> = {
    "new-file": "新建文件",
    "new-dir": "新建文件夹",
    rename: "重命名",
    delete: "删除",
  };

  const labels: Record<Exclude<ExplorerCrudMode, "delete">, string> = {
    "new-file": "文件名",
    "new-dir": "文件夹名",
    rename: "新名称",
  };

  const confirmLabel = mode === "delete" ? "确认删除" : "确定";

  return (
    <Dialog
      open={open}
      title={titles[mode]}
      onClose={onClose}
      footer={
        <>
          <button type="button" disabled={busy} onClick={onClose}>
            取消
          </button>
          <button
            type="button"
            className={mode === "delete" ? "btn-danger" : "btn-primary"}
            disabled={busy || (mode !== "delete" && !value.trim())}
            data-testid="ide-crud-confirm"
            onClick={() => onConfirm(mode === "delete" ? targetPath || "" : value.trim())}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      {mode === "delete" ? (
        <p>
          确认删除 <span className="mono">{targetPath}</span>？此操作会生成新快照，且不可撤销。
        </p>
      ) : (
        <div className="field">
          <label htmlFor={inputId}>{labels[mode]}</label>
          <input
            id={inputId}
            data-testid="ide-crud-input"
            value={value}
            autoFocus
            disabled={busy}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && value.trim()) onConfirm(value.trim());
            }}
          />
        </div>
      )}
    </Dialog>
  );
}
