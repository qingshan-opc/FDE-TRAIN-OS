import type { CSSProperties } from "react";
import type { NodeStatus } from "../lib/types";

const STATUS_LABEL: Record<string, string> = {
  passed: "✓",
  locked: "🔒",
  available: "可做",
  in_progress: "进行中",
  failed: "未过",
};

const STATUS_ARIA: Record<string, string> = {
  passed: "已完成",
  locked: "未解锁",
  available: "可开始",
  in_progress: "进行中",
  failed: "未通过",
};

export function StatusPill({
  status,
  className = "",
  style,
}: {
  status: NodeStatus | string;
  className?: string;
  style?: CSSProperties;
}) {
  const label = STATUS_LABEL[status] ?? status;
  const aria = STATUS_ARIA[status] ?? status;
  return (
    <span
      className={`status-pill ${status} ${className}`.trim()}
      style={style}
      aria-label={aria}
      title={aria}
    >
      {label}
    </span>
  );
}
