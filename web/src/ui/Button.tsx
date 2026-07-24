import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const VARIANT: Record<Variant, string> = {
  primary:
    "bg-fde-accent text-white border-fde-accent hover:bg-fde-accent-hover hover:border-fde-accent-hover",
  secondary: "bg-white text-fde-ink border-fde-border hover:bg-fde-bg",
  ghost: "bg-transparent text-fde-muted border-transparent hover:bg-fde-bg hover:text-fde-ink",
  danger: "bg-fde-danger text-white border-fde-danger hover:opacity-90",
};

export function Button({
  variant = "secondary",
  className = "",
  children,
  type = "button",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; children?: ReactNode }) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition disabled:opacity-45 disabled:cursor-not-allowed ${VARIANT[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
