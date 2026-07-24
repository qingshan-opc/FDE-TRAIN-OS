import { Form, Input, Modal, Select } from "antd";
import type { AuthorNodeType } from "../dayPackage";
import { NODE_TYPE_OPTIONS } from "../nodeTypes";
import { authorSelectPopup, useAuthorLayout } from "../../../lib/authorLayoutContext";

export interface NodeModalValues {
  type: AuthorNodeType;
  title: string;
}

export function NodeModal({
  open,
  initial,
  existingTypes,
  onCancel,
  onSubmit,
  submitting,
}: {
  open: boolean;
  initial?: NodeModalValues;
  existingTypes: string[];
  onCancel: () => void;
  onSubmit: (values: NodeModalValues) => void | Promise<void>;
  submitting?: boolean;
}) {
  const [form] = Form.useForm<NodeModalValues>();
  const { getContentPopupContainer } = useAuthorLayout();
  const selectPopup = authorSelectPopup(getContentPopupContainer);
  const isEdit = !!initial;

  return (
    <Modal
      title={isEdit ? "编辑学习流程节点" : "添加学习流程节点"}
      open={open}
      onCancel={onCancel}
      destroyOnClose
      confirmLoading={submitting}
      okText="保存"
      cancelText="取消"
      onOk={() => {
        void form.validateFields().then((values) => onSubmit(values));
      }}
    >
      <Form form={form} layout="vertical" initialValues={initial || { type: "learn", title: "" }} preserve={false}>
        <Form.Item
          name="type"
          label="节点类型"
          rules={[
            { required: true, message: "请选择节点类型" },
            {
              validator: (_, value) => {
                if (value && existingTypes.includes(value)) {
                  return Promise.reject(new Error("该类型已存在，每种类型只能使用一次"));
                }
                return Promise.resolve();
              },
            },
          ]}
        >
          <Select options={NODE_TYPE_OPTIONS} placeholder="选择节点类型" getPopupContainer={selectPopup} />
        </Form.Item>
        <Form.Item name="title" label="节点标题" rules={[{ required: true, message: "请输入节点标题" }]}>
          <Input placeholder="例如：学习" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
