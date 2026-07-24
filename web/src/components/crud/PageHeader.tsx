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
    <div style={{ marginBottom: 16 }}>
      {breadcrumb && breadcrumb.length > 0 && (
        <Breadcrumb
          style={{ marginBottom: 8 }}
          items={breadcrumb.map((c) => ({
            title: c.href ? <Link to={c.href}>{c.title}</Link> : c.title,
          }))}
        />
      )}
      <Space style={{ width: "100%", justifyContent: "space-between" }} align="start" wrap>
        <div>
          <Typography.Title level={3} style={{ margin: 0 }}>
            {title}
          </Typography.Title>
          {description && <Typography.Text type="secondary">{description}</Typography.Text>}
        </div>
        {extra && <Space wrap>{extra}</Space>}
      </Space>
    </div>
  );
}
