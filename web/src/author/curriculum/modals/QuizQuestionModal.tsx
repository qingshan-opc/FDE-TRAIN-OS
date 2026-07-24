import { Button, Form, Input, InputNumber, Modal, Space } from "antd";
import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import type { AuthorQuizQuestion } from "../dayPackage";

export type QuizQuestionModalValues = AuthorQuizQuestion;

export function QuizQuestionModal({
  open,
  initialValues,
  onCancel,
  onSubmit,
  submitting,
}: {
  open: boolean;
  initialValues?: Partial<QuizQuestionModalValues>;
  onCancel: () => void;
  onSubmit: (values: QuizQuestionModalValues) => void | Promise<void>;
  submitting?: boolean;
}) {
  const [form] = Form.useForm<QuizQuestionModalValues>();

  return (
    <Modal
      title={initialValues?.q ? "编辑测验题" : "新增测验题"}
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
      <Form
        form={form}
        layout="vertical"
        preserve={false}
        initialValues={
          initialValues || { q: "", options: ["选项 A", "选项 B"], answer: 0, explain: "" }
        }
      >
        <Form.Item name="q" label="题干" rules={[{ required: true, message: "请输入题干" }]}>
          <Input.TextArea rows={2} />
        </Form.Item>
        <Form.List
          name="options"
          rules={[
            {
              validator: async (_, options) => {
                if (!options || options.length < 2) {
                  return Promise.reject(new Error("至少需要 2 个选项"));
                }
              },
            },
          ]}
        >
          {(fields, { add, remove }, { errors }) => (
            <Form.Item label="选项" required>
              <Space direction="vertical" style={{ width: "100%" }}>
                {fields.map((field, idx) => (
                  <Space key={field.key} style={{ width: "100%" }}>
                    <Form.Item
                      {...field}
                      noStyle
                      rules={[{ required: true, message: "选项不可为空" }]}
                    >
                      <Input placeholder={`选项 ${idx + 1}`} style={{ width: 420 }} />
                    </Form.Item>
                    <Button
                      danger
                      type="text"
                      icon={<DeleteOutlined />}
                      disabled={fields.length <= 2}
                      onClick={() => remove(field.name)}
                    />
                  </Space>
                ))}
                <Button icon={<PlusOutlined />} onClick={() => add("")}>
                  添加选项
                </Button>
                <Form.ErrorList errors={errors} />
              </Space>
            </Form.Item>
          )}
        </Form.List>
        <Form.Item name="answer" label="正确答案（从 0 起的选项序号）" rules={[{ required: true, message: "请填写正确答案序号" }]}>
          <InputNumber min={0} style={{ width: "100%" }} />
        </Form.Item>
        <Form.Item name="explain" label="解析">
          <Input.TextArea rows={3} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
