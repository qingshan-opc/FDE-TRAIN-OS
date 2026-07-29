import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { App, Breadcrumb, Button, Form, Input, Modal, Radio, Select, Tag } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { authorApi, ApiError } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import type { Paginated } from "../../lib/listQuery";
import { useListQuery } from "../../lib/useListQuery";
import { AuthorListPageLayout, PageHeader, SearchToolbar, ServerTable, useDeleteConfirm } from "../../components/crud";

type PackResource = {
  id: string;
  title: string;
  kind?: string;
  object_key?: string | null;
  url?: string | null;
  day_index?: number | null;
  node_id?: string | null;
};

type AddSource = "video" | "document";

export function MaterialPackDetail() {
  const { packId = "" } = useParams();
  const { campId } = useAuth();
  const { message } = App.useApp();
  const confirmDelete = useDeleteConfirm();
  const { page, page_size, q, filters, hasFilters, setPage, setFilter, reset } = useListQuery();
  const [pack, setPack] = useState<{ id: string; name: string; description?: string } | null>(null);
  const [data, setData] = useState<Paginated<PackResource> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addSource, setAddSource] = useState<AddSource>("video");
  const [form] = Form.useForm();
  const [mediaOptions, setMediaOptions] = useState<{ value: string; label: string; object_key: string; kind: string }[]>([]);
  const [docOptions, setDocOptions] = useState<{ value: string; label: string; object_key?: string | null }[]>([]);

  const loadPack = useCallback(async () => {
    try {
      setPack(await authorApi.getResourcePack(packId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "加载素材包失败");
    }
  }, [packId]);

  const loadResources = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authorApi.listPackResources(packId, {
        page,
        page_size,
        q: q || undefined,
        day_index: filters.day_index ? Number(filters.day_index) : undefined,
        node_id: filters.node_id || undefined,
      });
      setData({
        ...res,
        items: (res.items || []).map((r) => {
          const meta = (r.meta_json || {}) as Record<string, unknown>;
          return {
            id: String(r.id),
            title: String(r.title || ""),
            kind: r.kind ? String(r.kind) : undefined,
            object_key: r.object_key ? String(r.object_key) : null,
            url: r.url ? String(r.url) : null,
            day_index: typeof r.day_index === "number" ? r.day_index : null,
            node_id: meta.node_id ? String(meta.node_id) : null,
          };
        }),
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "加载成员失败");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [packId, page, page_size, q, filters.day_index, filters.node_id]);

  useEffect(() => {
    void loadPack();
  }, [loadPack]);

  useEffect(() => {
    void loadResources();
  }, [loadResources]);

  useEffect(() => {
    if (!addOpen) return;
    if (addSource === "video") {
      void authorApi.listMediaAssets({ page: 1, page_size: 50, kind: "video" }).then((res) => {
        setMediaOptions(
          (res.items || []).map((m: { id: string; title: string; object_key: string; kind: string }) => ({
            value: m.id,
            label: `${m.title} (${m.object_key})`,
            object_key: m.object_key,
            kind: m.kind || "video",
          })),
        );
      });
      return;
    }
    void authorApi.listDocuments({ camp_id: campId || undefined, status: "ready", page: 1, page_size: 50 }).then((res) => {
      setDocOptions(
        (res.items || []).map((d) => ({
          value: d.id,
          label: d.filename,
          object_key: d.object_key,
        })),
      );
    });
  }, [addOpen, addSource, campId]);

  const addMember = async (values: {
    media_id?: string;
    document_id?: string;
    title?: string;
    day_index?: number;
    node_id?: string;
  }) => {
    try {
      const common = {
        title: values.title,
        day_index: values.day_index,
        node_id: values.node_id?.trim() || undefined,
      };
      if (addSource === "video") {
        const picked = mediaOptions.find((o) => o.value === values.media_id);
        if (!picked) return;
        await authorApi.linkPackResource(packId, {
          kind: picked.kind,
          title: common.title || picked.label.split(" (")[0],
          object_key: picked.object_key,
          day_index: common.day_index,
          node_id: common.node_id,
        });
      } else {
        const picked = docOptions.find((o) => o.value === values.document_id);
        if (!picked) return;
        const doc = picked.object_key ? picked : await authorApi.getDocument(picked.value);
        const objectKey = doc.object_key || picked.object_key;
        if (!objectKey) {
          message.error("文档尚未入库完成，缺少 object_key");
          return;
        }
        await authorApi.linkPackResource(packId, {
          kind: "document",
          title: common.title || picked.label,
          object_key: objectKey,
          day_index: common.day_index,
          node_id: common.node_id,
        });
      }
      message.success("已加入素材包");
      setAddOpen(false);
      form.resetFields();
      setAddSource("video");
      await loadResources();
      await loadPack();
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : "添加失败");
    }
  };

  return (
    <>
      <AuthorListPageLayout
        header={
          <>
            <Breadcrumb
              style={{ marginBottom: 12 }}
              items={[
                { title: <Link to="/author/resources/packs">素材包</Link> },
                { title: pack?.name || packId.slice(0, 8) },
              ]}
            />
            <PageHeader
              title={pack?.name || "素材包详情"}
              description={pack?.description || "包内资源成员管理，可按课次 / 课节筛选"}
            />
          </>
        }
        toolbar={
          <SearchToolbar
            fields={[
              { key: "q", type: "search", label: "搜索", placeholder: "搜索标题" },
              { key: "day_index", type: "input", label: "Day", placeholder: "课次 1–12", width: 100 },
              { key: "node_id", type: "input", label: "课节", placeholder: "如 c1", width: 120 },
            ]}
            values={{ q: q || undefined, day_index: filters.day_index, node_id: filters.node_id }}
            onChange={setFilter}
            onReset={hasFilters ? reset : undefined}
            extra={
              <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddOpen(true)}>
                添加成员
              </Button>
            }
          />
        }
      >
        <ServerTable<PackResource>
        rowKey="id"
        loading={loading}
        error={error}
        onRetry={() => void loadResources()}
        data={data}
        onPageChange={setPage}
        columns={[
          { title: "标题", dataIndex: "title" },
          { title: "类型", dataIndex: "kind", render: (k) => <Tag>{k || "—"}</Tag> },
          {
            title: "Day",
            dataIndex: "day_index",
            render: (d) => (d != null ? `Day ${d}` : "—"),
          },
          {
            title: "课节",
            dataIndex: "node_id",
            render: (n) => n || "—",
          },
          {
            title: "object_key / URL",
            render: (_, r) => (
              <span className="mono" style={{ fontSize: 12 }}>
                {r.object_key || r.url || "—"}
              </span>
            ),
          },
          {
            title: "操作",
            render: (_, r) => (
              <Button
                type="link"
                danger
                onClick={() =>
                  confirmDelete({
                    name: r.title,
                    onOk: async () => {
                      await authorApi.deletePackResource(packId, r.id);
                      message.success("已移出");
                      await loadResources();
                    },
                  })
                }
              >
                移出
              </Button>
            ),
          },
        ]}
        />
      </AuthorListPageLayout>

      <Modal
        title="添加包成员"
        open={addOpen}
        onCancel={() => {
          setAddOpen(false);
          setAddSource("video");
        }}
        footer={null}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={(v) => void addMember(v)}>
          <Form.Item label="来源">
            <Radio.Group
              value={addSource}
              onChange={(e) => {
                setAddSource(e.target.value as AddSource);
                form.resetFields(["media_id", "document_id"]);
              }}
              options={[
                { label: "视频库", value: "video" },
                { label: "文档库", value: "document" },
              ]}
            />
          </Form.Item>
          {addSource === "video" ? (
            <Form.Item name="media_id" label="视频" rules={[{ required: true }]}>
              <Select options={mediaOptions} placeholder="选择视频库条目" showSearch optionFilterProp="label" />
            </Form.Item>
          ) : (
            <Form.Item name="document_id" label="文档" rules={[{ required: true }]}>
              <Select options={docOptions} placeholder="选择可用状态文档" showSearch optionFilterProp="label" />
            </Form.Item>
          )}
          <Form.Item name="title" label="显示标题">
            <Input placeholder="可选，默认用库内标题" />
          </Form.Item>
          <Form.Item name="day_index" label="关联课次（可选）">
            <Input type="number" placeholder="例如 6" />
          </Form.Item>
          <Form.Item name="node_id" label="关联课节 ID（可选）">
            <Input placeholder="例如 c1" />
          </Form.Item>
          <Button type="primary" htmlType="submit">
            添加
          </Button>
        </Form>
      </Modal>
    </>
  );
}
