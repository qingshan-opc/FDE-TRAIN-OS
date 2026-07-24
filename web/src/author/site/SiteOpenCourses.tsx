import { useCallback, useEffect, useState } from "react";
import { App, Button, Form, Input, InputNumber, Switch, Tag, Upload } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { authorApi, ApiError } from "../../lib/api";
import type { Paginated } from "../../lib/listQuery";
import { useListQuery } from "../../lib/useListQuery";
import { PageHeader, SearchToolbar, ServerTable, EntityModal, useDeleteConfirm, type EntityModalMode } from "../../components/crud";

type OpenCourse = {
  id: string;
  title: string;
  minutes?: number;
  level?: string;
  summary?: string;
  published?: boolean;
  object_key?: string;
  poster_key?: string;
};

export function SiteOpenCourses() {
  const { message } = App.useApp();
  const confirmDelete = useDeleteConfirm();
  const { page, page_size, q, filters, hasFilters, setPage, setFilter, reset } = useListQuery();
  const [data, setData] = useState<Paginated<OpenCourse> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<EntityModalMode>({ kind: "closed" });
  const [editing, setEditing] = useState<OpenCourse | null>(null);
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [posterFile, setPosterFile] = useState<File | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authorApi.listOpenCoursesPaged({
        page,
        page_size,
        q: q || undefined,
        published: filters.published,
      });
      setData(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "加载失败");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [page, page_size, q, filters.published]);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ published: true, minutes: 10 });
    setVideoFile(null);
    setPosterFile(null);
    setMode({ kind: "create" });
  };

  const openEdit = (row: OpenCourse) => {
    setEditing(row);
    form.setFieldsValue(row);
    setVideoFile(null);
    setPosterFile(null);
    setMode({ kind: "edit", id: row.id });
  };

  return (
    <div>
      <PageHeader
        title="站点公开课"
        description="Landing 公开课列表，支持搜索分页与弹窗编辑"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            新增公开课
          </Button>
        }
      />
      <SearchToolbar
        fields={[
          { key: "q", type: "search", label: "搜索", placeholder: "搜索标题" },
          {
            key: "published",
            type: "select",
            label: "发布",
            placeholder: "发布状态",
            options: [
              { value: "true", label: "已发布" },
              { value: "false", label: "未发布" },
            ],
          },
        ]}
        values={{ q: q || undefined, published: filters.published }}
        onChange={setFilter}
        onReset={hasFilters ? reset : undefined}
      />
      <ServerTable<OpenCourse>
        rowKey="id"
        loading={loading}
        error={error}
        onRetry={() => void load()}
        data={data}
        onPageChange={setPage}
        columns={[
          { title: "标题", dataIndex: "title" },
          { title: "级别", dataIndex: "level", responsive: ["md"] },
          { title: "分钟", dataIndex: "minutes", responsive: ["md"] },
          {
            title: "发布",
            dataIndex: "published",
            render: (v: boolean) => <Tag color={v ? "green" : "default"}>{v ? "已发布" : "草稿"}</Tag>,
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

      <EntityModal
        mode={mode}
        title={{ create: "新增公开课", edit: "编辑公开课", view: "查看" }}
        form={form}
        submitting={submitting}
        onClose={() => setMode({ kind: "closed" })}
        onSubmit={async (values) => {
          setSubmitting(true);
          try {
            await authorApi.upsertOpenCourse({
              course_id: editing?.id,
              title: values.title,
              minutes: values.minutes,
              level: values.level,
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
        <Form.Item name="level" label="级别">
          <Input placeholder="入门 / 进阶" />
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
    </div>
  );
}
