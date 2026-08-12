import { useCallback, useEffect, useMemo, useState } from "react";
import { App, Button, Card, Col, Descriptions, Form, Input, Row, Space, Typography } from "antd";
import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import { authorApi, ApiError } from "../../lib/api";
import { PageHeader, EntityModal, type EntityModalMode } from "../../components/crud";
import type { LandingAbout, LandingPartner, LandingSeo, LandingSeoByRoute } from "../../lib/types";
import { defaultAbout, defaultPartners, defaultSeoByRoute } from "../../app/resolveLandingContent";

type SectionKey = "about" | "partners" | "seo";

type AboutState = {
  about?: LandingAbout;
  partners?: LandingPartner[];
  seo_by_route?: LandingSeoByRoute;
};

function storyToText(story?: string[]): string {
  return (story || []).join("\n\n");
}

function textToStory(raw?: string): string[] {
  return (raw || "")
    .split(/\n\s*\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function SiteAbout() {
  const { message, modal } = App.useApp();
  const [data, setData] = useState<AboutState | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<EntityModalMode>({ kind: "closed" });
  const [section, setSection] = useState<SectionKey | null>(null);
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData((await authorApi.getSiteLanding()) as AboutState);
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => {
    void load();
  }, [load]);

  const aboutDefaults = useMemo(() => defaultAbout(), []);
  const partnerDefaults = useMemo(() => defaultPartners(), []);
  const about: LandingAbout = useMemo(
    () => ({ ...aboutDefaults, ...(data?.about || {}) }),
    [aboutDefaults, data?.about],
  );
  const partners: LandingPartner[] = useMemo(
    () => (data?.partners && data.partners.length > 0 ? data.partners : partnerDefaults),
    [data?.partners, partnerDefaults],
  );
  const seoDefaults = useMemo(() => defaultSeoByRoute().about || {}, []);
  const seo: LandingSeo = useMemo(
    () => ({ ...seoDefaults, ...(data?.seo_by_route?.about || {}) }),
    [data?.seo_by_route?.about, seoDefaults],
  );

  const openSection = (key: SectionKey) => {
    setSection(key);
    setMode({ kind: "edit", id: key });
  };

  const formInitialValues = useMemo(() => {
    if (mode.kind !== "edit" || !section) return null;
    if (section === "about") {
      return {
        title: about.title,
        body: about.body,
        story_text: storyToText(about.story),
        pillars: (about.pillars || []).map((p) => ({ ...p })),
        partners_title: about.partners_title,
        partners_lead: about.partners_lead,
      };
    }
    if (section === "partners") {
      return {
        partners: partners.map((p) => ({ ...p })),
      };
    }
    return {
      seo_title: seo.title,
      seo_description: seo.description,
      seo_keywords: seo.keywords,
      seo_og_image: seo.og_image,
    };
  }, [mode.kind, section, about, partners, seo]);

  const seedFromDefaults = () => {
    modal.confirm({
      title: "从默认填充关于我们？",
      content: "将用默认 about / partners / about SEO 覆盖当前内容。",
      okText: "确认填充",
      cancelText: "取消",
      onOk: async () => {
        setSeeding(true);
        try {
          await authorApi.patchSiteLanding({
            about: defaultAbout(),
            partners: defaultPartners(),
            seo_by_route: { about: defaultSeoByRoute().about },
          });
          message.success("已从默认填充");
          await load();
        } catch (err) {
          message.error(err instanceof ApiError ? err.message : "填充失败");
          throw err;
        } finally {
          setSeeding(false);
        }
      },
    });
  };

  return (
    <div>
      <PageHeader
        title="关于我们"
        description="关于页标题、故事、支柱与合作伙伴；保存后官网 /about 同步"
        extra={
          <Button loading={seeding} onClick={seedFromDefaults}>
            从默认填充
          </Button>
        }
      />

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={14}>
          <Card
            loading={loading}
            size="small"
            title="关于文案"
            extra={
              <Button type="link" size="small" onClick={() => openSection("about")}>
                编辑
              </Button>
            }
          >
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="标题">{about.title || "—"}</Descriptions.Item>
              <Descriptions.Item label="正文">{about.body || "—"}</Descriptions.Item>
              <Descriptions.Item label="故事段">{(about.story || []).length} 段</Descriptions.Item>
              <Descriptions.Item label="支柱">{(about.pillars || []).length} 项</Descriptions.Item>
              <Descriptions.Item label="伙伴区标题">{about.partners_title || "—"}</Descriptions.Item>
              <Descriptions.Item label="伙伴区导语">{about.partners_lead || "—"}</Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card
            loading={loading}
            size="small"
            title="合作伙伴"
            extra={
              <Button type="link" size="small" onClick={() => openSection("partners")}>
                编辑
              </Button>
            }
          >
            <Space direction="vertical" style={{ width: "100%" }}>
              {partners.map((p) => (
                <div key={p.id}>
                  <Typography.Text strong>{p.name}</Typography.Text>
                  <Typography.Text type="secondary"> · {p.tag}</Typography.Text>
                </div>
              ))}
            </Space>
          </Card>
        </Col>
        <Col span={24}>
          <Card
            loading={loading}
            size="small"
            title="SEO（关于我们）"
            extra={
              <Button type="link" size="small" onClick={() => openSection("seo")}>
                编辑
              </Button>
            }
          >
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="标题">{seo.title || "—"}</Descriptions.Item>
              <Descriptions.Item label="描述">{seo.description || "—"}</Descriptions.Item>
              <Descriptions.Item label="关键词">{seo.keywords || "—"}</Descriptions.Item>
              <Descriptions.Item label="分享图">{seo.og_image || "—"}</Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
      </Row>

      <EntityModal
        mode={mode}
        title={{
          create: "编辑",
          edit:
            section === "partners"
              ? "编辑合作伙伴"
              : section === "seo"
                ? "编辑 SEO"
                : "编辑关于我们",
          view: "查看",
        }}
        form={form}
        submitting={submitting}
        width={section === "partners" ? 720 : 640}
        initialValues={formInitialValues}
        onClose={() => {
          setMode({ kind: "closed" });
          setSection(null);
        }}
        onSubmit={async (values: Record<string, unknown>) => {
          setSubmitting(true);
          try {
            if (section === "about") {
              await authorApi.patchSiteLanding({
                about: {
                  title: String(values.title || ""),
                  body: String(values.body || ""),
                  story: textToStory(String(values.story_text || "")),
                  pillars: (values.pillars as LandingAbout["pillars"]) || [],
                  partners_title: String(values.partners_title || ""),
                  partners_lead: String(values.partners_lead || ""),
                },
              });
            } else if (section === "partners") {
              await authorApi.patchSiteLanding({
                partners: (values.partners as LandingPartner[]) || [],
              });
            } else if (section === "seo") {
              await authorApi.patchSiteLanding({
                seo_by_route: {
                  about: {
                    title: String(values.seo_title || ""),
                    description: String(values.seo_description || ""),
                    keywords: String(values.seo_keywords || ""),
                    og_image: String(values.seo_og_image || ""),
                  },
                },
              });
            }
            message.success("已保存，官网将同步展示");
            setMode({ kind: "closed" });
            setSection(null);
            await load();
          } catch (err) {
            message.error(err instanceof ApiError ? err.message : "保存失败");
            throw err;
          } finally {
            setSubmitting(false);
          }
        }}
      >
        {section === "about" ? (
          <>
            <Form.Item name="title" label="标题" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item name="body" label="正文" rules={[{ required: true }]}>
              <Input.TextArea rows={4} />
            </Form.Item>
            <Form.Item name="story_text" label="故事" extra="段落之间空一行">
              <Input.TextArea rows={8} />
            </Form.Item>
            <Form.Item name="partners_title" label="伙伴区标题">
              <Input />
            </Form.Item>
            <Form.Item name="partners_lead" label="伙伴区导语">
              <Input.TextArea rows={2} />
            </Form.Item>
            <Typography.Text strong style={{ display: "block", marginBottom: 8 }}>
              支柱 Pillars
            </Typography.Text>
            <Form.List name="pillars">
              {(fields, { add, remove }) => (
                <>
                  {fields.map((field) => (
                    <Card
                      key={field.key}
                      size="small"
                      style={{ marginBottom: 8 }}
                      extra={<Button type="text" danger icon={<DeleteOutlined />} onClick={() => remove(field.name)} />}
                    >
                      <Form.Item {...field} name={[field.name, "n"]} label="序号" rules={[{ required: true }]}>
                        <Input placeholder="01" />
                      </Form.Item>
                      <Form.Item {...field} name={[field.name, "title"]} label="标题" rules={[{ required: true }]}>
                        <Input />
                      </Form.Item>
                      <Form.Item {...field} name={[field.name, "desc"]} label="描述" rules={[{ required: true }]}>
                        <Input.TextArea rows={2} />
                      </Form.Item>
                    </Card>
                  ))}
                  <Button type="dashed" onClick={() => add({ n: "", title: "", desc: "" })} icon={<PlusOutlined />} block>
                    添加支柱
                  </Button>
                </>
              )}
            </Form.List>
          </>
        ) : null}

        {section === "partners" ? (
          <Form.List name="partners">
            {(fields, { add, remove }) => (
              <>
                {fields.map((field) => (
                  <Card
                    key={field.key}
                    size="small"
                    style={{ marginBottom: 8 }}
                    extra={<Button type="text" danger icon={<DeleteOutlined />} onClick={() => remove(field.name)} />}
                  >
                    <Form.Item {...field} name={[field.name, "id"]} label="ID" rules={[{ required: true }]}>
                      <Input placeholder="zju" />
                    </Form.Item>
                    <Form.Item {...field} name={[field.name, "name"]} label="名称" rules={[{ required: true }]}>
                      <Input />
                    </Form.Item>
                    <Form.Item {...field} name={[field.name, "tag"]} label="标签">
                      <Input />
                    </Form.Item>
                    <Form.Item {...field} name={[field.name, "logo"]} label="Logo URL">
                      <Input placeholder="/landing/partners/…" />
                    </Form.Item>
                    <Form.Item {...field} name={[field.name, "logoAlt"]} label="Logo Alt">
                      <Input />
                    </Form.Item>
                  </Card>
                ))}
                <Button
                  type="dashed"
                  onClick={() => add({ id: "", name: "", tag: "", logo: "", logoAlt: "" })}
                  icon={<PlusOutlined />}
                  block
                >
                  添加伙伴
                </Button>
              </>
            )}
          </Form.List>
        ) : null}

        {section === "seo" ? (
          <>
            <Form.Item name="seo_title" label="页面标题" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item name="seo_description" label="描述" rules={[{ required: true }]}>
              <Input.TextArea rows={3} maxLength={180} showCount />
            </Form.Item>
            <Form.Item name="seo_keywords" label="关键词">
              <Input />
            </Form.Item>
            <Form.Item name="seo_og_image" label="分享图 URL">
              <Input />
            </Form.Item>
          </>
        ) : null}
      </EntityModal>
    </div>
  );
}
