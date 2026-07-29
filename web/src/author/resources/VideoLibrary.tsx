import { useCallback, useEffect, useState } from "react";
import { App, Button, Form, Input, InputNumber, Tag, Upload } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { authorApi, ApiError } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import type { Paginated } from "../../lib/listQuery";
import { useListQuery } from "../../lib/useListQuery";
import { AuthorListPageLayout, PageHeader, SearchToolbar, ServerTable, EntityModal, useDeleteConfirm, type EntityModalMode } from "../../components/crud";

type MediaAsset = {
  id: string;
  title: string;
  kind: string;
  object_key: string;
  poster_key?: string | null;
  size_bytes?: number;
  duration_sec?: number;
  created_at?: string;
  ref_count?: number;
};

export function VideoLibrary() {
  const { campId } = useAuth();
  const { message } = App.useApp();
  const confirmDelete = useDeleteConfirm();
  const { page, page_size, q, filters, hasFilters, setPage, setFilter, reset } = useListQuery();
  const [data, setData] = useState<Paginated<MediaAsset> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<EntityModalMode>({ kind: "closed" });
  const [editing, setEditing] = useState<MediaAsset | null>(null);
  const [form] = Form.useForm();
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(
        await authorApi.listMediaAssets({
          camp_id: campId || undefined,
          kind: filters.kind || "video",
          q: q || undefined,
          page,
          page_size,
        }),
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "加载失败");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [campId, filters.kind, q, page, page_size]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <AuthorListPageLayout
        header={<PageHeader title="视频库" description="营期媒资统一管理，可被课纲课节复用" />}
        toolbar={
          <SearchToolbar
            fields={[
              { key: "q", type: "search", label: "搜索", placeholder: "搜索标题/标签" },
              {
                key: "kind",
                type: "select",
                label: "类型",
                placeholder: "类型",
                options: [
                  { value: "video", label: "视频" },
                  { value: "audio", label: "音频" },
                  { value: "poster", label: "海报" },
                  { value: "image", label: "图片" },
                ],
              },
            ]}
            values={{ q: q || undefined, kind: filters.kind }}
            onChange={setFilter}
            onReset={hasFilters ? reset : undefined}
            extra={
              <Button
                type="primary"
                icon={<PlusOutlined />}
                disabled={!campId}
                onClick={() => {
                  setEditing(null);
                  form.resetFields();
                  form.setFieldsValue({ kind: "video" });
                  setFile(null);
                  setMode({ kind: "create" });
                }}
              >
                上传视频
              </Button>
            }
          />
        }
      >
        <ServerTable<MediaAsset>
        rowKey="id"
        loading={loading}
        error={error}
        onRetry={() => void load()}
        data={data}
        onPageChange={setPage}
        columns={[
          { title: "标题", dataIndex: "title" },
          { title: "类型", dataIndex: "kind", render: (k: string) => <Tag>{k}</Tag> },
          { title: "大小", dataIndex: "size_bytes", responsive: ["md"] },
          { title: "时长", dataIndex: "duration_sec", responsive: ["md"] },
          { title: "引用", dataIndex: "ref_count", render: (n?: number) => n ?? 0 },
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
                      name: r.title,
                      impact: r.ref_count ? `当前被引用 ${r.ref_count} 次，若仍被引用将拒绝删除。` : "软删除媒资记录。",
                      onOk: async () => {
                        await authorApi.deleteMediaAsset(r.id);
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
        title={{ create: "上传媒资", edit: "编辑媒资", view: "查看" }}
        form={form}
        submitting={submitting}
        onClose={() => setMode({ kind: "closed" })}
        onSubmit={async (values) => {
          setSubmitting(true);
          try {
            if (mode.kind === "create") {
              if (!file || !campId) throw new Error("请选择文件并确认营期");
              const fd = new FormData();
              fd.append("file", file);
              fd.append("camp_id", campId);
              fd.append("title", values.title);
              fd.append("kind", values.kind || "video");
              if (values.duration_sec != null) fd.append("duration_sec", String(values.duration_sec));
              await authorApi.uploadMediaAsset(fd);
            } else if (editing) {
              await authorApi.patchMediaAsset(editing.id, {
                title: values.title,
                duration_sec: values.duration_sec,
              });
            }
            message.success("已保存");
            setMode({ kind: "closed" });
            await load();
          } catch (err) {
            message.error(err instanceof ApiError || err instanceof Error ? err.message : "保存失败");
            throw err;
          } finally {
            setSubmitting(false);
          }
        }}
      >
        <Form.Item name="title" label="标题" rules={[{ required: true }]}>
          <Input />
        </Form.Item>
        <Form.Item name="kind" label="类型" rules={[{ required: true }]}>
          <Input disabled={mode.kind === "edit"} />
        </Form.Item>
        <Form.Item name="duration_sec" label="时长（秒）">
          <InputNumber min={0} style={{ width: "100%" }} />
        </Form.Item>
        {mode.kind === "create" && (
          <Form.Item label="文件" required>
            <Upload
              beforeUpload={(f) => {
                setFile(f);
                if (!form.getFieldValue("title")) form.setFieldValue("title", f.name);
                return false;
              }}
              maxCount={1}
            >
              <Button>选择文件</Button>
            </Upload>
          </Form.Item>
        )}
      </EntityModal>
    </>
  );
}
