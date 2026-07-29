import { useEffect, useRef } from "react";
import { Modal } from "antd";

/** 页面级错误用弹窗展示，避免挤占列表布局 */
export function useErrorModal(
  error: string | null | undefined,
  options?: {
    title?: string;
    onRetry?: () => void;
  },
) {
  const onRetryRef = useRef(options?.onRetry);
  onRetryRef.current = options?.onRetry;
  const title = options?.title || "操作失败";

  useEffect(() => {
    if (!error) return;
    const canRetry = Boolean(onRetryRef.current);
    const modal = Modal.error({
      title,
      content: error,
      okText: canRetry ? "重试" : "知道了",
      closable: true,
      maskClosable: true,
      centered: true,
      onOk: () => {
        onRetryRef.current?.();
      },
    });
    return () => {
      modal.destroy();
    };
  }, [error, title]);
}
