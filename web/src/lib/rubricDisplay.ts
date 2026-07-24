/**
 * Chinese display metadata for Rubric/EvalBridge check ids.
 * Keys must match the `check` field returned by the eval engines
 * (services/agent_gateway, sim/adapters/*).
 */
export interface RubricDisplayEntry {
  title: string;
  formatArgs?: (args?: Record<string, unknown>) => string;
}

function str(v: unknown): string {
  return v == null ? "" : String(v);
}

function list(v: unknown): string {
  return Array.isArray(v) ? v.map(str).join("、") : str(v);
}

export const RUBRIC_DISPLAY: Record<string, RubricDisplayEntry> = {
  file_exists: {
    title: "文件存在",
    formatArgs: (args) => (args?.path ? `文件：${str(args.path)}` : ""),
  },
  text_contains: {
    title: "文本包含指定内容",
    formatArgs: (args) => {
      const parts: string[] = [];
      if (args?.path) parts.push(`文件：${str(args.path)}`);
      if (args?.needle) parts.push(`需含：“${str(args.needle)}”`);
      return parts.join(" · ");
    },
  },
  file_contains: {
    title: "文件包含指定内容",
    formatArgs: (args) => {
      const parts: string[] = [];
      if (args?.path) parts.push(`文件：${str(args.path)}`);
      if (args?.needle) parts.push(`需含：“${str(args.needle)}”`);
      return parts.join(" · ");
    },
  },
  dom_contains: {
    title: "页面 DOM 包含指定元素",
    formatArgs: (args) => (args?.selector ? `选择器：${str(args.selector)}` : ""),
  },
  port_listening: {
    title: "端口正在监听",
    formatArgs: (args) => (args?.port != null ? `端口：${str(args.port)}` : ""),
  },
  command_sequence: {
    title: "命令序列执行成功",
    formatArgs: (args) => (args?.contains ? `需包含：${list(args.contains)}` : ""),
  },
  constraints_satisfied: {
    title: "约束条件已满足",
  },
  decision_note_min_chars: {
    title: "决策说明字数达标",
    formatArgs: (args) => (args?.min != null ? `最少 ${str(args.min)} 字` : ""),
  },
  required_components: {
    title: "必需组件已添加",
    formatArgs: (args) => (args?.includes ? `组件：${list(args.includes)}` : ""),
  },
  resource_exists: {
    title: "资源已存在",
    formatArgs: (args) => {
      const parts: string[] = [];
      if (args?.kind) parts.push(str(args.kind));
      if (args?.name) parts.push(str(args.name));
      return parts.join(" · ");
    },
  },
  resource_ready: {
    title: "资源已就绪",
    formatArgs: (args) => {
      const parts: string[] = [];
      if (args?.kind) parts.push(str(args.kind));
      if (args?.name) parts.push(str(args.name));
      return parts.join(" · ");
    },
  },
};

export function rubricTitle(check: string): string {
  return RUBRIC_DISPLAY[check]?.title || check;
}

export function rubricArgsText(check: string, args?: Record<string, unknown>): string {
  const entry = RUBRIC_DISPLAY[check];
  if (!entry?.formatArgs) return "";
  try {
    return entry.formatArgs(args) || "";
  } catch {
    return "";
  }
}
