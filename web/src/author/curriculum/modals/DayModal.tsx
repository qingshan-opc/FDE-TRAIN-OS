import { Form, Input, InputNumber, Modal, Select } from "antd";

export interface DayModalValues {
  day?: number;
  week?: number;
  title?: string;
  clone_from_day?: number;
}

export function DayModal({
  open,
  initialValues,
  onCancel,
  onSubmit,
  submitting,
}: {
  open: boolean;
  initialValues?: DayModalValues;
  onCancel: () => void;
  onSubmit: (values: DayModalValues) => void | Promise<void>;
  submitting?: boolean;
}) {
  const [form] = Form.useForm<DayModalValues>();

  return (
    <Modal
      title={initialValues?.day ? `编辑第 ${initialValues.day} 课` : "新建课次"}
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
      <Form form={form} layout="vertical" initialValues={initialValues} preserve={false}>
        <Form.Item name="day" label="课次编号">
          <InputNumber min={1} style={{ width: "100%" }} placeholder="留空自动分配" disabled={!!initialValues?.day && !initialValues?.clone_from_day && !!initialValues?.title} />
        </Form.Item>
        <Form.Item name="title" label="课次标题" rules={[{ required: true, message: "请输入课次标题" }]}>
          <Input placeholder="例如：FDE 角色认知与武器分发" />
        </Form.Item>
        <Form.Item name="week" label="所属周">
          <Select
            options={[
              { value: 1, label: "第 1 周" },
              { value: 2, label: "第 2 周" },
            ]}
            placeholder="选择所属周"
            getPopupContainer={(n) => n.parentElement || document.body}
          />
        </Form.Item>
        {!initialValues?.day && (
          <Form.Item name="clone_from_day" label="从已有课次克隆（可选）">
            <InputNumber min={1} style={{ width: "100%" }} placeholder="填写要克隆的课次编号" />
          </Form.Item>
        )}
      </Form>
    </Modal>
  );
}
