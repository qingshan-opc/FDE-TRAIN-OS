import { useCallback, useEffect, useMemo, useState } from "react";
import { App, Button, Form, Input, Card, Descriptions, Space, Typography } from "antd";
import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import { authorApi, ApiError } from "../../lib/api";
import { PageHeader, EntityModal, type EntityModalMode } from "../../components/crud";
import type { LandingTab } from "../../lib/types";
import { FALLBACK_LANDING_TABS } from "../../app/landingShared";

type LandingEdit = {
  title?: string;
  tagline?: string;
  brand?: { name?: string; footer?: string };
  cta?: { login?: string; app?: string };
  tabs?: LandingTab[];
};

/** Backend REQUIRED_TAB_IDS includes contact; public nav strips it via resolveLandingTabs. */
const REQUIRED_BACKEND_TAB_IDS = ["enterprise", "open", "about", "contact"] as const;

const DEFAULT_TABS_FOR_EDIT: LandingTab[] = [
  ...FALLBACK_LANDING_TABS,
  { id: "contact", label: "联系我们" },
];

function ensureRequiredTabs(tabs: LandingTab[]): LandingTab[] {
  const next = tabs.map((t) => ({ id: String(t.id || "").trim(), label: String(t.label || "").trim() })).filter((t) => t.id);
  const ids = new Set(next.map((t) => t.id));
  for (const id of REQUIRED_BACKEND_TAB_IDS) {
    if (!ids.has(id)) {
      const fallback =
        DEFAULT_TABS_FOR_EDIT.find((t) => t.id === id) ||
        ({ id, label: id === "contact" ? "联系我们" : id } as LandingTab);
      next.push({ ...fallback });
    }
  }
  return next;
}

