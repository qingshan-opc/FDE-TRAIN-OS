import { useCallback, useEffect, useMemo, useState } from "react";
import {
  App,
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Upload,
} from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { authorApi, ApiError } from "../../lib/api";
import type { LandingOpenCourseCategory } from "../../lib/types";
import type { Paginated } from "../../lib/listQuery";
import { useListQuery } from "../../lib/useListQuery";
import {
  AuthorListPageLayout,
  PageHeader,
  SearchToolbar,
  ServerTable,
  EntityModal,
  useDeleteConfirm,
  type EntityModalMode,
} from "../../components/crud";

type OpenCourse = {
  id: string;
  title: string;
  minutes?: number;
  level?: string;
  category_id?: string | null;
  summary?: string;
  published?: boolean;
  object_key?: string;
  poster_key?: string;
};

export function SiteOpenCourses() {
  const { message } = App.useApp();
  const confirmDelete = useDeleteConfirm();
  const { page, page_size, q, filters, setPage, setFilter, reset } = useListQuery();
  const [data, setData] = useState<Paginated<OpenCourse> | null>(null);
  const [categories, setCategories] = useState<LandingOpenCourseCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<EntityModalMode>({ kind: "closed" });
  const [editing, setEditing] = useState<OpenCourse | null>(null);
  const [form] = Form.useForm();
  const [catForm] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [catMode, setCatMode] = useState<EntityModalMode>({ kind: "closed" });
  const [editingCat, setEditingCat] = useState<LandingOpenCourseCategory | null>(null);
  const [catSubmitting, setCatSubmitting] = useState(false);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [posterFile, setPosterFile] = useState<File | null>(null);

  const loadCategories = useCallback(async () => {
    const res = await authorApi.listOpenCourseCategories();
    setCategories(res.items || []);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [res] = await Promise.all([
        authorApi.listOpenCoursesPaged({
          page,
          page_size,
          q: q || undefined,
          published: filters.published,
          category_id: filters.category_id,
        }),
        loadCategories(),
      ]);
      setData(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "加载失败");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [page, page_size, q, filters.published, filters.category_id, loadCategories]);

  useEffect(() => {
    void load();
  }, [load]);

  const catNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of categories) m.set(c.id, c.name);
    return m;
  }, [categories]);

  const openCreate = () => {
    setEditing(null);
    setVideoFile(null);
    setPosterFile(null);
    setMode({ kind: "create" });
  };

  const openEdit = (row: OpenCourse) => {
    setEditing(row);
    setVideoFile(null);
    setPosterFile(null);
    setMode({ kind: "edit", id: row.id });
  };

  const formInitialValues = useMemo(() => {
    if (mode.kind === "edit" && editing) {
      return {
        title: editing.title,
        level: editing.level,
        category_id: editing.category_id || undefined,
        minutes: editing.minutes,
        summary: editing.summary,
        published: Boolean(editing.published),
      };
    }
    if (mode.kind === "create") {
      return {
        published: true,
        minutes: 10,
        category_id: categories.find((c) => c.published !== false)?.id,
      };
    }
    return null;
  }, [mode.kind, editing, categories]);

  const catFormInitial = useMemo(() => {
    if (catMode.kind === "edit" && editingCat) {
      return {
        name: editingCat.name,
        sort_order: editingCat.sort_order ?? 0,
        published: Boolean(editingCat.published),
      };
    }
    if (catMode.kind === "create") {
      return { published: true, sort_order: categories.length };
    }
    return null;
  }, [catMode.kind, editingCat, categories.length]);

  return (
    <>
      <AuthorListPageLayout
        header={
          <PageHeader
            title="站点公开课"
            description="管理公开课分类与课程；前台首页与 /open 按分类 Tab 展示"
          />
        }
        toolbar={
          <SearchToolbar
            fields={[
              { key: "q", type: "search", label: "搜索", placeholder: "搜索标题", width: 220 },
              {
                key: "category_id",
                type: "select",
                label: "分类",
                placeholder: "全部分类",
                width: 160,
                options: categories.map((c) => ({ value: c.id, label: c.name })),
              },
              {
                key: "published",
                type: "select",
                label: "发布",
                placeholder: "发布状态",
                width: 132,
                options: [
                  { value: "true", label: "已发布" },
                  { value: "false", label: "未发布" },
                ],
              },
            ]}
            values={{
              q: q || undefined,
              published: filters.published,
              category_id: filters.category_id,
            }}
            onChange={setFilter}
            onReset={reset}
            extra={
              <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
                新增公开课
              </Button>
            }
          />
        }
      >
        <Card
          size="small"
          title="分类管理"
          style={{ marginBottom: 16 }}
          extra={
            <Button
              size="small"
              icon={<PlusOutlined />}
              onClick={() => {
                setEditingCat(null);
                setCatMode({ kind: "create" });
              }}
            >
              新增分类
            </Button>
          }
        >
          <Table<LandingOpenCourseCategory>
            rowKey="id"
            size="small"
            pagination={false}
            dataSource={categories}
            columns={[
              { title: "名称", dataIndex: "name" },
              { title: "排序", dataIndex: "sort_order", width: 80 },
              {
                title: "发布",
                dataIndex: "published",
                width: 100,
                render: (v: boolean) => (
                  <Tag color={v ? "green" : "default"}>{v ? "已发布" : "隐藏"}</Tag>
                ),
              },
              {
                title: "操作",
                width: 160,
                render: (_, r) => (
                  <Space>
                    <Button
                      type="link"
                      size="small"
                      onClick={() => {
                        setEditingCat(r);
                        setCatMode({ kind: "edit", id: r.id });
                      }}
                    >
                      编辑
                    </Button>
                    <Button
                      type="link"
                      size="small"
                      danger
                      onClick={() =>
                        confirmDelete({
                          name: r.name,
                          onOk: async () => {
                            try {
                              await authorApi.deleteOpenCourseCategory(r.id);
                              message.success("已删除分类");
                              await load();
                            } catch (err) {
                              message.error(err instanceof ApiError ? err.message : "删除失败");
                              throw err;
                            }
                          },
                        })
                      }
                    >
                      删除
                    </Button>
                  </Space>
                ),
              },
            ]}
          />
        </Card>

        <ServerTable<OpenCourse>
          rowKey="id"
          loading={loading}
          error={error}
          onRetry={() => void load()}
          data={data}
          onPageChange={setPage}
          columns={[
            { title: "标题", dataIndex: "title" },
            {
              title: "分类",
              dataIndex: "category_id",
              responsive: ["md"],
              render: (v: string | null | undefined) =>
                v ? catNameById.get(v) || v : <Tag>未分类</Tag>,
            },
            { title: "级别", dataIndex: "level", responsive: ["lg"] },
            { title: "分钟", dataIndex: "minutes", responsive: ["md"] },
            {
              title: "发布",
              dataIndex: "published",
              render: (v: boolean) => (
                <Tag color={v ? "green" : "default"}>{v ? "已发布" : "草稿"}</Tag>
              ),
            },
            {
              title: "媒资",
              render: (_, r) => (r.object_key ? <Tag color="blue">已上传</Tag> : <Tag>无</Tag>),
            },
            {
              title: "操作",
              render: (_, r) => (
                <>
                  <Button type="link" onClick={() => openEdit(r)}>
                    编辑
                  </Button>
                  <Button
                    type="link"
                    danger
                    onClick={() =>
                      confirmDelete({
                        name: r.title,
                        onOk: async () => {
                          await authorApi.deleteOpenCourse(r.id);
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
      </AuthorListPageLayout>

      <EntityModal
        mode={mode}
        title={{ create: "新增公开课", edit: "编辑公开课", view: "查看" }}
        form={form}
        submitting={submitting}
        initialValues={formInitialValues}
        onClose={() => {
          setMode({ kind: "closed" });
          setEditing(null);
        }}
        onSubmit={async (values) => {
          setSubmitting(true);
          try {
            await authorApi.upsertOpenCourse({
              course_id: editing?.id,
              title: values.title,
              minutes: values.minutes,
              level: values.level,
              category_id: values.category_id || "",
              summary: values.summary,
              published: values.published,
              video: videoFile || undefined,
              poster: posterFile || undefined,
            });
            message.success("已保存");
            setMode({ kind: "closed" });
            await load();
          } finally {
            setSubmitting(false);
          }
        }}
      >
        <Form.Item name="title" label="标题" rules={[{ required: true }]}>
          <Input />
        </Form.Item>
        <Form.Item name="category_id" label="所属分类" rules={[{ required: true, message: "请选择分类" }]}>
          <Select
            allowClear
            placeholder="选择分类"
            options={categories.map((c) => ({ value: c.id, label: c.name }))}
          />
        </Form.Item>
        <Form.Item name="level" label="级别角标">
          <Input placeholder="可选，如：入门 / 进阶" />
        </Form.Item>
        <Form.Item name="minutes" label="分钟">
          <InputNumber min={1} style={{ width: "100%" }} />
        </Form.Item>
        <Form.Item name="summary" label="摘要">
          <Input.TextArea rows={3} />
        </Form.Item>
        <Form.Item name="published" label="发布" valuePropName="checked">
          <Switch />
        </Form.Item>
        <Form.Item label="视频">
          <Upload
            beforeUpload={(f) => {
              setVideoFile(f);
              return false;
            }}
            maxCount={1}
          >
            <Button>选择视频</Button>
          </Upload>
        </Form.Item>
        <Form.Item label="海报">
          <Upload
            beforeUpload={(f) => {
              setPosterFile(f);
              return false;
            }}
            maxCount={1}
          >
            <Button>选择海报</Button>
          </Upload>
        </Form.Item>
      </EntityModal>

      <EntityModal
        mode={catMode}
        title={{ create: "新增分类", edit: "编辑分类", view: "查看" }}
        form={catForm}
        submitting={catSubmitting}
        initialValues={catFormInitial}
        onClose={() => {
          setCatMode({ kind: "closed" });
          setEditingCat(null);
        }}
        onSubmit={async (values) => {
          setCatSubmitting(true);
          try {
            await authorApi.upsertOpenCourseCategory({
              id: editingCat?.id,
              name: values.name,
              sort_order: values.sort_order ?? 0,
              published: Boolean(values.published),
            });
            message.success("分类已保存");
            setCatMode({ kind: "closed" });
            await load();
          } catch (err) {
            message.error(err instanceof ApiError ? err.message : "保存失败");
          } finally {
            setCatSubmitting(false);
          }
        }}
      >
        <Form.Item name="name" label="名称" rules={[{ required: true }]}>
          <Input placeholder="如：入门、进阶、案例" />
        </Form.Item>
        <Form.Item name="sort_order" label="排序">
          <InputNumber min={0} style={{ width: "100%" }} />
        </Form.Item>
        <Form.Item name="published" label="前台展示" valuePropName="checked">
          <Switch />
        </Form.Item>
      </EntityModal>
    </>
  );
}
