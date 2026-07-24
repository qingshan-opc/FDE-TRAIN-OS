import { useCallback, useEffect, useState } from "react";
import { App, Button, Form, Input, Card, List, Avatar, Space, Upload } from "antd";
import { PlusOutlined, UploadOutlined } from "@ant-design/icons";
import { authorApi, ApiError } from "../../lib/api";
import { PageHeader, SearchToolbar, EntityModal, useDeleteConfirm, type EntityModalMode } from "../../components/crud";
import { useListQuery } from "../../lib/useListQuery";

type Mentor = { id: string; name: string; title?: string; bio?: string; avatar_url?: string; avatar_key?: string };
type Fact = { n: string; t: string; d: string };

export function SiteEnterprise() {
  const { message } = App.useApp();
  const confirmDelete = useDeleteConfirm();
  const { q, setFilter, reset, hasFilters } = useListQuery();
  const [enterprise, setEnterprise] = useState<{ title?: string; subtitle?: string; mentors?: Mentor[]; facts?: Fact[] }>({});
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<EntityModalMode>({ kind: "closed" });
  const [factsMode, setFactsMode] = useState<EntityModalMode>({ kind: "closed" });
  const [editing, setEditing] = useState<Mentor | null>(null);
  const [form] = Form.useForm();
  const [factsForm] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authorApi.getSiteLanding();
      setEnterprise((res.enterprise as typeof enterprise) || {});
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => {
    void load();
  }, [load]);

  const mentors = (enterprise.mentors || []).filter((m) => {
    if (!q) return true;
    const s = q.toLowerCase();
    return m.name?.toLowerCase().includes(s) || m.title?.toLowerCase().includes(s);
  });

  return (
    <div>
      <PageHeader
        title="导师与企业"
        description="企业培训区标题、卖点与导师展示"
        extra={
          <Space>
            <Button
              onClick={() => {
                factsForm.setFieldsValue({
                  title: enterprise.title,
                  subtitle: enterprise.subtitle,
                  facts_json: JSON.stringify(enterprise.facts || [], null, 2),
                });
                setFactsMode({ kind: "edit", id: "facts" });
              }}
            >
              编辑企业区
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                setEditing(null);
                form.resetFields();
                setMode({ kind: "create" });
              }}
            >
              新增导师
            </Button>
          </Space>
        }
      />
      <Card loading={loading} size="small" style={{ marginBottom: 16 }}>
        <div>
          <strong>{enterprise.title || "企业培训"}</strong>
        </div>
        <div style={{ color: "#64748b" }}>{enterprise.subtitle || "—"}</div>
      </Card>
      <SearchToolbar
        fields={[{ key: "q", type: "search", label: "搜索", placeholder: "搜索导师姓名/头衔" }]}
        values={{ q: q || undefined }}
        onChange={setFilter}
        onReset={hasFilters ? reset : undefined}
      />
      <List
        loading={loading}
        dataSource={mentors}
        locale={{ emptyText: "暂无导师，请新增" }}
        renderItem={(m) => (
          <List.Item
            actions={[
              <Upload
                key="avatar"
                accept="image/*"
                showUploadList={false}
                beforeUpload={(file) => {
                  void (async () => {
                    setAvatarUploading(true);
                    try {
                      await authorApi.uploadMentorAvatar(m.id, file);
                      message.success("头像已更新");
                      await load();
                    } catch (err) {
                      message.error(err instanceof ApiError ? err.message : "上传失败");
                    } finally {
                      setAvatarUploading(false);
                    }
                  })();
                  return false;
                }}
              >
                <Button type="link" icon={<UploadOutlined />} loading={avatarUploading}>
                  头像
                </Button>
              </Upload>,
              <Button
                type="link"
                key="edit"
                onClick={() => {
                  setEditing(m);
                  form.setFieldsValue(m);
                  setMode({ kind: "edit", id: m.id });
                }}
              >
                编辑
              </Button>,
              <Button
                type="link"
                danger
                key="del"
                onClick={() =>
                  confirmDelete({
                    name: m.name,
                    onOk: async () => {
                      const next = (enterprise.mentors || []).filter((x) => x.id !== m.id);
                      await authorApi.patchSiteLanding({ enterprise: { ...enterprise, mentors: next } });
                      message.success("已删除");
                      await load();
                    },
                  })
                }
              >
                删除
              </Button>,
            ]}
          >
            <List.Item.Meta
              avatar={<Avatar src={m.avatar_url}>{m.name?.[0]}</Avatar>}
              title={m.name}
              description={`${m.title || ""} ${m.bio || ""}`}
            />
          </List.Item>
        )}
      />

      <EntityModal
        mode={mode}
        title={{ create: "新增导师", edit: "编辑导师", view: "查看" }}
        form={form}
        submitting={submitting}
        onClose={() => setMode({ kind: "closed" })}
        onSubmit={async (values: Mentor) => {
          setSubmitting(true);
          try {
            const id = editing?.id || `m-${Date.now().toString(36)}`;
            const item = { ...values, id };
            const others = (enterprise.mentors || []).filter((x) => x.id !== id);
            await authorApi.patchSiteLanding({ enterprise: { ...enterprise, mentors: [...others, item] } });
            message.success("已保存");
            setMode({ kind: "closed" });
            await load();
          } finally {
            setSubmitting(false);
          }
        }}
      >
        <Form.Item name="name" label="姓名" rules={[{ required: true }]}>
          <Input />
        </Form.Item>
        <Form.Item name="title" label="头衔">
          <Input />
        </Form.Item>
        <Form.Item name="bio" label="简介">
          <Input.TextArea rows={3} />
        </Form.Item>
      </EntityModal>

      <EntityModal
        mode={factsMode}
        title={{ create: "企业区", edit: "编辑企业区", view: "查看" }}
        form={factsForm}
        submitting={submitting}
        onClose={() => setFactsMode({ kind: "closed" })}
        onSubmit={async (values: { title?: string; subtitle?: string; facts_json?: string }) => {
          setSubmitting(true);
          try {
            let facts: Fact[] = enterprise.facts || [];
            if (values.facts_json) facts = JSON.parse(values.facts_json) as Fact[];
            await authorApi.patchSiteLanding({
              enterprise: { ...enterprise, title: values.title, subtitle: values.subtitle, facts },
            });
            message.success("已保存");
            setFactsMode({ kind: "closed" });
            await load();
          } finally {
            setSubmitting(false);
          }
        }}
      >
        <Form.Item name="title" label="标题">
          <Input />
        </Form.Item>
        <Form.Item name="subtitle" label="副标题">
          <Input.TextArea rows={2} />
        </Form.Item>
        <Form.Item name="facts_json" label="卖点 JSON">
          <Input.TextArea rows={8} className="mono" />
        </Form.Item>
      </EntityModal>
    </div>
  );
}
