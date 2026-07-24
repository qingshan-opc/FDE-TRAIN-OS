import type { InputHTMLAttributes, TextareaHTMLAttributes, ReactNode } from "react";

const fieldClass =
  "w-full rounded-md border border-fde-border bg-white px-3 py-2 text-sm text-fde-ink outline-none focus:border-fde-accent focus:ring-2 focus:ring-fde-accent/20 disabled:opacity-50";

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${fieldClass} ${props.className || ""}`} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${fieldClass} ${props.className || ""}`} />;
}

export function Field({ label, htmlFor, children }: { label: string; htmlFor?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-xs font-medium text-fde-muted">
        {label}
      </label>
      {children}
    </div>
  );
}
