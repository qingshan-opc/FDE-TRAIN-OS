import { useCallback, useEffect, useMemo, useState } from "react";
import {
  App,
  Button,
  Card,
  Col,
  Descriptions,
  Form,
  Input,
  Modal,
  Row,
  Space,
  Tag,
  Typography,
  Upload,
} from "antd";
import { ExportOutlined, PlusOutlined, DeleteOutlined, UploadOutlined } from "@ant-design/icons";
import { Link } from "react-router-dom";
import { authorApi, ApiError } from "../../lib/api";
import { PageHeader, EntityModal, type EntityModalMode } from "../../components/crud";
import type {
  LandingHomeContent,
  LandingHomeHero,
  LandingPayload,
  LandingSeo,
  LandingSeoByRoute,
} from "../../lib/types";
import { defaultHomeFromInk, defaultSeoByRoute } from "../../app/resolveLandingContent";

type SectionKey =
  | "hero"
  | "pain"
  | "features"
  | "outline"
  | "method"
  | "works"
  | "voices"
  | "pricing"
  | "faq"
  | "final_cta"
  | "seo";

type LandingHomeState = {
  home?: LandingHomeContent;
  seo?: LandingSeo;
  seo_by_route?: LandingSeoByRoute;
  hero_video?: LandingPayload["hero_video"];
};

function mediaPreviewUrl(raw?: string | null): string | null {
  if (!raw) return null;
  if (raw.startsWith("http") || raw.startsWith("/")) return raw;
  return `/api/v1/site/hero/stream?asset=poster`;
}

function perksToText(perks?: string[]): string {
  return (perks || []).join("\n");
}

