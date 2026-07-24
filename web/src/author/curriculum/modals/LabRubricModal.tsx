import { useEffect, useState } from "react";
import { Form, Input, InputNumber, Modal, Select } from "antd";
import type { AuthorRubricCheck } from "../dayPackage";
import { authorSelectPopup, useAuthorLayout } from "../../../lib/authorLayoutContext";

export type LabRubricModalValues = AuthorRubricCheck;

type ArgField = { key: string; label: string; type: "text" | "number" | "list" };

/** Mirrors services/shared/rubric_registry.py args_schema — keep in sync. */
const CHECK_OPTIONS: { value: string; label: string; args: ArgField[] }[] = [
  { value: "file_exists", label: "file_exists · 文件存在", args: [{ key: "path", label: "文件相对路径", type: "text" }] },
  {
    value: "text_contains",
    label: "text_contains · 文本包含指定内容",
    args: [
      { key: "path", label: "文件相对路径", type: "text" },
      { key: "needle", label: "需包含的文本片段", type: "text" },
    ],
  },
  {
    value: "file_contains",
    label: "file_contains · 文件包含指定内容",
    args: [
      { key: "path", label: "文件相对路径", type: "text" },
      { key: "needle", label: "需包含的文本片段", type: "text" },
    ],
  },
  { value: "dom_contains", label: "dom_contains · 页面 DOM 包含指定元素", args: [{ key: "selector", label: "CSS 选择器", type: "text" }] },
  { value: "port_listening", label: "port_listening · 端口正在监听", args: [{ key: "port", label: "端口号", type: "number" }] },
  {
    value: "command_sequence",
    label: "command_sequence · 命令序列执行成功",
    args: [{ key: "contains", label: "需依次出现的命令/关键字（每行一个）", type: "list" }],
  },
  { value: "constraints_satisfied", label: "constraints_satisfied · 约束条件已满足", args: [] },
  {
    value: "decision_note_min_chars",
    label: "decision_note_min_chars · 决策说明字数达标",
    args: [{ key: "min", label: "最少字数", type: "number" }],
  },
  {
    value: "required_components",
    label: "required_components · 必需组件已添加",
    args: [{ key: "includes", label: "必需组件 id（每行一个）", type: "list" }],
  },
  {
    value: "resource_exists",
    label: "resource_exists · 资源已存在",
    args: [
      { key: "kind", label: "资源类型", type: "text" },
      { key: "name", label: "资源名称", type: "text" },
    ],
  },
  {
    value: "resource_ready",
    label: "resource_ready · 资源已就绪",
    args: [
      { key: "kind", label: "资源类型", type: "text" },
      { key: "name", label: "资源名称", type: "text" },
    ],
  },
];

function argsToFieldValues(check: string, args: Record<string, unknown> | undefined): Record<string, unknown> {
  const schema = CHECK_OPTIONS.find((c) => c.value === check)?.args;
  if (!schema) return { args_json: JSON.stringify(args || {}, null, 2) };
  const out: Record<string, unknown> = {};
  for (const f of schema) {
    const v = (args || {})[f.key];
    out[`arg__${f.key}`] = f.type === "list" && Array.isArray(v) ? v.join("\n") : v;
  }
  return out;
}

function fieldValuesToArgs(check: string, values: Record<string, unknown>): Record<string, unknown> {
  const schema = CHECK_OPTIONS.find((c) => c.value === check)?.args;
  if (!schema) {
    try {
      return JSON.parse(String(values.args_json || "{}"));
    } catch {
      return {};
    }
  }
  const out: Record<string, unknown> = {};
  for (const f of schema) {
    const raw = values[`arg__${f.key}`];
    if (raw == null || raw === "") continue;
    if (f.type === "number") out[f.key] = Number(raw);
    else if (f.type === "list") {
      out[f.key] = String(raw)
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
    } else out[f.key] = raw;
  }
  return out;
}

export function LabRubricModal({
  open,
  initialValues,
  onCancel,
  onSubmit,
  submitting,
}: {
  open: boolean;
  initialValues?: Partial<LabRubricModalValues>;
  onCancel: () => void;
  onSubmit: (values: LabRubricModalValues) => void | Promise<void>;
  submitting?: boolean;
}) {
  const { getContentPopupContainer } = useAuthorLayout();
  const selectPopup = authorSelectPopup(getContentPopupContainer);
  const [form] = Form.useForm();
  const [check, setCheck] = useState<string>(initialValues?.check || "file_exists");
  const known = CHECK_OPTIONS.find((c) => c.value === check);

  useEffect(() => {
    if (!open) return;
    const initCheck = initialValues?.check || "file_exists";
    setCheck(initCheck);
    form.setFieldsValue({
      check: initCheck,
      title_zh: initialValues?.title_zh,
      description_zh: initialValues?.description_zh,
      hint: initialValues?.hint,
      ...argsToFieldValues(initCheck, initialValues?.args),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <Modal
      title={initialValues?.check ? "编辑检查项" : "新增检查项"}
      open={open}
      onCancel={onCancel}
      destroyOnClose
      confirmLoading={submitting}
      okText="保存"
      cancelText="取消"
      width={560}
      onOk={() => {
        void form.validateFields().then((values) => {
          const args = fieldValuesToArgs(values.check, values);
          onSubmit({
            check: values.check,
            args,
            title_zh: values.title_zh || undefined,
            description_zh: values.description_zh || undefined,
            hint: values.hint || undefined,
          });
        });
      }}
    >
      <Form form={form} layout="vertical" preserve={false}>
        <Form.Item name="check" label="检查类型" rules={[{ required: true }]}>
          <Select
            options={CHECK_OPTIONS.map((c) => ({ value: c.value, label: c.label }))}
            getPopupContainer={selectPopup}
            onChange={(v) => {
              setCheck(v);
              // reset arg fields when switching check type
              const reset: Record<string, unknown> = { args_json: "{}" };
              for (const c of CHECK_OPTIONS) {
                for (const f of c.args) reset[`arg__${f.key}`] = undefined;
              }
              form.setFieldsValue(reset);
            }}
          />
        </Form.Item>
        {known ? (
          known.args.length ? (
            known.args.map((f) => (
              <Form.Item key={f.key} name={`arg__${f.key}`} label={f.label}>
                {f.type === "number" ? (
                  <InputNumber style={{ width: "100%" }} />
                ) : f.type === "list" ? (
                  <Input.TextArea rows={3} />
                ) : (
                  <Input />
                )}
              </Form.Item>
            ))
          ) : null
        ) : (
          <Form.Item name="args_json" label="args（JSON，未识别的检查类型）">
            <Input.TextArea rows={4} className="mono" />
          </Form.Item>
        )}
        <Form.Item name="title_zh" label="中文标题（可选）">
          <Input placeholder="留空则使用系统默认" />
        </Form.Item>
        <Form.Item name="description_zh" label="中文说明（可选）">
          <Input.TextArea rows={2} />
        </Form.Item>
        <Form.Item name="hint" label="失败提示（可选）">
          <Input.TextArea rows={2} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
