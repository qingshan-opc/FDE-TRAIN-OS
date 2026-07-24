import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";

export function AppShell({
  topbar,
  sidebar,
  children,
}: {
  topbar: ReactNode;
  sidebar?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-fde-bg text-fde-ink font-sans">
      {topbar}
      <div className={sidebar ? "mx-auto flex min-h-[calc(100vh-var(--nav-h))] max-w-[1600px]" : ""}>
        {sidebar}
        <main className={`min-w-0 flex-1 p-4 md:p-6 ${sidebar ? "" : ""}`}>{children}</main>
      </div>
    </div>
  );
}

export function SideNav({ items }: { items: { to: string; label: string; end?: boolean }[] }) {
  return (
    <nav
      aria-label="侧栏导航"
      className="hidden w-56 shrink-0 border-r border-fde-border bg-fde-elevated p-3 md:block"
    >
      <ul className="flex flex-col gap-1">
        {items.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `block rounded-md px-3 py-2 text-sm transition ${
                  isActive
                    ? "bg-fde-accent/10 font-medium text-fde-accent"
                    : "text-fde-muted hover:bg-fde-bg hover:text-fde-ink"
                }`
              }
            >
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
