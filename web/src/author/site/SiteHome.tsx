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
import { ExportOutlined, UploadOutlined } from "@ant-design/icons";
import { Link } from "react-router-dom";
import { authorApi, ApiError } from "../../lib/api";
import { PageHeader, EntityModal, type EntityModalMode } from "../../components/crud";
import type { LandingHeroCopy, LandingSeo } from "../../lib/types";

type LandingHome = {
  hero?: LandingHeroCopy;
  seo?: LandingSeo;
  tagline?: string;
  hero_video?: {
    src_url?: string | null;
    poster_url?: string | null;
    captions_url?: string | null;
    object_key?: string | null;
    stream_url?: string | null;
  } | null;
};

const DEFAULT_HERO: LandingHeroCopy = {
  eyebrow: "FDE LEARNING OS",
  title_lines: ["让每一次学习", "都留下可验证的证据"],
  title_em: "可验证",
  empty_title: "课程宣传片筹备中",
  cta_primary: "进入学习",
  cta_secondary: "了解企业培训",
  bg_image: "/landing/hero.png",
  proof: [
    { value: "21", label: "天任务驱动训练" },
    { value: "100%", label: "交付全程留痕" },
    { value: "3", label: "类机构同行验证" },
  ],
};

const DEFAULT_SEO: LandingSeo = {
  title: "青山在 · FDE Learning OS", // 与 index.html / SITE_DEFAULT_TITLE 一致
  description: "为政府、高校与企业交付可验收的数字化人才训练。任务驱动课纲、Agent 实训环境、可核验结业证书。",
  keywords: "青山在,FDE,数字化人才,企业培训,训练营,Agent实训,结业证书,可验收交付",
  og_image: "/landing/hero.png",
};

function mediaPreviewUrl(raw?: string | null): string | null {
  if (!raw) return null;
  if (raw.startsWith("http") || raw.startsWith("/")) return raw;
  return `/api/v1/site/hero/stream?asset=poster`;
}

