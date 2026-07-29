import type { ReactNode } from "react";

type AuthorListPageLayoutProps = {
  header?: ReactNode;
  toolbar?: ReactNode;
  children: ReactNode;
  className?: string;
};

/** One-screen list page: fixed header/toolbar, scrollable table body only. */
export function AuthorListPageLayout({
  header,
  toolbar,
  children,
  className,
}: AuthorListPageLayoutProps) {
  return (
    <div className={`author-page author-page-list${className ? ` ${className}` : ""}`}>
      {header ? <div className="author-list-header">{header}</div> : null}
      {toolbar ? <div className="author-list-toolbar">{toolbar}</div> : null}
      <div className="author-list-body">{children}</div>
    </div>
  );
}
