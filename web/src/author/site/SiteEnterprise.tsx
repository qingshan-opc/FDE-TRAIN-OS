import { useCallback, useEffect, useMemo, useState } from "react";
import { App, Avatar, Button, Card, Form, Input, List, Space, Tabs, Tag, Typography, Upload } from "antd";
import { EditOutlined, PlusOutlined, UploadOutlined, UserOutlined } from "@ant-design/icons";
import { authorApi, ApiError } from "../../lib/api";
import {
  AuthorListPageLayout,
  PageHeader,
  SearchToolbar,
  EntityModal,
  useDeleteConfirm,
  type EntityModalMode,
} from "../../components/crud";
import { useListQuery } from "../../lib/useListQuery";

type Mentor = {
  id: string;
  name: string;
  title?: string;
  bio?: string;
  avatar_url?: string;
  avatar_key?: string;
};
type Fact = { n?: string; t?: string; d?: string };
type Enterprise = { title?: string; subtitle?: string; mentors?: Mentor[]; facts?: Fact[] };

const DEFAULT_FACTS: Fact[] = [
  { n: "01", t: "任务驱动课纲", d: "每一天都是一个可交付的真实工作任务，而不是知识点堆砌。" },
  { n: "02", t: "Agent 实训环境", d: "学员在隔离工作区内使用真实 Agent 完成交付，过程全程留痕。" },
  { n: "03", t: "可核验结业证书", d: "结业证书公开可查，组织能验证每一位学员的真实产出。" },
];

function mentorAvatarSrc(m: Mentor): string | undefined {
  if (m.avatar_url) return m.avatar_url;
  if (m.avatar_key) return `/api/v1/site/mentors/${encodeURIComponent(m.id)}/avatar`;
  return undefined;
}

