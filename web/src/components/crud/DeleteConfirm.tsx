import { App } from "antd";

export function useDeleteConfirm() {
  const { modal } = App.useApp();

  return (opts: {
    name: string;
    impact?: string;
    onOk: () => Promise<void> | void;
  }) => {
    modal.confirm({
      title: `确认删除「${opts.name}」？`,
      content: opts.impact || "此操作不可恢复。",
      okText: "删除",
      okType: "danger",
      cancelText: "取消",
      onOk: () => opts.onOk(),
    });
  };
}
