import type { ReactNode } from "react";
import { Breadcrumb, Space, Typography } from "antd";
import { Link } from "react-router-dom";

type Crumb = { title: string; href?: string };

export function PageHeader({
  title,
  description,
  breadcrumb,
  extra,
}: {
  title: string;
  description?: string;
  breadcrumb?: Crumb[];
  extra?: ReactNode;
}) {
  return (
    <div className="author-page-header">
      {breadcrumb && breadcrumb.length > 0 && (
        <Breadcrumb
          style={{ marginBottom: 6 }}
          items={breadcrumb.map((c) => ({
            title: c.href ? <Link to={c.href}>{c.title}</Link> : c.title,
          }))}
        />
      )}
      <Space style={{ width: "100%", justifyContent: "space-between" }} align="start" wrap>
        <div className="author-page-header__text">
          <Typography.Title level={4} style={{ margin: 0 }} className="author-page-header__title">
            {title}
          </Typography.Title>
          {description && (
            <Typography.Text type="secondary" className="author-page-header__desc">
              {description}
            </Typography.Text>
          )}
        </div>
        {extra && <Space wrap className="author-page-header__extra">{extra}</Space>}
      </Space>
    </div>
  );
}
