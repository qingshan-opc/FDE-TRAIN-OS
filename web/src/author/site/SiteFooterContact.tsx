import { useCallback, useEffect, useMemo, useState } from "react";
import { App, Button, Card, Col, Descriptions, Form, Input, Row } from "antd";
import { authorApi, ApiError } from "../../lib/api";
import { PageHeader, EntityModal, type EntityModalMode } from "../../components/crud";
import type { LandingBrand, LandingContact, LandingFooterContent } from "../../lib/types";
import { defaultFooter } from "../../app/resolveLandingContent";
import {
  LANDING_FOOTER_BUSINESS_EMAIL,
  LANDING_FOOTER_COMPANY,
  LANDING_FOOTER_OFFICE,
  LANDING_FOOTER_TAGLINE,
} from "../../app/landingShared";

type SectionKey = "footer" | "contact" | "brand";

type FooterState = {
  footer?: LandingFooterContent;
  contact?: LandingContact;
  brand?: LandingBrand;
};

const DEFAULT_CONTACT: LandingContact = {
  title: "联系我们",
  subtitle: "企业、高校与政府组织培训咨询",
  email: LANDING_FOOTER_BUSINESS_EMAIL,
  note: "请留下组织名称、培训规模与期望开课时间，我们会安排顾问对接。",
};

export function SiteFooterContact() {
  const { message, modal } = App.useApp();
  const [data, setData] = useState<FooterState | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<EntityModalMode>({ kind: "closed" });
  const [section, setSection] = useState<SectionKey | null>(null);
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData((await authorApi.getSiteLanding()) as FooterState);
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => {
    void load();
  }, [load]);

  const footerDefaults = useMemo(() => defaultFooter(), []);
  const footer: LandingFooterContent = useMemo(
    () => ({ ...footerDefaults, ...(data?.footer || {}) }),
    [footerDefaults, data?.footer],
  );
  const contact: LandingContact = useMemo(
    () => ({ ...DEFAULT_CONTACT, ...(data?.contact || {}) }),
    [data?.contact],
  );
  const brandFooter = data?.brand?.footer || "";

  const openSection = (key: SectionKey) => {
    setSection(key);
    setMode({ kind: "edit", id: key });
  };

  const formInitialValues = useMemo(() => {
    if (mode.kind !== "edit" || !section) return null;
    if (section === "footer") {
      return {
        blurb: footer.blurb,
        company: footer.company,
        email: footer.email,
        office: footer.office,
        tagline: footer.tagline,
      };
    }
    if (section === "contact") {
      return {
        title: contact.title,
        subtitle: contact.subtitle,
        email: contact.email,
        note: contact.note,
      };
    }
    return { brand_footer: brandFooter };
  }, [mode.kind, section, footer, contact, brandFooter]);

  const seedFromDefaults = () => {
    modal.confirm({
      title: "从默认填充页脚与联系？",
      content: "将覆盖 footer、contact 与 brand.footer。",
      okText: "确认填充",
      cancelText: "取消",
      onOk: async () => {
        setSeeding(true);
        try {
          await authorApi.patchSiteLanding({
            footer: defaultFooter(),
            contact: { ...DEFAULT_CONTACT },
            brand: {
              footer: `© ${LANDING_FOOTER_COMPANY.split(" & ")[0] || "青山在"} · FDE Learning OS`,
            },
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
        title="页脚与联系"
        description="官网页脚信息、联系区块与品牌页脚文案"
        extra={
          <Button loading={seeding} onClick={seedFromDefaults}>
            从默认填充
          </Button>
        }
      />

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card
            loading={loading}
            size="small"
            title="页脚 Footer"
            extra={
              <Button type="link" size="small" onClick={() => openSection("footer")}>
                编辑
              </Button>
            }
          >
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="简介">{footer.blurb || "—"}</Descriptions.Item>
              <Descriptions.Item label="公司">{footer.company || LANDING_FOOTER_COMPANY}</Descriptions.Item>
              <Descriptions.Item label="邮箱">{footer.email || LANDING_FOOTER_BUSINESS_EMAIL}</Descriptions.Item>
              <Descriptions.Item label="办公地">{footer.office || LANDING_FOOTER_OFFICE}</Descriptions.Item>
              <Descriptions.Item label="标语">{footer.tagline || LANDING_FOOTER_TAGLINE}</Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card
            loading={loading}
            size="small"
            title="联系 Contact"
            extra={
              <Button type="link" size="small" onClick={() => openSection("contact")}>
                编辑
              </Button>
            }
          >
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="标题">{contact.title || "—"}</Descriptions.Item>
              <Descriptions.Item label="副标题">{contact.subtitle || "—"}</Descriptions.Item>
              <Descriptions.Item label="邮箱">{contact.email || "—"}</Descriptions.Item>
              <Descriptions.Item label="备注">{contact.note || "—"}</Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
        <Col span={24}>
          <Card
            loading={loading}
            size="small"
            title="品牌页脚 brand.footer"
            extra={
              <Button type="link" size="small" onClick={() => openSection("brand")}>
                编辑
              </Button>
            }
          >
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="页脚版权">{brandFooter || "—"}</Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
      </Row>

      <EntityModal
        mode={mode}
        title={{
          create: "编辑",
          edit:
            section === "contact"
              ? "编辑联系"
              : section === "brand"
                ? "编辑品牌页脚"
                : "编辑页脚",
          view: "查看",
        }}
        form={form}
        submitting={submitting}
        width={560}
        initialValues={formInitialValues}
        onClose={() => {
          setMode({ kind: "closed" });
          setSection(null);
        }}
        onSubmit={async (values: Record<string, string>) => {
          setSubmitting(true);
          try {
            if (section === "footer") {
              await authorApi.patchSiteLanding({
                footer: {
                  blurb: values.blurb,
                  company: values.company,
                  email: values.email,
                  office: values.office,
                  tagline: values.tagline,
                },
              });
            } else if (section === "contact") {
              await authorApi.patchSiteLanding({
                contact: {
                  title: values.title,
                  subtitle: values.subtitle,
                  email: values.email,
                  note: values.note,
                },
              });
            } else if (section === "brand") {
              await authorApi.patchSiteLanding({
                brand: { footer: values.brand_footer },
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
        {section === "footer" ? (
          <>
            <Form.Item name="blurb" label="简介">
              <Input.TextArea rows={3} />
            </Form.Item>
            <Form.Item name="company" label="公司">
              <Input />
            </Form.Item>
            <Form.Item name="email" label="邮箱">
              <Input />
            </Form.Item>
            <Form.Item name="office" label="办公地">
              <Input.TextArea rows={2} />
            </Form.Item>
            <Form.Item name="tagline" label="标语">
              <Input />
            </Form.Item>
          </>
        ) : null}

        {section === "contact" ? (
          <>
            <Form.Item name="title" label="标题" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item name="subtitle" label="副标题">
              <Input />
            </Form.Item>
            <Form.Item name="email" label="邮箱">
              <Input />
            </Form.Item>
            <Form.Item name="note" label="备注">
              <Input.TextArea rows={3} />
            </Form.Item>
          </>
        ) : null}

        {section === "brand" ? (
          <Form.Item name="brand_footer" label="品牌页脚文案" extra="如：© 青山在 · FDE Learning OS">
            <Input />
          </Form.Item>
        ) : null}
      </EntityModal>
    </div>
  );
}
