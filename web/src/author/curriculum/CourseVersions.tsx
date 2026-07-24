import { useCallback, useEffect, useState } from "react";
import { App, Button, Form, Input, Select, Tag, Tabs, Upload } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { authorApi, ApiError } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import type { Paginated } from "../../lib/listQuery";
import { useListQuery } from "../../lib/useListQuery";
import { PageHeader, SearchToolbar, ServerTable, EntityModal, useDeleteConfirm, type EntityModalMode } from "../../components/crud";
import { authorSelectPopup, useAuthorLayout } from "../../lib/authorLayoutContext";

type VersionRow = {
  id: string;
  course_id?: string;
  course_title?: string;
  version_tag: string;
  title?: string;
  status: string;
  source?: string;
  created_at?: string;
  published_at?: string | null;
};

export function CourseVersions() {
  const { campId } = useAuth();
  const { getContentPopupContainer } = useAuthorLayout();
  const selectPopup = authorSelectPopup(getContentPopupContainer);
  const { message } = App.useApp();
  const nav = useNavigate();
  const confirmDelete = useDeleteConfirm();
  const { page, page_size, q, filters, hasFilters, setPage, setFilter, reset } = useListQuery();
  const [data, setData] = useState<Paginated<VersionRow> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<EntityModalMode>({ kind: "closed" });
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [courses, setCourses] = useState<{ value: string; label: string }[]>([]);
  const [yamlFiles, setYamlFiles] = useState<File[]>([]);
  const [sourceTab, setSourceTab] = useState("blank");

  const courseIdFilter = filters.course_id;
  const courseFilterLabel = courses.find((c) => c.value === courseIdFilter)?.label;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authorApi.listCourseVersionsPaged({
        camp_id: campId || undefined,
        course_id: courseIdFilter || undefined,
        q: q || undefined,
        status: filters.status,
        page,
        page_size,
      });
      setData({
        items: (res.items || []) as VersionRow[],
        total: res.total,
        page: res.page,
        page_size: res.page_size,
      });
    } catch (err) {
      // fallback to camp list without pagination fields
      try {
        const legacy = await authorApi.listCourseVersions(campId || "");
        let items = (legacy.items || []) as VersionRow[];
        if (courseIdFilter) items = items.filter((v) => v.course_id === courseIdFilter);
        setData({ items, total: items.length, page: 1, page_size: items.length || 20 });
      } catch {
        setError(err instanceof ApiError ? err.message : "加载失败");
        setData(null);
      }
    } finally {
      setLoading(false);
    }
  }, [campId, courseIdFilter, q, filters.status, page, page_size]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void authorApi.listCourses().then((res) => {
      setCourses((res.items || []).map((c) => ({ value: c.id, label: c.title })));
    });
  }, []);

  return (
    <div>
      <PageHeader
        title="课程版本"
        description={
          courseIdFilter
            ? `当前筛选课程：${courseFilterLabel || courseIdFilter}`
            : "空白新增 / 克隆 / 导入 YAML，默认不再「选择已有 YAML」"
        }
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              form.resetFields();
              if (courseIdFilter) form.setFieldsValue({ course_id: courseIdFilter });
              setYamlFiles([]);
              setSourceTab("blank");
              setMode({ kind: "create" });
            }}
          >
            新增版本
          </Button>
        }
      />
      <SearchToolbar
        fields={[
          { key: "q", type: "search", label: "搜索", placeholder: "搜索 version_tag / 标题" },
          {
            key: "course_id",
            type: "select",
            label: "课程",
            placeholder: "全部课程",
            options: courses,
            allowClear: true,
          },
          {
            key: "status",
            type: "select",
            label: "状态",
            placeholder: "状态",
            options: [
              { value: "draft", label: "draft" },
              { value: "published", label: "published" },
              { value: "archived", label: "archived" },
            ],
          },
        ]}
        values={{ q: q || undefined, status: filters.status, course_id: courseIdFilter }}
        onChange={setFilter}
        onReset={hasFilters ? reset : undefined}
      />
      <ServerTable<VersionRow>
        rowKey="id"
        loading={loading}
        error={error}
        onRetry={() => void load()}
        data={data}
        onPageChange={setPage}
        columns={[
          { title: "Tag", dataIndex: "version_tag" },
          { title: "标题", dataIndex: "title", responsive: ["md"] },
          { title: "课程", dataIndex: "course_title", responsive: ["md"] },
          { title: "状态", dataIndex: "status", render: (s: string) => <Tag>{s}</Tag> },
          { title: "来源", dataIndex: "source", responsive: ["lg"] },
          {
            title: "操作",
            render: (_, r) => (
              <>
                <Button
                  type="link"
                  onClick={() =>
                    nav(`/author/curriculum/courses/${encodeURIComponent(r.course_id || "")}/versions/${encodeURIComponent(r.id)}`)
                  }
                  disabled={!r.course_id}
                >
                  打开课纲
                </Button>
                {r.status === "draft" && (
                  <Button
                    type="link"
                    onClick={() =>
                      confirmDelete({
                        name: r.version_tag,
                        impact: "发布后不可原地修改。",
                        onOk: async () => {
                          await authorApi.publishCourseVersionById(r.id);
                          message.success("已发布");
                          await load();
                        },
                      })
                    }
                  >
                    发布
                  </Button>
                )}
                {r.status === "published" && (
                  <Button
                    type="link"
                    onClick={async () => {
                      const res = await authorApi.rollbackCourseVersion(r.id);
                      message.success("已生成回滚草稿");
                      nav(
                        `/author/curriculum/courses/${encodeURIComponent(r.course_id || "")}/versions/${encodeURIComponent(res.course_version_id)}`,
                      );
                    }}
                  >
                    回滚
                  </Button>
                )}
              </>
            ),
          },
        ]}
      />

      <EntityModal
        mode={mode}
        title={{ create: "新增课程版本", edit: "编辑", view: "查看" }}
        form={form}
        submitting={submitting}
        onClose={() => setMode({ kind: "closed" })}
        onSubmit={async (values) => {
          setSubmitting(true);
          try {
            if (sourceTab === "yaml" && yamlFiles.length) {
              const validated = await authorApi.validateCourseYaml(yamlFiles);
              if (validated.errors?.length) {
                message.error(validated.errors.join("; "));
                return;
              }
            }
            const res = await authorApi.createCourseVersion(values.course_id, {
              version_tag: values.version_tag,
              title: values.title,
              clone_from_version_id: sourceTab === "clone" ? values.clone_from_version_id : undefined,
              camp_id: campId || undefined,
              files: sourceTab === "yaml" ? yamlFiles : undefined,
            });
            message.success("已创建草稿");
            setMode({ kind: "closed" });
            nav(`/author/curriculum/courses/${encodeURIComponent(values.course_id)}/versions/${encodeURIComponent(res.course_version_id)}`);
          } finally {
            setSubmitting(false);
          }
        }}
      >
        <Form.Item name="course_id" label="课程" rules={[{ required: true }]}>
          <Select options={courses} showSearch optionFilterProp="label" getPopupContainer={selectPopup} />
        </Form.Item>
        <Form.Item name="version_tag" label="版本 Tag" rules={[{ required: true }]}>
          <Input placeholder="v0.4-draft" />
        </Form.Item>
        <Form.Item name="title" label="标题">
          <Input />
        </Form.Item>
        <Tabs
          activeKey={sourceTab}
          onChange={setSourceTab}
          items={[
            { key: "blank", label: "空白新增", children: <p>创建空草稿，可在课纲编辑器中新增课次。</p> },
            {
              key: "clone",
              label: "克隆版本",
              children: (
                <Form.Item name="clone_from_version_id" label="克隆来源版本 ID">
                  <Input placeholder="published version uuid" />
                </Form.Item>
              ),
            },
            {
              key: "yaml",
              label: "导入 YAML",
              children: (
                <Upload
                  multiple
                  beforeUpload={(f) => {
                    setYamlFiles((prev) => [...prev, f]);
                    return false;
                  }}
                  onRemove={(f) => setYamlFiles((prev) => prev.filter((x) => x.name !== f.name))}
                  accept=".yaml,.yml"
                >
                  <Button>选择 day-*.yaml</Button>
                </Upload>
              ),
            },
          ]}
        />
      </EntityModal>
    </div>
  );
}
