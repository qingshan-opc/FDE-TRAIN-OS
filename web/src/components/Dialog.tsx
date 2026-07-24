import { useEffect, useId, useRef, type ReactNode } from "react";

export function Dialog({
  open,
  title,
  children,
  onClose,
  footer,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  footer?: ReactNode;
}) {
  const titleId = useId();
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  if (!open) return null;

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      style={{
        border: "1px solid #d1d5db",
        borderRadius: 4,
        padding: 0,
        maxWidth: 520,
        width: "calc(100% - 32px)",
        background: "#fff",
      }}
    >
      <div style={{ padding: 20 }}>
        <div className="row" style={{ justifyContent: "space-between", marginBottom: 12 }}>
          <h2 id={titleId} style={{ fontSize: 20 }}>
            {title}
          </h2>
          <button type="button" className="btn-ghost" onClick={onClose} aria-label="关闭">
            ✕
          </button>
        </div>
        <div>{children}</div>
        {footer && <div className="row" style={{ marginTop: 16, justifyContent: "flex-end" }}>{footer}</div>}
      </div>
    </dialog>
  );
}
