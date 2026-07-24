import { useCallback, useEffect, useState } from "react";
import { App, Button, Form, Input, Tag } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { authorApi, ApiError } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import type { Paginated } from "../../lib/listQuery";
import { useListQuery } from "../../lib/useListQuery";
import { PageHeader, SearchToolbar, ServerTable, EntityModal, useDeleteConfirm, type EntityModalMode } from "../../components/crud";

type Pack = {
  id: string;
  name: string;
  description?: string | null;
  course_version_id?: string | null;
  resource_count?: number;
  created_at?: string;
};

export function MaterialPacks() {
  const { campId } = useAuth();
  const { message } = App.useApp();
  const confirmDelete = useDeleteConfirm();
  const { page, page_size, q, hasFilters, setPage, setFilter, reset } = useListQuery();
  const [data, setData] = useState<Paginated<Pack> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<EntityModalMode>({ kind: "closed" });
  const [editing, setEditing] = useState<Pack | null>(null);
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await authorApi.listResourcePacks({ camp_id: campId || undefined, q: q || undefined, page, page_size }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "加载失败");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [campId, q, page, page_size]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div>
      <PageHeader
        title="素材包"
        description="按课程版本组织文档/视频素材"
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setEditing(null);
              form.resetFields();
              setMode({ kind: "create" });
            }}
          >
            新建素材包
          </Button>
        }
      />
      <SearchToolbar
        fields={[{ key: "q", type: "search", label: "搜索", placeholder: "搜索包名" }]}
        values={{ q: q || undefined }}
        onChange={setFilter}
        onReset={hasFilters ? reset : undefined}
      />
      <ServerTable<Pack>
        rowKey="id"
        loading={loading}
        error={error}
        onRetry={() => void load()}
        data={data}
        onPageChange={setPage}
        columns={[
          { title: "名称", dataIndex: "name" },
          { title: "说明", dataIndex: "description", responsive: ["md"], ellipsis: true },
          {
            title: "资源数",
            dataIndex: "resource_count",
            render: (n?: number) => <Tag>{n ?? 0}</Tag>,
          },
          { title: "创建时间", dataIndex: "created_at", responsive: ["lg"] },
          {
            title: "操作",
            render: (_, r) => (
              <>
                <Button
                  type="link"
                  onClick={() => {
                    setEditing(r);
                    form.setFieldsValue(r);
                    setMode({ kind: "edit", id: r.id });
                  }}
                >
                  编辑
                </Button>
                <Button
                  type="link"
                  danger
                  onClick={() =>
                    confirmDelete({
                      name: r.name,
                      onOk: async () => {
                        await authorApi.deleteResourcePack(r.id);
                        message.success("已删除");
                        await load();
                      },
                    })
                  }
                >
                  删除
                </Button>
              </>
            ),
          },
        ]}
      />
      <EntityModal
        mode={mode}
        title={{ create: "新建素材包", edit: "编辑素材包", view: "查看" }}
        form={form}
        submitting={submitting}
        onClose={() => setMode({ kind: "closed" })}
        onSubmit={async (values) => {
          setSubmitting(true);
          try {
            if (mode.kind === "create") {
              await authorApi.createResourcePack({
                name: values.name,
                description: values.description,
                course_version_id: values.course_version_id,
              });
            } else if (editing) {
              await authorApi.patchResourcePack(editing.id, {
                name: values.name,
                description: values.description,
              });
            }
            message.success("已保存");
            setMode({ kind: "closed" });
            await load();
          } finally {
            setSubmitting(false);
          }
        }}
      >
        <Form.Item name="name" label="名称" rules={[{ required: true }]}>
          <Input />
        </Form.Item>
        <Form.Item name="description" label="说明">
          <Input.TextArea rows={3} />
        </Form.Item>
        <Form.Item name="course_version_id" label="课程版本 ID（可选）">
          <Input placeholder="course_version uuid" />
        </Form.Item>
      </EntityModal>
    </div>
  );
}
