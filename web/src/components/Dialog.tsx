import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

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

  return createPortal(
    <dialog
      ref={ref}
      className="fde-dialog"
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="fde-dialog__body">
        <div className="fde-dialog__head">
          <h2 id={titleId} className="fde-dialog__title">
            {title}
          </h2>
          <button type="button" className="btn-ghost fde-dialog__close" onClick={onClose} aria-label="关闭">
            ✕
          </button>
        </div>
        <div className="fde-dialog__content">{children}</div>
        {footer && <div className="fde-dialog__footer">{footer}</div>}
      </div>
    </dialog>,
    document.body,
  );
}
