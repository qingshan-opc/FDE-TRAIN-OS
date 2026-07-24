import type { ReactNode } from "react";

export function Card({
  children,
  className = "",
  title,
  subtitle,
}: {
  children?: ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
}) {
  return (
    <section className={`rounded-md border border-fde-border bg-fde-elevated p-4 shadow-sm ${className}`}>
      {(title || subtitle) && (
        <header className="mb-3">
          {title && <h3 className="text-base font-semibold text-fde-strong">{title}</h3>}
          {subtitle && <p className="mt-1 text-sm text-fde-muted">{subtitle}</p>}
        </header>
      )}
      {children}
    </section>
  );
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "accent" | "success" | "warn" }) {
  const tones = {
    neutral: "bg-fde-bg text-fde-muted border-fde-border",
    accent: "bg-fde-accent/10 text-fde-accent border-fde-accent/20",
    success: "bg-fde-success/10 text-fde-success border-fde-success/20",
    warn: "bg-amber-50 text-amber-700 border-amber-200",
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-fde-strong">{title}</h1>
        {description && <p className="mt-1 text-sm text-fde-muted">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