function textToPerks(raw?: string): string[] {
  return (raw || "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

function pillarsToText(pillars?: string[]): string {
  return (pillars || []).join("\n");
}

function textToPillars(raw?: string): string[] {
  return (raw || "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

function titleLinesToText(lines?: string[]): string {
  return (lines || []).join("\n");
}

function textToTitleLines(raw?: string): string[] {
  return (raw || "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function SiteHome() {
  const { message, modal } = App.useApp();
  const [data, setData] = useState<LandingHomeState | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<EntityModalMode>({ kind: "closed" });
  const [section, setSection] = useState<SectionKey | null>(null);
  const [heroMediaOpen, setHeroMediaOpen] = useState(false);
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData((await authorApi.getSiteLanding()) as LandingHomeState);
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => {
    void load();
  }, [load]);

  const defaults = useMemo(() => defaultHomeFromInk(), []);
  const home: LandingHomeContent = useMemo(
    () => ({ ...defaults, ...(data?.home || {}) }),
    [data?.home, defaults],
  );
  const routeSeoDefaults = useMemo(() => defaultSeoByRoute().home || {}, []);
  const seo: LandingSeo = useMemo(
    () => ({
      ...routeSeoDefaults,
      ...(data?.seo || {}),
      ...(data?.seo_by_route?.home || {}),
    }),
    [data?.seo, data?.seo_by_route?.home, routeSeoDefaults],
  );
  const heroVideo = data?.hero_video || null;
  const posterPreview =
    mediaPreviewUrl(heroVideo?.poster_url) ||
    (heroVideo?.poster_url ? "/api/v1/site/hero/stream?asset=poster" : null) ||
    "/landing/hero.png";
  const hasVideo = Boolean(
    heroVideo?.src_url ||
      (heroVideo as { object_key?: string; stream_url?: string } | null)?.object_key ||
      (heroVideo as { stream_url?: string } | null)?.stream_url,
  );

  const openSection = (key: SectionKey) => {
    setSection(key);
    setMode({ kind: "edit", id: key });
  };

  const formInitialValues = useMemo(() => {
    if (mode.kind !== "edit" || !section) return null;
    const h = home.hero || {};
    const pain = home.pain || {};
    const features = home.features || {};
    const outline = home.outline || {};
    const method = home.method || {};
    const works = home.works || {};
    const voices = home.voices || {};
    const pricing = home.pricing || {};
    const faq = home.faq || {};
    const finalCta = home.final_cta || {};

    switch (section) {
      case "hero":
        return {
          eyebrow: h.eyebrow,
          title_lead: h.title_lead,
          title_em: h.title_em,
          title_line2: h.title_line2,
          pillars_text: pillarsToText(h.pillars),
          sub: h.sub,
          cta_primary: h.cta_primary,
          cta_secondary: h.cta_secondary,
          note: h.note,
          trust: (h.trust || defaults.hero?.trust || []).map((t) => ({ ...t })),
        };
      case "pain":
        return {
          tag: pain.tag,
          title_lines_text: titleLinesToText(pain.title_lines),
          subtitle: pain.subtitle,
          items: (pain.items || []).map((it) => ({ ...it })),
          turn: pain.turn,
        };
      case "features":
        return {
          tag: features.tag,
          title_before: features.title_before,
          title_accent: features.title_accent,
          meta_text: (features.meta || []).join("\n"),
          items: (features.items || []).map((it) => ({ ...it })),
        };
      case "outline":
        return {
          tag: outline.tag,
          title: outline.title,
          subtitle: outline.subtitle,
          weeks_json: JSON.stringify(outline.weeks || defaults.outline?.weeks || [], null, 2),
        };
      case "method":
        return {
          tag: method.tag,
          title_line1: method.title_line1,
          title_line2: method.title_line2,
          subtitle: method.subtitle,
          roles: (method.roles || []).map((r) => ({ ...r })),
        };
      case "works":
        return {
          tag: works.tag,
          title: works.title,
          subtitle: works.subtitle,
          items: (works.items || []).map((it) => ({
            tag: it.tag,
            title: it.title,
            body: it.body,
            who: it.who,
            badge: it.badge,
            fill: it.fill,
            path: it.path,
            sun: it.sun,
          })),
        };
      case "voices":
        return {
          tag: voices.tag,
          title: voices.title,
          items: (voices.items || []).map((it) => ({ ...it })),
        };
      case "pricing":
        return {
          tag: pricing.tag,
          title: pricing.title,
          subtitle: pricing.subtitle,
          perks_text: perksToText(pricing.perks),
          price_label: pricing.price_label,
          price_amount: pricing.price_amount,
          price_unit: pricing.price_unit,
          price_note: pricing.price_note,
        };
      case "faq":
        return {
          tag: faq.tag,
          title: faq.title,
          items: (faq.items || []).map((it) => ({ ...it })),
        };
      case "final_cta":
        return {
          title: finalCta.title,
          body: finalCta.body,
          secondary_cta: finalCta.secondary_cta,
        };
      case "seo":
        return {
          seo_title: seo.title,
          seo_description: seo.description,
          seo_keywords: seo.keywords,
          seo_og_image: seo.og_image,
        };
      default:
        return null;
    }
  }, [mode.kind, section, home, seo, defaults]);

  const sectionTitle = (key: SectionKey): string => {
    const map: Record<SectionKey, string> = {
      hero: "Hero 首屏",
      pain: "痛点 Pain",
      features: "差异 Features",
      outline: "大纲 Outline（weeks JSON）",
      method: "方法论 Method",
      works: "学员成果 Works",
      voices: "学员评价 Voices",
      pricing: "定价 Pricing",
      faq: "FAQ",
      final_cta: "终局 CTA",
      seo: "SEO（首页）",
    };
    return map[key];
  };

  const seedFromDefaults = () => {
    modal.confirm({
      title: "从默认填充首页？",
      content: "将用 ink 营期默认文案覆盖当前 home，并写入首页 SEO。已有自定义内容会被替换。",
      okText: "确认填充",
      cancelText: "取消",
      onOk: async () => {
        setSeeding(true);
        try {
          const seoHome = defaultSeoByRoute().home;
          await authorApi.patchSiteLanding({
            home: defaultHomeFromInk(),
            seo: seoHome,
            seo_by_route: { home: seoHome },
          });
          message.success("已从默认填充首页");
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

  const fillWeeksDefault = () => {
    form.setFieldsValue({
      weeks_json: JSON.stringify(defaults.outline?.weeks || [], null, 2),
    });
  };

  return (
    <div>
      <PageHeader
        title="首页营期文案"
        description="ink 营期首页各区块文案与 SEO；保存后官网立即生效（服务端深合并）"
        extra={
          <Space wrap>
            <Link to="/" target="_blank" rel="noreferrer">
              <Button icon={<ExportOutlined />}>预览官网</Button>
            </Link>
            <Button loading={seeding} onClick={seedFromDefaults}>
              从默认填充首页
            </Button>
          </Space>
        }
      />

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card
            loading={loading}
            size="small"
            title="Hero"
            extra={
              <Button type="link" size="small" onClick={() => openSection("hero")}>
                编辑
              </Button>
            }
          >
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="Eyebrow">{home.hero?.eyebrow || "—"}</Descriptions.Item>
              <Descriptions.Item label="标题">
                {[home.hero?.title_lead, home.hero?.title_em, home.hero?.title_line2].filter(Boolean).join(" ") || "—"}
              </Descriptions.Item>
              <Descriptions.Item label="副文">{home.hero?.sub || "—"}</Descriptions.Item>
              <Descriptions.Item label="CTA">
                {home.hero?.cta_primary || "—"} / {home.hero?.cta_secondary || "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Trust">
                <Space wrap>
                  {(home.hero?.trust || []).map((t, i) => (
                    <Tag key={i}>
                      {t.num}
                      {t.unit} {t.label}
                    </Tag>
                  ))}
                </Space>
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card
            loading={loading}
            size="small"
            title="痛点 / Features / Outline"
            extra={
              <Space>
                <Button type="link" size="small" onClick={() => openSection("pain")}>
                  痛点
                </Button>
                <Button type="link" size="small" onClick={() => openSection("features")}>
                  Features
                </Button>
                <Button type="link" size="small" onClick={() => openSection("outline")}>
                  Outline
                </Button>
              </Space>
            }
          >
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="痛点条数">{(home.pain?.items || []).length}</Descriptions.Item>
              <Descriptions.Item label="Features">{(home.features?.items || []).length} 项</Descriptions.Item>
              <Descriptions.Item label="大纲周数">{(home.outline?.weeks || []).length} 周</Descriptions.Item>
              <Descriptions.Item label="Outline 标题">{home.outline?.title || "—"}</Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card
            loading={loading}
            size="small"
            title="Method / Works / Voices"
            extra={
              <Space>
                <Button type="link" size="small" onClick={() => openSection("method")}>
                  Method
                </Button>
                <Button type="link" size="small" onClick={() => openSection("works")}>
                  Works
                </Button>
                <Button type="link" size="small" onClick={() => openSection("voices")}>
                  Voices
                </Button>
              </Space>
            }
          >
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="角色数">{(home.method?.roles || []).length}</Descriptions.Item>
              <Descriptions.Item label="成果数">{(home.works?.items || []).length}</Descriptions.Item>
              <Descriptions.Item label="评价数">{(home.voices?.items || []).length}</Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card
            loading={loading}
            size="small"
            title="Pricing / FAQ / 终局 CTA"
            extra={
              <Space>
                <Button type="link" size="small" onClick={() => openSection("pricing")}>
                  定价
                </Button>
                <Button type="link" size="small" onClick={() => openSection("faq")}>
                  FAQ
                </Button>
                <Button type="link" size="small" onClick={() => openSection("final_cta")}>
                  CTA
                </Button>
              </Space>
            }
          >
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="价格">
                {home.pricing?.price_amount || "—"} {home.pricing?.price_unit || ""}
              </Descriptions.Item>
              <Descriptions.Item label="权益数">{(home.pricing?.perks || []).length}</Descriptions.Item>
              <Descriptions.Item label="FAQ">{(home.faq?.items || []).length} 条</Descriptions.Item>
              <Descriptions.Item label="终局标题">{home.final_cta?.title || "—"}</Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>

        <Col span={24}>
          <Card
            loading={loading}
            size="small"
            title="SEO（首页）"
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

        <Col span={24}>
          <Card
            loading={loading}
            size="small"
            title="可选：首页宣传片媒资"
            extra={
              <Button size="small" onClick={() => setHeroMediaOpen(true)}>
                上传媒资
              </Button>
            }
          >
            <Row gutter={16} align="middle">
              <Col xs={24} sm={10} md={8}>
                <div
                  style={{
                    borderRadius: 12,
                    overflow: "hidden",
                    aspectRatio: "16/9",
                    background: "#0f2e2a",
                  }}
                >
                  {posterPreview ? (
                    <img
                      src={posterPreview}
                      alt="Hero 预览"
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  ) : null}
                </div>
              </Col>
              <Col xs={24} sm={14} md={16}>
                <Space wrap>
                  <Tag color={hasVideo ? "green" : "default"}>{hasVideo ? "已上传视频" : "未上传视频"}</Tag>
                  <Tag color={heroVideo?.poster_url ? "green" : "default"}>
                    {heroVideo?.poster_url ? "已上传海报" : "未上传海报"}
                  </Tag>
                </Space>
                <Typography.Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0, fontSize: 12 }}>
                  遗留宣传片/海报上传。墨水营期首页主文案在上方各区块编辑；此处仅可选媒资。
                </Typography.Paragraph>
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>

      <EntityModal
        mode={mode}
        title={{
          create: "编辑",
          edit: section ? `编辑 · ${sectionTitle(section)}` : "编辑",
          view: "查看",
        }}
        form={form}
        submitting={submitting}
        width={section === "outline" || section === "works" ? 760 : 640}
        initialValues={formInitialValues}
        onClose={() => {
          setMode({ kind: "closed" });
          setSection(null);
        }}
        onSubmit={async (values: Record<string, unknown>) => {
          setSubmitting(true);
          try {
            if (section === "seo") {
              const seoPatch: LandingSeo = {
                title: String(values.seo_title || ""),
                description: String(values.seo_description || ""),
                keywords: String(values.seo_keywords || ""),
                og_image: String(values.seo_og_image || ""),
              };
              await authorApi.patchSiteLanding({
                seo: seoPatch,
                seo_by_route: { home: seoPatch },
              });
            } else if (section === "hero") {
              const trust = (values.trust as LandingHomeHero["trust"]) || [];
              await authorApi.patchSiteLanding({
                home: {
                  hero: {
                    eyebrow: String(values.eyebrow || ""),
                    title_lead: String(values.title_lead || ""),
                    title_em: String(values.title_em || ""),
                    title_line2: String(values.title_line2 || ""),
                    pillars: textToPillars(String(values.pillars_text || "")),
                    sub: String(values.sub || ""),
                    cta_primary: String(values.cta_primary || ""),
                    cta_secondary: String(values.cta_secondary || ""),
                    note: String(values.note || ""),
                    trust,
                  },
                },
              });
            } else if (section === "pain") {
              await authorApi.patchSiteLanding({
                home: {
                  pain: {
                    tag: String(values.tag || ""),
                    title_lines: textToTitleLines(String(values.title_lines_text || "")),
                    subtitle: String(values.subtitle || ""),
                    items: (values.items as NonNullable<NonNullable<LandingHomeContent["pain"]>["items"]>) || [],
                    turn: String(values.turn || ""),
                  },
                },
              });
            } else if (section === "features") {
              await authorApi.patchSiteLanding({
                home: {
                  features: {
                    tag: String(values.tag || ""),
                    title_before: String(values.title_before || ""),
                    title_accent: String(values.title_accent || ""),
                    meta: textToPillars(String(values.meta_text || "")),
                    items: (values.items as NonNullable<LandingHomeContent["features"]>["items"]) || [],
                  },
                },
              });
            } else if (section === "outline") {
              let weeks: unknown;
              try {
                weeks = JSON.parse(String(values.weeks_json || "[]"));
              } catch {
                message.error("weeks JSON 格式无效");
                throw new Error("invalid weeks json");
              }
              if (!Array.isArray(weeks)) {
                message.error("weeks 必须是 JSON 数组");
                throw new Error("weeks not array");
              }
              await authorApi.patchSiteLanding({
                home: {
                  outline: {
                    tag: String(values.tag || ""),
                    title: String(values.title || ""),
                    subtitle: String(values.subtitle || ""),
                    weeks: weeks as NonNullable<LandingHomeContent["outline"]>["weeks"],
                  },
                },
              });
            } else if (section === "method") {
              await authorApi.patchSiteLanding({
                home: {
                  method: {
                    tag: String(values.tag || ""),
                    title_line1: String(values.title_line1 || ""),
                    title_line2: String(values.title_line2 || ""),
                    subtitle: String(values.subtitle || ""),
                    roles: (values.roles as NonNullable<LandingHomeContent["method"]>["roles"]) || [],
                  },
                },
              });
            } else if (section === "works") {
              await authorApi.patchSiteLanding({
                home: {
                  works: {
                    tag: String(values.tag || ""),
                    title: String(values.title || ""),
                    subtitle: String(values.subtitle || ""),
                    items: (values.items as NonNullable<LandingHomeContent["works"]>["items"]) || [],
                  },
                },
              });
            } else if (section === "voices") {
              await authorApi.patchSiteLanding({
                home: {
                  voices: {
                    tag: String(values.tag || ""),
                    title: String(values.title || ""),
                    items: (values.items as NonNullable<LandingHomeContent["voices"]>["items"]) || [],
                  },
                },
              });
            } else if (section === "pricing") {
              await authorApi.patchSiteLanding({
                home: {
                  pricing: {
                    tag: String(values.tag || ""),
                    title: String(values.title || ""),
                    subtitle: String(values.subtitle || ""),
                    perks: textToPerks(String(values.perks_text || "")),
                    price_label: String(values.price_label || ""),
                    price_amount: String(values.price_amount || ""),
                    price_unit: String(values.price_unit || ""),
                    price_note: String(values.price_note || ""),
                  },
                },
              });
            } else if (section === "faq") {
              await authorApi.patchSiteLanding({
                home: {
                  faq: {
                    tag: String(values.tag || ""),
                    title: String(values.title || ""),
                    items: (values.items as NonNullable<LandingHomeContent["faq"]>["items"]) || [],
                  },
                },
              });
            } else if (section === "final_cta") {
              await authorApi.patchSiteLanding({
                home: {
                  final_cta: {
                    title: String(values.title || ""),
                    body: String(values.body || ""),
                    secondary_cta: String(values.secondary_cta || ""),
                  },
                },
              });
            }

            message.success("已保存，官网将同步展示");
            setMode({ kind: "closed" });
            setSection(null);
            await load();
          } catch (err) {
            if (err instanceof Error && (err.message === "invalid weeks json" || err.message === "weeks not array")) {
              throw err;
            }
            message.error(err instanceof ApiError ? err.message : "保存失败");
            throw err;
          } finally {
            setSubmitting(false);
          }
        }}
      >
        {section === "hero" ? (
          <>
            <Form.Item name="eyebrow" label="Eyebrow" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item name="title_lead" label="标题 lead" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item name="title_em" label="标题强调 em">
              <Input />
            </Form.Item>
            <Form.Item name="title_line2" label="标题第二行">
              <Input />
            </Form.Item>
            <Form.Item name="pillars_text" label="Pillars" extra="每行一项">
              <Input.TextArea rows={3} />
            </Form.Item>
            <Form.Item name="sub" label="副文">
              <Input.TextArea rows={2} />
            </Form.Item>
            <Form.Item name="cta_primary" label="主 CTA">
              <Input />
            </Form.Item>
            <Form.Item name="cta_secondary" label="次 CTA">
              <Input />
            </Form.Item>
            <Form.Item name="note" label="注释">
              <Input />
            </Form.Item>
            <Typography.Text strong style={{ display: "block", marginBottom: 8 }}>
              Trust（建议 4 条）
            </Typography.Text>
            <Form.List name="trust">
              {(fields, { add, remove }) => (
                <>
                  {fields.map((field) => (
                    <Space key={field.key} align="start" style={{ display: "flex", marginBottom: 8 }} wrap>
                      <Form.Item {...field} name={[field.name, "num"]} rules={[{ required: true }]} style={{ marginBottom: 0 }}>
                        <Input placeholder="数值" style={{ width: 80 }} />
                      </Form.Item>
                      <Form.Item {...field} name={[field.name, "unit"]} style={{ marginBottom: 0 }}>
                        <Input placeholder="单位" style={{ width: 64 }} />
                      </Form.Item>
                      <Form.Item {...field} name={[field.name, "label"]} rules={[{ required: true }]} style={{ marginBottom: 0, flex: 1 }}>
                        <Input placeholder="说明" style={{ minWidth: 160 }} />
                      </Form.Item>
                      <Button type="text" danger icon={<DeleteOutlined />} onClick={() => remove(field.name)} />
                    </Space>
                  ))}
                  <Button type="dashed" onClick={() => add({ num: "", unit: "", label: "" })} icon={<PlusOutlined />} block>
                    添加 Trust
                  </Button>
                </>
              )}
            </Form.List>
          </>
        ) : null}

        {section === "pain" ? (
          <>
            <Form.Item name="tag" label="Tag">
              <Input />
            </Form.Item>
            <Form.Item name="title_lines_text" label="标题行" extra="每行一行标题" rules={[{ required: true }]}>
              <Input.TextArea rows={2} />
            </Form.Item>
            <Form.Item name="subtitle" label="副标题">
              <Input.TextArea rows={2} />
            </Form.Item>
            <Form.Item name="turn" label="转折文案">
              <Input.TextArea rows={2} />
            </Form.Item>
            <Typography.Text strong style={{ display: "block", marginBottom: 8 }}>
              痛点条目
            </Typography.Text>
            <Form.List name="items">
              {(fields, { add, remove }) => (
                <>
                  {fields.map((field) => (
                    <Card key={field.key} size="small" style={{ marginBottom: 8 }}
                      extra={<Button type="text" danger icon={<DeleteOutlined />} onClick={() => remove(field.name)} />}
                    >
                      <Form.Item {...field} name={[field.name, "idx"]} label="序号" rules={[{ required: true }]}>
                        <Input placeholder="01" />
                      </Form.Item>
                      <Form.Item {...field} name={[field.name, "title"]} label="标题" rules={[{ required: true }]}>
                        <Input />
                      </Form.Item>
                      <Form.Item {...field} name={[field.name, "body"]} label="正文" rules={[{ required: true }]}>
                        <Input.TextArea rows={2} />
                      </Form.Item>
                    </Card>
                  ))}
                  <Button type="dashed" onClick={() => add({ idx: "", title: "", body: "" })} icon={<PlusOutlined />} block>
                    添加痛点
                  </Button>
                </>
              )}
            </Form.List>
          </>
        ) : null}

        {section === "features" ? (
          <>
            <Form.Item name="tag" label="Tag">
              <Input />
            </Form.Item>
            <Form.Item name="title_before" label="标题前缀">
              <Input />
            </Form.Item>
            <Form.Item name="title_accent" label="标题强调">
              <Input />
            </Form.Item>
            <Form.Item name="meta_text" label="Meta" extra="每行一项">
              <Input.TextArea rows={4} />
            </Form.Item>
            <Typography.Text strong style={{ display: "block", marginBottom: 8 }}>
              Feature 条目
            </Typography.Text>
            <Form.List name="items">
              {(fields, { add, remove }) => (
                <>
                  {fields.map((field) => (
                    <Card
                      key={field.key}
                      size="small"
                      style={{ marginBottom: 8 }}
                      extra={<Button type="text" danger icon={<DeleteOutlined />} onClick={() => remove(field.name)} />}
                    >
                      <Form.Item {...field} name={[field.name, "no"]} label="编号" rules={[{ required: true }]}>
                        <Input />
                      </Form.Item>
                      <Form.Item {...field} name={[field.name, "title"]} label="标题" rules={[{ required: true }]}>
                        <Input />
                      </Form.Item>
                      <Form.Item {...field} name={[field.name, "body"]} label="正文" rules={[{ required: true }]}>
                        <Input.TextArea rows={2} />
                      </Form.Item>
                    </Card>
                  ))}
                  <Button type="dashed" onClick={() => add({ no: "", title: "", body: "" })} icon={<PlusOutlined />} block>
                    添加 Feature
                  </Button>
                </>
              )}
            </Form.List>
          </>
        ) : null}

        {section === "outline" ? (
          <>
            <Form.Item name="tag" label="Tag">
              <Input />
            </Form.Item>
            <Form.Item name="title" label="标题">
              <Input />
            </Form.Item>
            <Form.Item name="subtitle" label="副标题">
              <Input.TextArea rows={2} />
            </Form.Item>
            <Form.Item
              name="weeks_json"
              label="Weeks JSON"
              extra="完整 weeks 数组；结构含 week/title/summary/status/days/comingNotes"
              rules={[
                { required: true, message: "请填写 weeks JSON" },
                {
                  validator: async (_, value) => {
                    try {
                      const parsed = JSON.parse(String(value || ""));
                      if (!Array.isArray(parsed)) throw new Error("not array");
                    } catch {
                      throw new Error("必须是合法 JSON 数组");
                    }
                  },
                },
              ]}
            >
              <Input.TextArea rows={16} style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 12 }} />
            </Form.Item>
            <Button onClick={fillWeeksDefault}>从默认填充</Button>
          </>
        ) : null}

        {section === "method" ? (
          <>
            <Form.Item name="tag" label="Tag">
              <Input />
            </Form.Item>
            <Form.Item name="title_line1" label="标题行 1">
              <Input />
            </Form.Item>
            <Form.Item name="title_line2" label="标题行 2">
              <Input />
            </Form.Item>
            <Form.Item name="subtitle" label="副标题">
              <Input.TextArea rows={2} />
            </Form.Item>
            <Typography.Text strong style={{ display: "block", marginBottom: 8 }}>
              角色 Roles
            </Typography.Text>
            <Form.List name="roles">
              {(fields, { add, remove }) => (
                <>
                  {fields.map((field) => (
                    <Card
                      key={field.key}
                      size="small"
                      style={{ marginBottom: 8 }}
                      extra={<Button type="text" danger icon={<DeleteOutlined />} onClick={() => remove(field.name)} />}
                    >
                      <Form.Item {...field} name={[field.name, "token"]} label="Token" rules={[{ required: true }]}>
                        <Input placeholder="@pm" />
                      </Form.Item>
                      <Form.Item {...field} name={[field.name, "title"]} label="标题" rules={[{ required: true }]}>
                        <Input />
                      </Form.Item>
                      <Form.Item {...field} name={[field.name, "desc"]} label="描述" rules={[{ required: true }]}>
                        <Input.TextArea rows={2} />
                      </Form.Item>
                    </Card>
                  ))}
                  <Button type="dashed" onClick={() => add({ token: "", title: "", desc: "" })} icon={<PlusOutlined />} block>
                    添加角色
                  </Button>
                </>
              )}
            </Form.List>
          </>
        ) : null}

        {section === "works" ? (
          <>
            <Form.Item name="tag" label="Tag">
              <Input />
            </Form.Item>
            <Form.Item name="title" label="标题">
              <Input />
            </Form.Item>
            <Form.Item name="subtitle" label="副标题">
              <Input.TextArea rows={2} />
            </Form.Item>
            <Typography.Text strong style={{ display: "block", marginBottom: 8 }}>
              成果条目
            </Typography.Text>
            <Form.List name="items">
              {(fields, { add, remove }) => (
                <>
                  {fields.map((field) => (
                    <Card
                      key={field.key}
                      size="small"
                      style={{ marginBottom: 8 }}
                      extra={<Button type="text" danger icon={<DeleteOutlined />} onClick={() => remove(field.name)} />}
                    >
                      <Form.Item {...field} name={[field.name, "tag"]} label="Tag" rules={[{ required: true }]}>
                        <Input />
                      </Form.Item>
                      <Form.Item {...field} name={[field.name, "title"]} label="标题" rules={[{ required: true }]}>
                        <Input />
                      </Form.Item>
                      <Form.Item {...field} name={[field.name, "body"]} label="正文" rules={[{ required: true }]}>
                        <Input.TextArea rows={2} />
                      </Form.Item>
                      <Form.Item {...field} name={[field.name, "who"]} label="Who">
                        <Input />
                      </Form.Item>
                      <Form.Item {...field} name={[field.name, "badge"]} label="Badge">
                        <Input />
                      </Form.Item>
                      <Form.Item {...field} name={[field.name, "fill"]} label="颜色 fill（可选）">
                        <Input placeholder="#..." />
                      </Form.Item>
                      <Form.Item {...field} name={[field.name, "path"]} label="path（可选）">
                        <Input />
                      </Form.Item>
                      <Form.Item {...field} name={[field.name, "sun"]} label="sun（可选）">
                        <Input />
                      </Form.Item>
                    </Card>
                  ))}
                  <Button
                    type="dashed"
                    onClick={() => add({ tag: "", title: "", body: "", who: "", badge: "" })}
                    icon={<PlusOutlined />}
                    block
                  >
                    添加成果
                  </Button>
                </>
              )}
            </Form.List>
          </>
        ) : null}

        {section === "voices" ? (
          <>
            <Form.Item name="tag" label="Tag">
              <Input />
            </Form.Item>
            <Form.Item name="title" label="标题">
              <Input />
            </Form.Item>
            <Typography.Text strong style={{ display: "block", marginBottom: 8 }}>
              评价
            </Typography.Text>
            <Form.List name="items">
              {(fields, { add, remove }) => (
                <>
                  {fields.map((field) => (
                    <Card
                      key={field.key}
                      size="small"
                      style={{ marginBottom: 8 }}
                      extra={<Button type="text" danger icon={<DeleteOutlined />} onClick={() => remove(field.name)} />}
                    >
                      <Form.Item {...field} name={[field.name, "quote"]} label="引用" rules={[{ required: true }]}>
                        <Input.TextArea rows={2} />
                      </Form.Item>
                      <Form.Item {...field} name={[field.name, "name"]} label="姓名" rules={[{ required: true }]}>
                        <Input />
                      </Form.Item>
                      <Form.Item {...field} name={[field.name, "meta"]} label="Meta">
                        <Input />
                      </Form.Item>
                      <Form.Item {...field} name={[field.name, "avatarBg"]} label="头像色（可选）">
                        <Input />
                      </Form.Item>
                    </Card>
                  ))}
                  <Button type="dashed" onClick={() => add({ quote: "", name: "", meta: "" })} icon={<PlusOutlined />} block>
                    添加评价
                  </Button>
                </>
              )}
            </Form.List>
          </>
        ) : null}

        {section === "pricing" ? (
          <>
            <Form.Item name="tag" label="Tag">
              <Input />
            </Form.Item>
            <Form.Item name="title" label="标题">
              <Input />
            </Form.Item>
            <Form.Item name="subtitle" label="副标题">
              <Input.TextArea rows={2} />
            </Form.Item>
            <Form.Item name="price_label" label="价格标签">
              <Input />
            </Form.Item>
            <Form.Item name="price_amount" label="价格金额">
              <Input placeholder="¥1,980" />
            </Form.Item>
            <Form.Item name="price_unit" label="单位">
              <Input placeholder="/人" />
            </Form.Item>
            <Form.Item name="price_note" label="价格备注">
              <Input />
            </Form.Item>
            <Form.Item name="perks_text" label="权益" extra="每行一条">
              <Input.TextArea rows={6} />
            </Form.Item>
          </>
        ) : null}

        {section === "faq" ? (
          <>
            <Form.Item name="tag" label="Tag">
              <Input />
            </Form.Item>
            <Form.Item name="title" label="标题">
              <Input />
            </Form.Item>
            <Typography.Text strong style={{ display: "block", marginBottom: 8 }}>
              FAQ 条目
            </Typography.Text>
            <Form.List name="items">
              {(fields, { add, remove }) => (
                <>
                  {fields.map((field) => (
                    <Card
                      key={field.key}
                      size="small"
                      style={{ marginBottom: 8 }}
                      extra={<Button type="text" danger icon={<DeleteOutlined />} onClick={() => remove(field.name)} />}
                    >
                      <Form.Item {...field} name={[field.name, "q"]} label="问题" rules={[{ required: true }]}>
                        <Input />
                      </Form.Item>
                      <Form.Item {...field} name={[field.name, "a"]} label="回答" rules={[{ required: true }]}>
                        <Input.TextArea rows={3} />
                      </Form.Item>
                    </Card>
                  ))}
                  <Button type="dashed" onClick={() => add({ q: "", a: "" })} icon={<PlusOutlined />} block>
                    添加 FAQ
                  </Button>
                </>
              )}
            </Form.List>
          </>
        ) : null}

        {section === "final_cta" ? (
          <>
            <Form.Item name="title" label="标题" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item name="body" label="正文">
              <Input.TextArea rows={3} />
            </Form.Item>
            <Form.Item name="secondary_cta" label="次按钮文案">
              <Input />
            </Form.Item>
          </>
        ) : null}

        {section === "seo" ? (
          <>
            <Form.Item
              name="seo_title"
              label="页面标题"
              rules={[{ required: true, message: "请填写页面标题" }]}
              extra="建议固定品牌 + 产品名，避免页签闪烁"
            >
              <Input />
            </Form.Item>
            <Form.Item name="seo_description" label="描述" rules={[{ required: true }]}>
              <Input.TextArea rows={3} maxLength={180} showCount />
            </Form.Item>
            <Form.Item name="seo_keywords" label="关键词">
              <Input placeholder="逗号分隔" />
            </Form.Item>
            <Form.Item name="seo_og_image" label="分享图 URL">
              <Input />
            </Form.Item>
          </>
        ) : null}
      </EntityModal>

      <Modal
        title="上传首页宣传片媒资"
        open={heroMediaOpen}
        onCancel={() => !uploading && setHeroMediaOpen(false)}
        footer={[
          <Button key="close" disabled={uploading} onClick={() => setHeroMediaOpen(false)}>
            关闭
          </Button>,
        ]}
        destroyOnClose
      >
        <Typography.Paragraph type="secondary">
          选择文件后立即上传。海报可作为可选首屏底图；视频为遗留宣传片媒资。
        </Typography.Paragraph>
        <Upload.Dragger
          multiple={false}
          accept="video/*,image/*,.vtt"
          disabled={uploading}
          customRequest={async ({ file, onSuccess, onError }) => {
            setUploading(true);
            try {
              const fd = new FormData();
              const f = file as File;
              if (f.type.startsWith("video")) fd.append("video", f);
              else if (f.name.endsWith(".vtt")) fd.append("captions", f);
              else fd.append("poster", f);
              await authorApi.uploadSiteHero(fd);
              message.success("上传成功");
              onSuccess?.({});
              setHeroMediaOpen(false);
              await load();
            } catch (err) {
              message.error(err instanceof ApiError ? err.message : "上传失败");
              onError?.(err as Error);
            } finally {
              setUploading(false);
            }
          }}
          showUploadList={false}
        >
          <p>
            <UploadOutlined /> {uploading ? "上传中…" : "拖拽或点击上传视频 / 海报 / 字幕"}
          </p>
        </Upload.Dragger>
      </Modal>
    </div>
  );
}
