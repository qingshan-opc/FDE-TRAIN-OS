import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type ToastKind = "info" | "success" | "error";

interface ToastItem {
  id: number;
  message: string;
  kind: ToastKind;
}

interface ToastCtx {
  push: (message: string, kind?: ToastKind) => void;
}

const Ctx = createContext<ToastCtx | null>(null);

let seq = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const push = useCallback((message: string, kind: ToastKind = "info") => {
    const id = ++seq;
    setItems((prev) => [...prev, { id, message, kind }]);
    window.setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id));
    }, 3600);
  }, []);

  const value = useMemo(() => ({ push }), [push]);

  return createElement(
    Ctx.Provider,
    { value },
    children,
    createElement(
      "div",
      {
        className: "toast-host",
        role: "status",
        "aria-live": "polite",
        style: {
          position: "fixed",
          right: 16,
          bottom: 16,
          zIndex: 1000,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          maxWidth: 360,
        },
      },
      items.map((t) =>
        createElement(
          "div",
          {
            key: t.id,
            style: {
              background: t.kind === "error" ? "#fff5f5" : t.kind === "success" ? "#f0fff4" : "#fff",
              color: t.kind === "error" ? "#c0392b" : t.kind === "success" ? "#0a7a3e" : "#181818",
              border: "1px solid #d1d5db",
              borderRadius: 4,
              padding: "12px 16px",
              fontSize: 14,
              boxShadow: "none",
            },
          },
          t.message,
        ),
      ),
    ),
  );
}

export function useToast(): ToastCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
