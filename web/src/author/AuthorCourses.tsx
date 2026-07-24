import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { App, Button, Form, Input, Space, Tag } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { authorApi, ApiError } from "../lib/api";
import type { AuthorCourse } from "../lib/types";
import type { Paginated } from "../lib/listQuery";
import { useListQuery } from "../lib/useListQuery";
import {
  PageHeader,
  SearchToolbar,
  ServerTable,
  EntityModal,
  useDeleteConfirm,
  type EntityModalMode,
} from "../components/crud";

function slugify(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9\u4e00-\u9fff-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
}

export function AuthorCourses() {
  const { message } = App.useApp();
  const nav = useNavigate();
  const confirmDelete = useDeleteConfirm();
  const { page, page_size, q, filters, hasFilters, setPage, setFilter, reset } = useListQuery();
  const [data, setData] = useState<Paginated<AuthorCourse> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<EntityModalMode>({ kind: "closed" });
  const [editing, setEditing] = useState<AuthorCourse | null>(null);
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authorApi.listCoursesPaged({
        q: q || undefined,
        status: filters.status,
        page,
        page_size,
      });
      setData(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "加载失败");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [q, filters.status, page, page_size]);

  useEffect(() => {
    void load();
  }, [load]);

  const openDesign = async (row: AuthorCourse) => {
    try {
      const res = await authorApi.listCourseVersionsPaged({
        course_id: row.id,
        page: 1,
        page_size: 50,
      });
      const items = res.items || [];
      const drafts = items.filter((v) => v.status === "draft");
      if (drafts.length === 1) {
        nav(
          `/author/curriculum/courses/${encodeURIComponent(row.id)}/versions/${encodeURIComponent(drafts[0].id)}`,
        );
        return;
      }
      if (items.length === 1 && items[0].course_id) {
        nav(
          `/author/curriculum/courses/${encodeURIComponent(row.id)}/versions/${encodeURIComponent(items[0].id)}`,
        );
        return;
      }
      nav(`/author/curriculum/versions?course_id=${encodeURIComponent(row.id)}`);
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : "打开失败");
      nav(`/author/curriculum/versions?course_id=${encodeURIComponent(row.id)}`);
    }
  };

  return (
    <div>
      <PageHeader
        title="课程与大纲"
        description="维护课程目录；点「设计大纲」进入课纲工作台，版本管理请到「课程版本」"
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
            新增课程
          </Button>
        }
      />
      <SearchToolbar
        fields={[
          { key: "q", type: "search", label: "搜索", placeholder: "搜索课程标题/slug" },
          {
            key: "status",
            type: "select",
            label: "状态",
            options: [
              { value: "active", label: "活跃" },
              { value: "draft", label: "草稿" },
              { value: "archived", label: "已归档" },
            ],
          },
        ]}
        values={{ q: q || undefined, status: filters.status }}
        onChange={setFilter}
        onReset={hasFilters ? reset : undefined}
      />
      <ServerTable<AuthorCourse>
        data={data}
        loading={loading}
        error={error}
        onRetry={() => void load()}
        onPageChange={setPage}
        rowKey="id"
        columns={[
          { title: "标题", dataIndex: "title", key: "title" },
          { title: "slug", dataIndex: "slug", key: "slug", className: "mono", responsive: ["md"] },
          {
            title: "状态",
            dataIndex: "status",
            key: "status",
            width: 100,
            render: (s: string) => <Tag>{s}</Tag>,
          },
          {
            title: "版本数",
            dataIndex: "version_count",
            key: "version_count",
            width: 90,
            responsive: ["md"],
          },
          {
            title: "操作",
            key: "actions",
            fixed: "right",
            width: 280,
            render: (_: unknown, row: AuthorCourse) => (
              <Space wrap>
                <Button
                  type="link"
                  size="small"
                  onClick={() => void openDesign(row)}
                >
                  设计大纲
                </Button>
                <Button
                  type="link"
                  size="small"
                  onClick={() => {
                    setEditing(row);
                    form.setFieldsValue(row);
                    setMode({ kind: "edit", id: row.id });
                  }}
                >
                  编辑
                </Button>
                {row.status !== "archived" && (
                  <Button
                    type="link"
                    size="small"
                    danger
                    onClick={() =>
                      confirmDelete({
                        name: row.title,
                        impact: "将课程标记为归档；不会硬删除历史版本与学习数据。",
                        onOk: async () => {
                          await authorApi.patchCourse(row.id, { status: "archived" });
                          message.success("已归档");
                          await load();
                        },
                      })
                    }
                  >
                    归档
                  </Button>
                )}
              </Space>
            ),
          },
        ]}
      />

      <EntityModal
        mode={mode}
        title={{ create: "新增课程", edit: "编辑课程", view: "查看课程" }}
        form={form}
        submitting={submitting}
        onClose={() => setMode({ kind: "closed" })}
        onSubmit={async (values: { title: string; slug: string; description?: string }) => {
          setSubmitting(true);
          try {
            if (mode.kind === "create") {
              await authorApi.createCourse({
                title: values.title.trim(),
                slug: (values.slug || slugify(values.title)).trim(),
                description: values.description?.trim() || undefined,
              });
              message.success("课程已创建");
              setMode({ kind: "closed" });
              await load();
              nav("/author/curriculum/versions");
            } else if (editing) {
              await authorApi.patchCourse(editing.id, {
                title: values.title.trim(),
                description: values.description?.trim() || undefined,
              });
              message.success("已保存");
              setMode({ kind: "closed" });
              await load();
            }
          } catch (err) {
            message.error(err instanceof ApiError ? err.message : "保存失败");
          } finally {
            setSubmitting(false);
          }
        }}
      >
        <Form.Item name="title" label="标题" rules={[{ required: true, message: "请填写标题" }]}>
          <Input
            onChange={(e) => {
              if (mode.kind === "create" && !form.isFieldTouched("slug")) {
                form.setFieldValue("slug", slugify(e.target.value));
              }
            }}
          />
        </Form.Item>
        <Form.Item
          name="slug"
          label="slug"
          rules={[{ required: true, message: "请填写 slug" }]}
          extra={mode.kind === "edit" ? "已创建课程的 slug 不可修改" : "自动生成，可改；全局唯一"}
        >
          <Input className="mono" disabled={mode.kind === "edit"} />
        </Form.Item>
        <Form.Item name="description" label="简介">
          <Input.TextArea rows={3} />
        </Form.Item>
      </EntityModal>
    </div>
  );
}
