import { useCallback, useEffect, useState } from "react";
import { App, Button, Form, Input, InputNumber, Modal, Space, Upload, Typography } from "antd";
import { UploadOutlined, DownloadOutlined, LinkOutlined, DeleteOutlined, ReloadOutlined } from "@ant-design/icons";
import { authorApi, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import type { AuthorDocument } from "../lib/types";
import type { Paginated } from "../lib/listQuery";
import { useListQuery } from "../lib/useListQuery";
import { AuthorListPageLayout, PageHeader, SearchToolbar, ServerTable, EntityModal, useDeleteConfirm, type EntityModalMode } from "../components/crud";
import { StatusTag } from "../components/StatusTag";
import { statusOptions } from "../lib/statusLabels";

function boundLabel(d: AuthorDocument): string {
  const days = (d.bindings || [])
    .map((b) => b.day)
    .filter((n): n is number => typeof n === "number")
    .sort((a, b) => a - b);
  if (days.length) return days.map((n) => `Day${n}`).join(", ");
  if (d.bound_day != null) return `Day${d.bound_day}`;
  if (d.day != null) return `Day${d.day}`;
  return "—";
}

export function DocumentLibrary() {
  const { campId } = useAuth();
  const { message } = App.useApp();
  const confirmDelete = useDeleteConfirm();
  const { page, page_size, q, filters, hasFilters, setPage, setFilter, reset } = useListQuery();
  const [data, setData] = useState<Paginated<AuthorDocument> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [bindMode, setBindMode] = useState<EntityModalMode>({ kind: "closed" });
  const [bindDoc, setBindDoc] = useState<AuthorDocument | null>(null);
  const [bindForm] = Form.useForm<{ day: number; capsule_id?: string }>();
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authorApi.listDocuments({
        camp_id: campId || undefined,
        status: filters.status,
        bound: filters.bound,
        q: q || undefined,
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
  }, [campId, filters.status, filters.bound, q, page, page_size]);

  useEffect(() => {
    void load();
  }, [load]);

  const onUpload = async (file: File) => {
    if (!campId) {
      message.error("请先选择营期");
      return false;
    }
    const okType =
      file.name.toLowerCase().endsWith(".docx") ||
      file.name.toLowerCase().endsWith(".pdf") ||
      file.type.includes("pdf") ||
      file.type.includes("word");
    if (!okType) {
      message.error("请上传 DOCX 或 PDF");
      return false;
    }
    setUploading(true);
    try {
      await authorApi.uploadDocument(file, campId);
      message.success("上传成功");
      setUploadOpen(false);
      await load();
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : "上传失败");
    } finally {
      setUploading(false);
    }
    return false;
  };

  const openBind = (d: AuthorDocument) => {
    setBindDoc(d);
    setBindMode({ kind: "edit", id: d.id });
    bindForm.setFieldsValue({ day: 1, capsule_id: undefined });
  };

  return (
    <>
      <AuthorListPageLayout
        header={<PageHeader title="文档库" description="上传 DOCX/PDF，绑定到课程日，支持搜索与分页" />}
        toolbar={
          <SearchToolbar
            fields={[
              { key: "q", type: "search", label: "搜索", placeholder: "搜索文件名" },
              {
                key: "status",
                type: "select",
                label: "状态",
                placeholder: "入库状态",
                options: statusOptions(["queued", "scanning", "ready", "failed"], "document"),
              },
              {
                key: "bound",
                type: "select",
                label: "绑定",
                placeholder: "绑定状态",
                options: [
                  { value: "1", label: "已绑定" },
                  { value: "0", label: "未绑定" },
                ],
              },
            ]}
            values={{ q: q || undefined, status: filters.status, bound: filters.bound }}
            onChange={setFilter}
            onReset={hasFilters ? reset : undefined}
            extra={
              <Button type="primary" icon={<UploadOutlined />} onClick={() => setUploadOpen(true)} disabled={!campId}>
                上传文档
              </Button>
            }
          />
        }
      >
        <ServerTable<AuthorDocument>
        rowKey="id"
        loading={loading}
        error={error}
        onRetry={() => void load()}
        data={data}
        onPageChange={setPage}
        emptyDescription="暂无文档"
        columns={[
          { title: "文件名", dataIndex: "filename" },
          {
            title: "状态",
            dataIndex: "status",
            render: (s: string) => <StatusTag status={s} domain="document" />,
          },
          {
            title: "大小",
            dataIndex: "size_bytes",
            responsive: ["md"],
            render: (n: number | undefined) => n ?? "—",
          },
          { title: "绑定", render: (_, d) => boundLabel(d) },
          {
            title: "操作",
            render: (_, d) => (
              <Space wrap size={0}>
                <Button type="link" icon={<LinkOutlined />} onClick={() => openBind(d)}>
                  绑定
                </Button>
                <Button
                  type="link"
                  icon={<DownloadOutlined />}
                  onClick={() => {
                    void authorApi
                      .documentDownloadUrl(d.id)
                      .then((r) => window.open(r.url, "_blank"))
                      .catch((err) => message.error(err instanceof ApiError ? err.message : "下载失败"));
                  }}
                >
                  下载
                </Button>
                <Button
                  type="link"
                  icon={<ReloadOutlined />}
                  onClick={() => {
                    void authorApi
                      .retryDocument(d.id)
                      .then(() => {
                        message.success("已重新入队");
                        return load();
                      })
                      .catch((err) => message.error(err instanceof ApiError ? err.message : "重试失败"));
                  }}
                >
                  重试
                </Button>
                <Button
                  type="link"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() =>
                    confirmDelete({
                      name: d.filename,
                      impact: `当前绑定 ${(d.bindings || []).length} 条；文档将软删除。`,
                      onOk: async () => {
                        await authorApi.deleteDocument(d.id);
                        message.success("已删除");
                        if ((data?.items.length || 0) <= 1 && page > 1) setPage(page - 1);
                        else await load();
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
      </AuthorListPageLayout>

      <Modal
        title="上传文档"
        open={uploadOpen}
        onCancel={() => setUploadOpen(false)}
        footer={null}
        destroyOnClose
      >
        <Typography.Paragraph type="secondary">仅支持 DOCX / PDF。</Typography.Paragraph>
        <Upload.Dragger
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          showUploadList={false}
          beforeUpload={(file) => {
            void onUpload(file);
            return false;
          }}
          disabled={uploading || !campId}
        >
          <p>{uploading ? "上传中…" : "点击或拖拽文件到此处"}</p>
        </Upload.Dragger>
      </Modal>

      <EntityModal
        mode={bindMode}
        title={{ create: "绑定", edit: "绑定到课程日", view: "绑定" }}
        form={bindForm}
        submitting={submitting}
        onClose={() => {
          setBindMode({ kind: "closed" });
          setBindDoc(null);
        }}
        onSubmit={async (values) => {
          if (!bindDoc) return;
          setSubmitting(true);
          try {
            await authorApi.bindDocument(bindDoc.id, {
              day: Number(values.day),
              capsule_id: values.capsule_id || undefined,
            });
            message.success(`已绑定第 ${values.day} 课`);
            setBindMode({ kind: "closed" });
            setBindDoc(null);
            await load();
          } finally {
            setSubmitting(false);
          }
        }}
      >
        <Typography.Paragraph type="secondary">{bindDoc?.filename}</Typography.Paragraph>
        <Form.Item name="day" label="课次（1–12）" rules={[{ required: true, message: "请填写课次编号" }]}>
          <InputNumber min={1} max={12} style={{ width: "100%" }} />
        </Form.Item>
        <Form.Item name="capsule_id" label="课节 ID（可选）">
          <Input placeholder="例如 c1" allowClear />
        </Form.Item>
      </EntityModal>
    </>
  );
}
