import { useCallback, useEffect, useState } from "react";
import { App, Button, Form, Input, Card, Descriptions, Space } from "antd";
import { authorApi, ApiError } from "../../lib/api";
import { PageHeader, EntityModal, type EntityModalMode } from "../../components/crud";

type LandingEdit = {
  title?: string;
  tagline?: string;
  brand?: { name?: string; footer?: string };
  cta?: { login?: string; app?: string };
};

export function SiteSettings() {
  const { message } = App.useApp();
  const [data, setData] = useState<LandingEdit | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<EntityModalMode>({ kind: "closed" });
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authorApi.getSiteLanding();
      setData(res);
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div>
      <PageHeader
        title="站点信息"
        description="品牌、标题、标语与 CTA"
        extra={
          <Button
            type="primary"
            loading={loading}
            onClick={() => {
              form.setFieldsValue({
                title: data?.title,
                tagline: data?.tagline,
                brand_name: data?.brand?.name,
                brand_footer: data?.brand?.footer,
                cta_login: data?.cta?.login,
                cta_app: data?.cta?.app,
              });
              setMode({ kind: "edit", id: "landing" });
            }}
          >
            编辑
          </Button>
        }
      />
      <Card loading={loading} size="small">
        <Descriptions column={1} bordered size="small">
          <Descriptions.Item label="站点标题">{data?.title || "—"}</Descriptions.Item>
          <Descriptions.Item label="标语">{data?.tagline || "—"}</Descriptions.Item>
          <Descriptions.Item label="品牌名">{data?.brand?.name || "—"}</Descriptions.Item>
          <Descriptions.Item label="页脚">{data?.brand?.footer || "—"}</Descriptions.Item>
          <Descriptions.Item label="登录 CTA">{data?.cta?.login || "—"}</Descriptions.Item>
          <Descriptions.Item label="学习台 CTA">{data?.cta?.app || "—"}</Descriptions.Item>
        </Descriptions>
      </Card>

      <EntityModal
        mode={mode}
        title={{ create: "编辑", edit: "编辑站点信息", view: "查看" }}
        form={form}
        submitting={submitting}
        onClose={() => setMode({ kind: "closed" })}
        onSubmit={async (values: Record<string, string>) => {
          setSubmitting(true);
          try {
            await authorApi.patchSiteLanding({
              title: values.title,
              tagline: values.tagline,
              brand: { name: values.brand_name, footer: values.brand_footer },
              cta: { login: values.cta_login, app: values.cta_app },
            });
            message.success("已保存");
            setMode({ kind: "closed" });
            await load();
          } finally {
            setSubmitting(false);
          }
        }}
      >
        <Form.Item name="title" label="站点标题" rules={[{ required: true }]}>
          <Input />
        </Form.Item>
        <Form.Item name="tagline" label="标语">
          <Input.TextArea rows={2} />
        </Form.Item>
        <Form.Item name="brand_name" label="品牌名">
          <Input />
        </Form.Item>
        <Form.Item name="brand_footer" label="页脚文案">
          <Input />
        </Form.Item>
        <Space style={{ width: "100%" }} direction="vertical">
          <Form.Item name="cta_login" label="登录路径">
            <Input placeholder="/login" />
          </Form.Item>
          <Form.Item name="cta_app" label="学习台路径">
            <Input placeholder="/app/courses" />
          </Form.Item>
        </Space>
      </EntityModal>
    </div>
  );
}
