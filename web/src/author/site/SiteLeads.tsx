import { useCallback, useEffect, useState } from "react";
import { App, Button, Form, Typography } from "antd";
import { authorApi, ApiError } from "../../lib/api";
import type { Paginated } from "../../lib/listQuery";
import { useListQuery } from "../../lib/useListQuery";
import { PageHeader, SearchToolbar, ServerTable, EntityModal, type EntityModalMode } from "../../components/crud";

type Lead = {
  id: string;
  name: string;
  org?: string | null;
  email?: string | null;
  message?: string | null;
  created_at?: string;
};

export function SiteLeads() {
  const { message } = App.useApp();
  const { page, page_size, q, hasFilters, setPage, setFilter, reset } = useListQuery();
  const [data, setData] = useState<Paginated<Lead> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<EntityModalMode>({ kind: "closed" });
  const [current, setCurrent] = useState<Lead | null>(null);
  const [form] = Form.useForm();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await authorApi.listContactLeads({ page, page_size, q: q || undefined }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "加载失败");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [page, page_size, q]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div>
      <PageHeader title="联系线索" description="Landing 预约/联系表单提交" />
      <SearchToolbar
        fields={[{ key: "q", type: "search", label: "搜索", placeholder: "姓名 / 组织 / 邮箱" }]}
        values={{ q: q || undefined }}
        onChange={setFilter}
        onReset={hasFilters ? reset : undefined}
      />
      <ServerTable<Lead>
        rowKey="id"
        loading={loading}
        error={error}
        onRetry={() => void load()}
        data={data}
        onPageChange={setPage}
        columns={[
          { title: "姓名", dataIndex: "name" },
          { title: "组织", dataIndex: "org", responsive: ["md"] },
          { title: "邮箱", dataIndex: "email" },
          { title: "时间", dataIndex: "created_at", responsive: ["md"] },
          {
            title: "操作",
            render: (_, r) => (
              <Button
                type="link"
                onClick={() => {
                  setCurrent(r);
                  setMode({ kind: "view", id: r.id });
                }}
              >
                查看
              </Button>
            ),
          },
        ]}
      />
      <EntityModal
        mode={mode}
        title={{ create: "线索", edit: "线索", view: "线索详情" }}
        form={form}
        onClose={() => setMode({ kind: "closed" })}
        onSubmit={async () => undefined}
      >
        <Typography.Paragraph>
          <strong>姓名：</strong>
          {current?.name}
        </Typography.Paragraph>
        <Typography.Paragraph>
          <strong>组织：</strong>
          {current?.org || "—"}
        </Typography.Paragraph>
        <Typography.Paragraph>
          <strong>邮箱：</strong>
          {current?.email || "—"}{" "}
          {current?.email && (
            <Button
              size="small"
              onClick={() => {
                void navigator.clipboard.writeText(current.email || "");
                message.success("已复制邮箱");
              }}
            >
              复制
            </Button>
          )}
        </Typography.Paragraph>
        <Typography.Paragraph>
          <strong>留言：</strong>
          {current?.message || "—"}
        </Typography.Paragraph>
      </EntityModal>
    </div>
  );
}
