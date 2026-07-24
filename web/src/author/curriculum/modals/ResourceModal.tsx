import { useState } from "react";
import { App, Button, Empty, Form, Input, List, Modal, Select, Tabs } from "antd";
import { authorApi, ApiError } from "../../../lib/api";
import { authorSelectPopup, useAuthorLayout } from "../../../lib/authorLayoutContext";

export interface ResourceModalValues {
  id?: string;
  title?: string;
  kind?: string;
  summary?: string;
  url?: string;
  object_key?: string;
}

const KIND_OPTIONS = ["guide", "doc", "video", "link", "pdf"].map((v) => ({ value: v, label: v }));

export function ResourceModal({
  open,
  initialValues,
  onCancel,
  onSubmit,
  submitting,
  campId,
}: {
  open: boolean;
  initialValues?: ResourceModalValues;
  onCancel: () => void;
  onSubmit: (values: ResourceModalValues) => void | Promise<void>;
  submitting?: boolean;
  campId?: string;
}) {
  const { message } = App.useApp();
  const { getContentPopupContainer } = useAuthorLayout();
  const selectPopup = authorSelectPopup(getContentPopupContainer);
  const [form] = Form.useForm<ResourceModalValues>();
  const [activeTab, setActiveTab] = useState<"manual" | "docs" | "media">("manual");
  const [docQ, setDocQ] = useState("");
  const [docItems, setDocItems] = useState<{ id: string; filename: string }[]>([]);
  const [docLoading, setDocLoading] = useState(false);
  const [mediaQ, setMediaQ] = useState("");
  const [mediaItems, setMediaItems] = useState<{ id: string; title: string; object_key: string }[]>([]);
  const [mediaLoading, setMediaLoading] = useState(false);

  const searchDocs = async (value: string) => {
    setDocQ(value);
    setDocLoading(true);
    try {
      const res = await authorApi.listDocuments({ camp_id: campId, q: value || undefined, page: 1, page_size: 8 });
      setDocItems(res.items || []);
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : "搜索文档失败");
    } finally {
      setDocLoading(false);
    }
  };

  const searchMedia = async (value: string) => {
    setMediaQ(value);
    setMediaLoading(true);
    try {
      const res = await authorApi.listMediaAssets({ camp_id: campId, q: value || undefined, page: 1, page_size: 8 });
      setMediaItems(res.items || []);
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : "搜索媒资失败");
    } finally {
      setMediaLoading(false);
    }
  };

  return (
    <Modal
      title={initialValues?.id ? `编辑资源 · ${initialValues.id}` : "新增资源"}
      open={open}
      onCancel={onCancel}
      destroyOnClose
      confirmLoading={submitting}
      okText="保存"
      cancelText="取消"
      width={640}
      onOk={() => {
        void form.validateFields().then((values) => onSubmit(values));
      }}
    >
      <Tabs
        activeKey={activeTab}
        onChange={(k) => setActiveTab(k as "manual" | "docs" | "media")}
        items={[
          {
            key: "manual",
            label: "手动填写",
            children: (
              <Form form={form} layout="vertical" initialValues={initialValues} preserve={false}>
                <Form.Item name="id" label="资源 id" rules={[{ required: true, message: "请输入资源 id" }]}>
                  <Input placeholder="例如：agent-lab-guide" />
                </Form.Item>
                <Form.Item name="title" label="标题" rules={[{ required: true, message: "请输入标题" }]}>
                  <Input />
                </Form.Item>
                <Form.Item name="kind" label="类型">
                  <Select options={KIND_OPTIONS} allowClear showSearch placeholder="guide / doc / video / link" getPopupContainer={selectPopup} />
                </Form.Item>
                <Form.Item name="summary" label="摘要">
                  <Input.TextArea rows={3} />
                </Form.Item>
                <Form.Item name="url" label="外部链接（url，可选）">
                  <Input placeholder="https://..." />
                </Form.Item>
                <Form.Item name="object_key" label="对象存储 key（object_key，可选）">
                  <Input className="mono" placeholder="documents/..." />
                </Form.Item>
              </Form>
            ),
          },
          {
            key: "docs",
            label: "从文档库选择",
            children: (
              <>
                <Input.Search
                  allowClear
                  placeholder="搜索文档名"
                  value={docQ}
                  onChange={(e) => setDocQ(e.target.value)}
                  onSearch={searchDocs}
                  style={{ marginBottom: 12, maxWidth: 320 }}
                />
                <List
                  size="small"
                  loading={docLoading}
                  locale={{ emptyText: <Empty description="暂无匹配文档" /> }}
                  dataSource={docItems}
                  renderItem={(item) => (
                    <List.Item
                      actions={[
                        <Button
                          key="pick"
                          size="small"
                          type="link"
                          onClick={() => {
                            form.setFieldsValue({
                              id: form.getFieldValue("id") || item.id,
                              title: item.filename,
                              kind: "doc",
                            });
                            setActiveTab("manual");
                            message.success(`已引用文档：${item.filename}`);
                          }}
                        >
                          选择
                        </Button>,
                      ]}
                    >
                      {item.filename}
                    </List.Item>
                  )}
                />
              </>
            ),
          },
          {
            key: "media",
            label: "从视频库选择",
            children: (
              <>
                <Input.Search
                  allowClear
                  placeholder="搜索视频标题"
                  value={mediaQ}
                  onChange={(e) => setMediaQ(e.target.value)}
                  onSearch={searchMedia}
                  style={{ marginBottom: 12, maxWidth: 320 }}
                />
                <List
                  size="small"
                  loading={mediaLoading}
                  locale={{ emptyText: <Empty description="暂无匹配视频" /> }}
                  dataSource={mediaItems}
                  renderItem={(item) => (
                    <List.Item
                      actions={[
                        <Button
                          key="pick"
                          size="small"
                          type="link"
                          onClick={() => {
                            form.setFieldsValue({
                              id: form.getFieldValue("id") || item.id,
                              title: item.title,
                              kind: "video",
                              object_key: item.object_key,
                            });
                            setActiveTab("manual");
                            message.success(`已引用视频：${item.title}`);
                          }}
                        >
                          选择
                        </Button>,
                      ]}
                    >
                      {item.title}
                    </List.Item>
                  )}
                />
              </>
            ),
          },
        ]}
      />
    </Modal>
  );
}