export function SiteSettings() {
  const { message } = App.useApp();
  const [data, setData] = useState<LandingEdit | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<EntityModalMode>({ kind: "closed" });
  const [editKind, setEditKind] = useState<"basic" | "tabs" | null>(null);
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authorApi.getSiteLanding();
      setData(res as LandingEdit);
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => {
    void load();
  }, [load]);

  const tabsDisplay = useMemo(() => {
    const raw = data?.tabs && data.tabs.length > 0 ? data.tabs : DEFAULT_TABS_FOR_EDIT;
    return ensureRequiredTabs(raw);
  }, [data?.tabs]);

  const editValues = useMemo(() => {
    if (!data || mode.kind !== "edit" || !editKind) return null;
    if (editKind === "tabs") {
      return { tabs: tabsDisplay.map((t) => ({ ...t })) };
    }
    return {
      title: data.title,
      tagline: data.tagline,
      brand_name: data.brand?.name,
      brand_footer: data.brand?.footer,
      cta_login: data.cta?.login,
      cta_app: data.cta?.app,
    };
  }, [data, mode.kind, editKind, tabsDisplay]);

  return (
    <div>
      <PageHeader
        title="站点设置"
        description="品牌、站点级标语、CTA 与导航 Tabs（保存后官网同步生效）"
        extra={
          <Space wrap>
            <Button onClick={() => { setEditKind("tabs"); setMode({ kind: "edit", id: "tabs" }); }}>
              编辑 Tabs
            </Button>
            <Button
              type="primary"
              loading={loading}
              onClick={() => {
                setEditKind("basic");
                setMode({ kind: "edit", id: "landing" });
              }}
            >
              编辑
            </Button>
          </Space>
        }
      />
      <Card loading={loading} size="small" style={{ marginBottom: 16 }}>
        <Descriptions column={1} bordered size="small">
          <Descriptions.Item label="站点标题">{data?.title || "—"}</Descriptions.Item>
          <Descriptions.Item label="站点标语">{data?.tagline || "—"}</Descriptions.Item>
          <Descriptions.Item label="品牌名">{data?.brand?.name || "—"}</Descriptions.Item>
          <Descriptions.Item label="页脚">{data?.brand?.footer || "—"}</Descriptions.Item>
          <Descriptions.Item label="登录 CTA">{data?.cta?.login || "—"}</Descriptions.Item>
          <Descriptions.Item label="学习台 CTA">{data?.cta?.app || "—"}</Descriptions.Item>
        </Descriptions>
      </Card>

      <Card loading={loading} size="small" title="导航 Tabs">
        <Descriptions column={1} bordered size="small">
          <Descriptions.Item label="当前 Tabs">
            {(tabsDisplay || []).map((t) => `${t.id}:${t.label}`).join(" · ") || "—"}
          </Descriptions.Item>
        </Descriptions>
        <Typography.Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0, fontSize: 12 }}>
          后端校验要求包含 enterprise / open / about / contact。官网前台会隐藏 contact（见 resolveLandingTabs）；保存时若缺失会自动补全。
        </Typography.Paragraph>
      </Card>

      <EntityModal
        mode={mode}
        title={{
          create: "编辑",
          edit: editKind === "tabs" ? "编辑导航 Tabs" : "编辑站点设置",
          view: "查看",
        }}
        form={form}
        submitting={submitting}
        width={editKind === "tabs" ? 560 : 520}
        initialValues={editValues}
        onClose={() => {
          setMode({ kind: "closed" });
          setEditKind(null);
        }}
        onSubmit={async (values: Record<string, unknown>) => {
          setSubmitting(true);
          try {
            if (editKind === "tabs") {
              const tabs = ensureRequiredTabs((values.tabs as LandingTab[]) || []);
              const res = (await authorApi.patchSiteLanding({ tabs })) as LandingEdit;
              setData(res);
            } else {
              const res = (await authorApi.patchSiteLanding({
                title: values.title,
                tagline: values.tagline,
                brand: { name: values.brand_name, footer: values.brand_footer },
                cta: { login: values.cta_login, app: values.cta_app },
              })) as LandingEdit;
              setData(res);
            }
            message.success("已保存，官网将同步展示");
            setMode({ kind: "closed" });
            setEditKind(null);
          } catch (err) {
            message.error(err instanceof ApiError ? err.message : "保存失败");
            throw err;
          } finally {
            setSubmitting(false);
          }
        }}
      >
        {editKind === "tabs" ? (
          <>
            <Typography.Paragraph type="secondary" style={{ fontSize: 12 }}>
              每项需填写 id + label。必含：enterprise、open、about、contact（contact 仅存档，前台导航会过滤）。
            </Typography.Paragraph>
            <Form.List name="tabs">
              {(fields, { add, remove }) => (
                <>
                  {fields.map((field) => (
                    <Space key={field.key} align="start" style={{ display: "flex", marginBottom: 8 }} wrap>
                      <Form.Item
                        {...field}
                        name={[field.name, "id"]}
                        rules={[{ required: true, message: "id" }]}
                        style={{ marginBottom: 0 }}
                      >
                        <Input placeholder="id" style={{ width: 140 }} />
                      </Form.Item>
                      <Form.Item
                        {...field}
                        name={[field.name, "label"]}
                        rules={[{ required: true, message: "label" }]}
                        style={{ marginBottom: 0, flex: 1 }}
                      >
                        <Input placeholder="显示名" style={{ minWidth: 160 }} />
                      </Form.Item>
                      <Button type="text" danger icon={<DeleteOutlined />} onClick={() => remove(field.name)} />
                    </Space>
                  ))}
                  <Button type="dashed" onClick={() => add({ id: "", label: "" })} icon={<PlusOutlined />} block>
                    添加 Tab
                  </Button>
                </>
              )}
            </Form.List>
          </>
        ) : (
          <>
            <Form.Item name="title" label="站点标题" rules={[{ required: true, message: "请填写站点标题" }]}>
              <Input placeholder="如：青山在" />
            </Form.Item>
            <Form.Item
              name="tagline"
              label="站点标语"
              extra="站点级标语（不一定是首页 Hero 副标题；营期首页副文案在「首页营期文案」中编辑）"
            >
              <Input.TextArea rows={2} placeholder="一句话说明价值主张" />
            </Form.Item>
            <Form.Item name="brand_name" label="品牌名" extra="顶栏与页脚品牌文案">
              <Input />
            </Form.Item>
            <Form.Item name="brand_footer" label="页脚文案">
              <Input placeholder="如：© 青山在 · FDE Learning OS" />
            </Form.Item>
            <Space style={{ width: "100%" }} direction="vertical">
              <Form.Item name="cta_login" label="登录路径">
                <Input placeholder="/login" />
              </Form.Item>
              <Form.Item name="cta_app" label="学习台路径">
                <Input placeholder="/app/courses" />
              </Form.Item>
            </Space>
          </>
        )}
      </EntityModal>
    </div>
  );
}