export function SiteEnterprise() {
  const { message } = App.useApp();
  const confirmDelete = useDeleteConfirm();
  const { q, setFilter, reset, hasFilters } = useListQuery();
  const [activeTab, setActiveTab] = useState<"enterprise" | "mentors">("enterprise");
  const [enterprise, setEnterprise] = useState<Enterprise>({});
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<EntityModalMode>({ kind: "closed" });
  const [factsMode, setFactsMode] = useState<EntityModalMode>({ kind: "closed" });
  const [editing, setEditing] = useState<Mentor | null>(null);
  const [form] = Form.useForm();
  const [factsForm] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [listAvatarBusy, setListAvatarBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authorApi.getSiteLanding();
      setEnterprise((res.enterprise as Enterprise) || {});
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    return () => {
      if (avatarPreview?.startsWith("blob:")) URL.revokeObjectURL(avatarPreview);
    };
  }, [avatarPreview]);

  const mentors = (enterprise.mentors || []).filter((m) => {
    if (!q) return true;
    const s = q.toLowerCase();
    return m.name?.toLowerCase().includes(s) || m.title?.toLowerCase().includes(s);
  });

  const facts = (enterprise.facts && enterprise.facts.length > 0 ? enterprise.facts : DEFAULT_FACTS).slice(0, 3);

  const mentorInitialValues = useMemo(() => {
    if (mode.kind === "edit" && editing) {
      return { name: editing.name, title: editing.title, bio: editing.bio };
    }
    if (mode.kind === "create") return {};
    return null;
  }, [mode.kind, editing]);

  const factsInitialValues = useMemo(() => {
    if (factsMode.kind !== "edit") return null;
    const src =
      enterprise.facts && enterprise.facts.length > 0 ? enterprise.facts : DEFAULT_FACTS;
    const rows = [...src, ...DEFAULT_FACTS].slice(0, 3);
    return {
      title: enterprise.title || "企业与机构培训",
      subtitle: enterprise.subtitle || "",
      fact0_n: rows[0]?.n || "01",
      fact0_t: rows[0]?.t || "",
      fact0_d: rows[0]?.d || "",
      fact1_n: rows[1]?.n || "02",
      fact1_t: rows[1]?.t || "",
      fact1_d: rows[1]?.d || "",
      fact2_n: rows[2]?.n || "03",
      fact2_t: rows[2]?.t || "",
      fact2_d: rows[2]?.d || "",
    };
  }, [factsMode.kind, enterprise]);

  const openCreateMentor = () => {
    setEditing(null);
    setAvatarFile(null);
    setAvatarPreview(null);
    setMode({ kind: "create" });
  };

  const openEditMentor = (m: Mentor) => {
    setEditing(m);
    setAvatarFile(null);
    setAvatarPreview(mentorAvatarSrc(m) || null);
    setMode({ kind: "edit", id: m.id });
  };

  const openEnterpriseEdit = () => {
    setFactsMode({ kind: "edit", id: "facts" });
  };

  const uploadAvatarFor = async (mentorId: string, file: File) => {
    await authorApi.uploadMentorAvatar(mentorId, file);
  };

  return (
    <>
      <AuthorListPageLayout
        header={
          <>
            <PageHeader title="导师与企业" description="官网「企业培训」区块：合作企业与授课导师分别维护" />
            <Tabs
              activeKey={activeTab}
              onChange={(key) => setActiveTab(key as "enterprise" | "mentors")}
              style={{ marginTop: 12 }}
              items={[
                { key: "enterprise", label: "合作企业维护" },
                { key: "mentors", label: "导师维护" },
              ]}
            />
          </>
        }
        toolbar={
          activeTab === "mentors" ? (
            <SearchToolbar
              fields={[{ key: "q", type: "search", label: "搜索", placeholder: "搜索导师姓名/头衔" }]}
              values={{ q: q || undefined }}
              onChange={setFilter}
              onReset={hasFilters ? reset : undefined}
              extra={
                <Button type="primary" icon={<PlusOutlined />} onClick={openCreateMentor}>
                  新增导师
                </Button>
              }
            />
          ) : undefined
        }
      >
        {activeTab === "enterprise" ? (
          <Card loading={loading} size="small" title="官网企业培训区预览">
            <Space direction="vertical" size={16} style={{ width: "100%" }}>
              <div>
                <Typography.Title level={5} style={{ marginTop: 0, marginBottom: 4 }}>
                  {enterprise.title || "企业与机构培训"}
                </Typography.Title>
                <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
                  {enterprise.subtitle || "—"}
                </Typography.Paragraph>
              </div>
              <Space direction="vertical" size={8} style={{ width: "100%" }}>
                {facts.map((f, i) => (
                  <div key={i}>
                    <Tag color="processing">{f.n || String(i + 1).padStart(2, "0")}</Tag>
                    <strong>{f.t || "—"}</strong>
                    <Typography.Text type="secondary" style={{ marginLeft: 8 }}>
                      {f.d || ""}
                    </Typography.Text>
                  </div>
                ))}
              </Space>
              <Button type="primary" icon={<EditOutlined />} onClick={openEnterpriseEdit}>
                编辑企业培训区
              </Button>
            </Space>
          </Card>
        ) : (
          <div className="author-list-table-card" style={{ overflow: "auto" }}>
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
                          setListAvatarBusy(m.id);
                          try {
                            await uploadAvatarFor(m.id, file);
                            message.success("头像已更新");
                            await load();
                          } catch (err) {
                            message.error(err instanceof ApiError ? err.message : "上传失败");
                          } finally {
                            setListAvatarBusy(null);
                          }
                        })();
                        return false;
                      }}
                    >
                      <Button type="link" icon={<UploadOutlined />} loading={listAvatarBusy === m.id}>
                        换头像
                      </Button>
                    </Upload>,
                    <Button type="link" key="edit" onClick={() => openEditMentor(m)}>
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
                    avatar={
                      <Avatar size={48} src={mentorAvatarSrc(m)} icon={<UserOutlined />}>
                        {m.name?.[0]}
                      </Avatar>
                    }
                    title={m.name}
                    description={
                      <>
                        <div>{m.title || "—"}</div>
                        {m.bio ? <Typography.Text type="secondary">{m.bio}</Typography.Text> : null}
                        {!m.avatar_key && !m.avatar_url ? (
                          <div>
                            <Typography.Text type="warning" style={{ fontSize: 12 }}>
                              尚未上传头像
                            </Typography.Text>
                          </div>
                        ) : null}
                      </>
                    }
                  />
                </List.Item>
              )}
            />
          </div>
        )}
      </AuthorListPageLayout>

      <EntityModal
        mode={mode}
        title={{ create: "新增导师", edit: "编辑导师", view: "查看" }}
        form={form}
        submitting={submitting}
        width={560}
        initialValues={mentorInitialValues}
        onClose={() => {
          setMode({ kind: "closed" });
          setEditing(null);
          setAvatarFile(null);
          setAvatarPreview(null);
        }}
        onSubmit={async (values: { name: string; title?: string; bio?: string }) => {
          setSubmitting(true);
          try {
            const id = editing?.id || `m-${Date.now().toString(36)}`;
            const item: Mentor = {
              id,
              name: values.name,
              title: values.title,
              bio: values.bio,
              avatar_key: editing?.avatar_key,
              avatar_url: editing?.avatar_url,
            };
            const others = (enterprise.mentors || []).filter((x) => x.id !== id);
            await authorApi.patchSiteLanding({ enterprise: { ...enterprise, mentors: [...others, item] } });
            if (avatarFile) {
              await uploadAvatarFor(id, avatarFile);
            }
            message.success(avatarFile ? "已保存并更新头像" : "已保存");
            setMode({ kind: "closed" });
            setEditing(null);
            setAvatarFile(null);
            setAvatarPreview(null);
            await load();
          } catch (err) {
            message.error(err instanceof ApiError ? err.message : "保存失败");
            throw err;
          } finally {
            setSubmitting(false);
          }
        }}
      >
        <Form.Item label="头像">
          <Space align="center" size={16}>
            <Avatar size={72} src={avatarPreview || undefined} icon={<UserOutlined />}>
              {(editing?.name || "?").slice(0, 1)}
            </Avatar>
            <Upload
              accept="image/*"
              showUploadList={false}
              beforeUpload={(file) => {
                if (avatarPreview?.startsWith("blob:")) URL.revokeObjectURL(avatarPreview);
                setAvatarFile(file);
                setAvatarPreview(URL.createObjectURL(file));
                return false;
              }}
            >
              <Button icon={<UploadOutlined />}>{avatarFile || avatarPreview ? "重新选择" : "选择头像"}</Button>
            </Upload>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              支持 JPG/PNG，建议方形，≤8MB
            </Typography.Text>
          </Space>
        </Form.Item>
        <Form.Item name="name" label="姓名" rules={[{ required: true, message: "请填写姓名" }]}>
          <Input placeholder="如：鲁家伟" />
        </Form.Item>
        <Form.Item name="title" label="头衔">
          <Input placeholder="如：15年企业架构师" />
        </Form.Item>
        <Form.Item name="bio" label="简介">
          <Input.TextArea rows={3} placeholder="官网导师卡片副文案（可选）" />
        </Form.Item>
      </EntityModal>

      <EntityModal
        mode={factsMode}
        title={{ create: "企业区", edit: "编辑企业培训区", view: "查看" }}
        form={factsForm}
        submitting={submitting}
        width={640}
        initialValues={factsInitialValues}
        onClose={() => setFactsMode({ kind: "closed" })}
        onSubmit={async (values: Record<string, string>) => {
          setSubmitting(true);
          try {
            const nextFacts: Fact[] = [0, 1, 2].map((i) => ({
              n: values[`fact${i}_n`] || String(i + 1).padStart(2, "0"),
              t: values[`fact${i}_t`] || "",
              d: values[`fact${i}_d`] || "",
            }));
            await authorApi.patchSiteLanding({
              enterprise: {
                ...enterprise,
                title: values.title,
                subtitle: values.subtitle,
                facts: nextFacts,
                mentors: enterprise.mentors || [],
              },
            });
            message.success("企业区已保存，官网将同步展示");
            setFactsMode({ kind: "closed" });
            await load();
          } catch (err) {
            message.error(err instanceof ApiError ? err.message : "保存失败");
            throw err;
          } finally {
            setSubmitting(false);
          }
        }}
      >
        <Form.Item name="title" label="区块标题" rules={[{ required: true, message: "请填写标题" }]}>
          <Input placeholder="企业与机构培训" />
        </Form.Item>
        <Form.Item name="subtitle" label="副标题" rules={[{ required: true, message: "请填写副标题" }]}>
          <Input.TextArea rows={2} placeholder="从课纲设计到结业验收…" />
        </Form.Item>
        <Typography.Text strong style={{ display: "block", marginBottom: 8 }}>
          三条卖点（对应官网企业培训列表）
        </Typography.Text>
        {[0, 1, 2].map((i) => (
          <Card key={i} size="small" style={{ marginBottom: 10 }} title={`卖点 ${i + 1}`}>
            <Space direction="vertical" style={{ width: "100%" }} size={8}>
              <Form.Item name={`fact${i}_n`} label="序号" style={{ marginBottom: 0 }} rules={[{ required: true }]}>
                <Input placeholder="01" style={{ maxWidth: 120 }} />
              </Form.Item>
              <Form.Item name={`fact${i}_t`} label="标题" style={{ marginBottom: 0 }} rules={[{ required: true }]}>
                <Input placeholder="任务驱动课纲" />
              </Form.Item>
              <Form.Item name={`fact${i}_d`} label="说明" style={{ marginBottom: 0 }} rules={[{ required: true }]}>
                <Input.TextArea rows={2} placeholder="每一天都是一个可交付的真实工作任务…" />
              </Form.Item>
            </Space>
          </Card>
        ))}
      </EntityModal>
    </>
  );
}