export function SiteHome() {
  const { message } = App.useApp();
  const [data, setData] = useState<LandingHome | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<EntityModalMode>({ kind: "closed" });
  const [editKind, setEditKind] = useState<"hero" | "seo" | null>(null);
  const [heroMode, setHeroMode] = useState(false);
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData((await authorApi.getSiteLanding()) as LandingHome);
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => {
    void load();
  }, [load]);

  const hero = { ...DEFAULT_HERO, ...(data?.hero || {}) };
  const seo = { ...DEFAULT_SEO, ...(data?.seo || {}) };
  const heroVideo = data?.hero_video || null;
  const posterPreview =
    mediaPreviewUrl(heroVideo?.poster_url) ||
    (heroVideo?.poster_url ? "/api/v1/site/hero/stream?asset=poster" : null) ||
    hero.bg_image ||
    "/landing/hero.png";
  const hasVideo = Boolean(heroVideo?.src_url || heroVideo?.object_key || heroVideo?.stream_url);

  const formInitialValues = useMemo(() => {
    if (mode.kind !== "edit" || !editKind) return null;
    if (editKind === "hero") {
      const lines = hero.title_lines || DEFAULT_HERO.title_lines || [];
      const proof = hero.proof || DEFAULT_HERO.proof || [];
      return {
        eyebrow: hero.eyebrow,
        title_line1: lines[0] || "",
        title_line2: lines[1] || "",
        title_em: hero.title_em,
        cta_primary: hero.cta_primary,
        cta_secondary: hero.cta_secondary,
        empty_title: hero.empty_title,
        bg_image: hero.bg_image,
        proof0_value: proof[0]?.value,
        proof0_label: proof[0]?.label,
        proof1_value: proof[1]?.value,
        proof1_label: proof[1]?.label,
        proof2_value: proof[2]?.value,
        proof2_label: proof[2]?.label,
      };
    }
    return {
      seo_title: seo.title,
      seo_description: seo.description,
      seo_keywords: seo.keywords,
      seo_og_image: seo.og_image,
    };
  }, [mode.kind, editKind, hero, seo]);

  const openHeroEdit = () => {
    setEditKind("hero");
    setMode({ kind: "edit", id: "hero" });
  };

  const openSeoEdit = () => {
    setEditKind("seo");
    setMode({ kind: "edit", id: "seo" });
  };

  return (
    <div>
      <PageHeader
        title="首页内容"
        description="官网首页 Hero 文案、数据背书、媒资与 SEO；保存后立即生效"
        extra={
          <Space wrap>
            <Link to="/" target="_blank" rel="noreferrer">
              <Button icon={<ExportOutlined />}>预览官网</Button>
            </Link>
            <Button onClick={openSeoEdit}>编辑 SEO</Button>
            <Button onClick={openHeroEdit}>编辑 Hero 文案</Button>
            <Button type="primary" onClick={() => setHeroMode(true)}>
              上传 Hero 媒资
            </Button>
          </Space>
        }
      />

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={14}>
          <Card loading={loading} size="small" title="Hero 文案（官网首屏）">
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="Eyebrow">{hero.eyebrow || "—"}</Descriptions.Item>
              <Descriptions.Item label="主标题">
                {(hero.title_lines || []).filter(Boolean).join(" / ") || "—"}
                {hero.title_em ? (
                  <Typography.Text type="secondary">（强调：{hero.title_em}）</Typography.Text>
                ) : null}
              </Descriptions.Item>
              <Descriptions.Item label="副标题">
                <Typography.Text type="secondary">来自「站点信息」标语：</Typography.Text>{" "}
                {data?.tagline || "—"}
              </Descriptions.Item>
              <Descriptions.Item label="主按钮">{hero.cta_primary || "—"}</Descriptions.Item>
              <Descriptions.Item label="次按钮">{hero.cta_secondary || "—"}</Descriptions.Item>
              <Descriptions.Item label="数据背书">
                <Space wrap>
                  {(hero.proof || []).map((p, i) => (
                    <Tag key={i} color="processing">
                      {p.value} {p.label}
                    </Tag>
                  ))}
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="静态底图">{hero.bg_image || "—"}</Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card loading={loading} size="small" title="Hero 媒资">
            <div
              style={{
                borderRadius: 12,
                overflow: "hidden",
                aspectRatio: "16/9",
                background: "#0f2e2a",
                marginBottom: 12,
              }}
            >
              {posterPreview ? (
                <img src={posterPreview} alt="Hero 预览" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : null}
            </div>
            <Space wrap>
              <Tag color={hasVideo ? "green" : "default"}>{hasVideo ? "已上传视频" : "未上传视频"}</Tag>
              <Tag color={heroVideo?.poster_url ? "green" : "default"}>
                {heroVideo?.poster_url ? "已上传海报（优先作首屏底图）" : "使用静态底图"}
              </Tag>
            </Space>
            <Typography.Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0, fontSize: 12 }}>
              上传海报后官网首屏背景会替换为该图；未上传时使用静态底图 `/landing/hero.png`。
            </Typography.Paragraph>
          </Card>
        </Col>
        <Col span={24}>
          <Card loading={loading} size="small" title="SEO">
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="页面标题">{seo.title || "—"}</Descriptions.Item>
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
          edit: editKind === "seo" ? "编辑 SEO" : "编辑 Hero 文案",
          view: "查看",
        }}
        form={form}
        submitting={submitting}
        width={640}
        initialValues={formInitialValues}
        onClose={() => {
          setMode({ kind: "closed" });
          setEditKind(null);
        }}
        onSubmit={async (values: Record<string, string>) => {
          setSubmitting(true);
          try {
            if (editKind === "seo") {
              await authorApi.patchSiteLanding({
                seo: {
                  title: values.seo_title,
                  description: values.seo_description,
                  keywords: values.seo_keywords,
                  og_image: values.seo_og_image,
                },
              });
            } else {
              await authorApi.patchSiteLanding({
                hero: {
                  eyebrow: values.eyebrow,
                  title_lines: [values.title_line1, values.title_line2].filter(Boolean),
                  title_em: values.title_em,
                  cta_primary: values.cta_primary,
                  cta_secondary: values.cta_secondary,
                  empty_title: values.empty_title,
                  bg_image: values.bg_image,
                  proof: [
                    { value: values.proof0_value, label: values.proof0_label },
                    { value: values.proof1_value, label: values.proof1_label },
                    { value: values.proof2_value, label: values.proof2_label },
                  ],
                },
              });
            }
            message.success("已保存，官网将同步展示");
            setMode({ kind: "closed" });
            setEditKind(null);
            await load();
          } catch (err) {
            message.error(err instanceof ApiError ? err.message : "保存失败");
            throw err;
          } finally {
            setSubmitting(false);
          }
        }}
      >
        {editKind === "seo" ? (
          <>
            <Form.Item
              name="seo_title"
              label="页面标题"
              rules={[{ required: true, message: "请填写页面标题" }]}
              extra="建议固定为「青山在 · FDE Learning OS」，勿只填「青山在」或「FDE Learning OS」，否则页签会闪烁"
            >
              <Input placeholder="青山在 · FDE Learning OS" />
            </Form.Item>
            <Form.Item name="seo_description" label="描述" rules={[{ required: true, message: "请填写描述" }]}>
              <Input.TextArea rows={3} maxLength={180} showCount placeholder="搜索引擎与社交分享摘要（建议 80–160 字）" />
            </Form.Item>
            <Form.Item name="seo_keywords" label="关键词">
              <Input placeholder="逗号分隔" />
            </Form.Item>
            <Form.Item name="seo_og_image" label="分享图 URL" extra="可用 /landing/hero.png 或已上传海报地址">
              <Input />
            </Form.Item>
          </>
        ) : (
          <>
            <Form.Item name="eyebrow" label="Eyebrow" rules={[{ required: true }]}>
              <Input placeholder="FDE LEARNING OS" />
            </Form.Item>
            <Form.Item name="title_line1" label="主标题 · 第 1 行" rules={[{ required: true }]}>
              <Input placeholder="让每一次学习" />
            </Form.Item>
            <Form.Item name="title_line2" label="主标题 · 第 2 行">
              <Input placeholder="都留下可验证的证据" />
            </Form.Item>
            <Form.Item name="title_em" label="强调词" extra="出现在主标题中的词会以斜体强调">
              <Input placeholder="可验证" />
            </Form.Item>
            <Form.Item name="cta_primary" label="主按钮文案">
              <Input />
            </Form.Item>
            <Form.Item name="cta_secondary" label="次按钮文案">
              <Input />
            </Form.Item>
            <Typography.Text strong style={{ display: "block", marginBottom: 8 }}>
              数据背书（首屏底部三条）
            </Typography.Text>
            <Space direction="vertical" style={{ width: "100%" }} size={8}>
              {[0, 1, 2].map((i) => (
                <Space key={i} style={{ width: "100%" }} align="start">
                  <Form.Item name={`proof${i}_value`} label={i === 0 ? "数值" : undefined} style={{ marginBottom: 0, width: 120 }}>
                    <Input placeholder="21" />
                  </Form.Item>
                  <Form.Item name={`proof${i}_label`} label={i === 0 ? "说明" : undefined} style={{ marginBottom: 0, flex: 1 }}>
                    <Input placeholder="天任务驱动训练" />
                  </Form.Item>
                </Space>
              ))}
            </Space>
            <Form.Item
              name="bg_image"
              label="静态底图路径"
              style={{ marginTop: 16 }}
              extra="未上传海报时使用；默认 /landing/hero.png"
            >
              <Input />
            </Form.Item>
            <Form.Item name="empty_title" label="空态文案" extra="无媒资时的占位说明（可选）">
              <Input />
            </Form.Item>
          </>
        )}
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
          选择文件后立即上传。海报会作为官网首屏背景；视频可后续扩展为宣传片播放。
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
