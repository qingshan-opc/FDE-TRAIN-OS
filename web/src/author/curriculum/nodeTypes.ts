import type { AuthorNodeType } from "./dayPackage";

export const NODE_TYPE_OPTIONS: { value: AuthorNodeType; label: string }[] = [
  { value: "learn", label: "学习" },
  { value: "quiz", label: "小测" },
  { value: "lab", label: "实训" },
  { value: "project", label: "企业任务" },
  { value: "review", label: "自检" },
];

export function nodeTypeLabel(type: string): string {
  return NODE_TYPE_OPTIONS.find((o) => o.value === type)?.label || type;
}
