import { useEffect } from "react";
import { Modal, Form } from "antd";
import type { FormInstance } from "antd";
import type { ReactNode } from "react";

export type EntityModalMode =
  | { kind: "closed" }
  | { kind: "create" }
  | { kind: "edit"; id: string }
  | { kind: "view"; id: string };

export function EntityModal<TForm extends object>({
  mode,
  title,
  form,
  loading,
  submitting,
  onClose,
  onSubmit,
  children,
  width = 560,
  initialValues,
}: {
  mode: EntityModalMode;
  title: { create: string; edit: string; view: string };
  form: FormInstance<TForm>;
  loading?: boolean;
  submitting?: boolean;
  onClose: () => void;
  onSubmit: (values: TForm) => Promise<void>;
  children: ReactNode;
  width?: number | string;
  /** 打开编辑/查看时回填；与 Form key 配合，避免 destroyOnClose 丢值 */
  initialValues?: Partial<TForm> | null;
}) {
  const open = mode.kind !== "closed";
  const readonly = mode.kind === "view";
  const heading =
    mode.kind === "create" ? title.create : mode.kind === "edit" ? title.edit : mode.kind === "view" ? title.view : "";
  const formKey =
    mode.kind === "closed"
      ? "closed"
      : mode.kind === "create"
        ? "create"
        : `${mode.kind}-${mode.id}`;

  useEffect(() => {
    if (!open) return;
    if (mode.kind === "create") {
      form.resetFields();
      return;
    }
    if (initialValues) {
      const t = window.setTimeout(() => {
        form.setFieldsValue(initialValues as TForm);
      }, 0);
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, [open, formKey, form, initialValues, mode.kind]);

  return (
    <Modal
      title={heading}
      open={open}
      onCancel={onClose}
      destroyOnClose
      confirmLoading={submitting}
      okButtonProps={{ style: readonly ? { display: "none" } : undefined, disabled: loading || submitting }}
      cancelText={readonly ? "关闭" : "取消"}
      okText="保存"
      onOk={() => {
        if (readonly) {
          onClose();
          return;
        }
        void form
          .validateFields()
          .then(async (values) => {
            await onSubmit(values as TForm);
          })
          .catch(() => undefined);
      }}
      width={typeof width === "number" ? Math.min(width, typeof window !== "undefined" ? window.innerWidth - 32 : width) : width}
      styles={{ body: { maxHeight: "70vh", overflow: "auto" } }}
      style={{ top: 24, maxWidth: 720, paddingBottom: 0 }}
    >
      <Form
        key={formKey}
        form={form}
        layout="vertical"
        disabled={readonly || loading}
        preserve={false}
        initialValues={(initialValues || undefined) as TForm | undefined}
      >
        {children}
      </Form>
    </Modal>
  );
}
