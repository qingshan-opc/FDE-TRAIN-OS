import { Tag } from "antd";
import { statusColor, statusLabel, type StatusDomain } from "../lib/statusLabels";

/** 统一业务状态 Tag：英文枚举 → 中文文案 + 颜色 */
export function StatusTag({
  status,
  fallback = "—",
  domain,
}: {
  status: string | null | undefined;
  fallback?: string;
  domain?: StatusDomain;
}) {
  if (status == null || status === "") {
    return <Tag>{fallback}</Tag>;
  }
  const color = statusColor(status);
  return <Tag color={color}>{statusLabel(status, fallback, domain)}</Tag>;
}
