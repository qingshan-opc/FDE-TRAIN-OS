import { useCallback, useEffect, useState } from "react";
import { App, Button, Card, Form, Input, Upload, Typography, Space, Tag, Modal } from "antd";
import { UploadOutlined } from "@ant-design/icons";
import { authorApi, ApiError } from "../../lib/api";
import { PageHeader, EntityModal, type EntityModalMode } from "../../components/crud";

export function SiteHome() {
  const { message } = App.useApp();
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<EntityModalMode>({ kind: "closed" });
  const [heroMode, setHeroMode] = useState(false);
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await authorApi.getSiteLanding());
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => {
    void load();
  }, [load]);

  const hero = (data?.hero || {}) as { eyebrow?: string; empty_title?: string };
  const heroVideo = (data?.hero_video || {}) as { src_url?: string; poster_url?: string };

  return (
    <div>
      <PageHeader
        title="首页内容"
        description="Hero 文案与宣传片媒资"
        extra={
          <Space>
            <Button
              onClick={() => {
                form.setFieldsValue({ eyebrow: hero.eyebrow, empty_title: hero.empty_title });
                setMode({ kind: "edit", id: "hero" });
              }}
            >
              编辑文案
            </Button>
            <Button type="primary" onClick={() => setHeroMode(true)}>
              上传 Hero
            </Button>
          </Space>
        }
      />
      <Card loading={loading} size="small" title="Hero">
        <Typography.Paragraph>Eyebrow：{hero.eyebrow || "—"}</Typography.Paragraph>
        <Typography.Paragraph>空态文案：{hero.empty_title || "—"}</Typography.Paragraph>
        <Space>
          <Tag color={heroVideo.src_url ? "green" : "default"}>{heroVideo.src_url ? "已配置视频" : "未配置视频"}</Tag>
          <Tag color={heroVideo.poster_url ? "green" : "default"}>{heroVideo.poster_url ? "已配置海报" : "未配置海报"}</Tag>
        </Space>
      </Card>

      <EntityModal
        mode={mode}
        title={{ create: "编辑", edit: "编辑 Hero 文案", view: "查看" }}
        form={form}
        submitting={submitting}
        onClose={() => setMode({ kind: "closed" })}
        onSubmit={async (values: { eyebrow?: string; empty_title?: string }) => {
          setSubmitting(true);
          try {
            await authorApi.patchSiteLanding({ hero: values });
            message.success("已保存");
            setMode({ kind: "closed" });
            await load();
          } finally {
            setSubmitting(false);
          }
        }}
      >
        <Form.Item name="eyebrow" label="Eyebrow">
          <Input />
        </Form.Item>
        <Form.Item name="empty_title" label="空态标题">
          <Input />
        </Form.Item>
      </EntityModal>

      <Modal
        title="上传 Hero 媒资"
        open={heroMode}
        onCancel={() => !uploading && setHeroMode(false)}
        footer={[
          <Button key="close" disabled={uploading} onClick={() => setHeroMode(false)}>
            关闭
          </Button>,
        ]}
        destroyOnClose
      >
        <Typography.Paragraph type="secondary">
          选择文件后立即上传（视频 / 海报 / VTT 字幕）。上传成功会自动关闭并刷新状态。
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
              setHeroMode(false);
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
