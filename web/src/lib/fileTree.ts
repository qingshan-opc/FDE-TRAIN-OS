import type { WorkspaceFile } from "./types";
import { fileIcon } from "./fileTypes";

export type TreeNode = {
  id: string;
  name: string;
  path: string;
  kind: "file" | "dir";
  bucket?: WorkspaceFile["bucket"];
  size?: number;
  icon?: string;
  children?: TreeNode[];
};

function ensureDir(map: Map<string, TreeNode>, path: string, name: string): TreeNode {
  let node = map.get(path);
  if (!node) {
    node = { id: `dir:${path}`, name, path, kind: "dir", children: [] };
    map.set(path, node);
  }
  return node;
}

/** Build a nested directory tree from flat workspace file paths. */
export function buildFileTree(files: WorkspaceFile[]): TreeNode[] {
  const dirMap = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];
  const root = ensureDir(dirMap, "", "");

  for (const f of files) {
    const parts = f.path.split("/").filter(Boolean);
    if (!parts.length) continue;
    let parent = root;
    let acc = "";
    for (let i = 0; i < parts.length - 1; i++) {
      acc = acc ? `${acc}/${parts[i]}` : parts[i];
      const dir = ensureDir(dirMap, acc, parts[i]);
      if (!parent.children!.some((c) => c.path === dir.path)) {
        parent.children!.push(dir);
      }
      parent = dir;
    }
    const name = parts[parts.length - 1];
    const fileNode: TreeNode = {
      id: `file:${f.path}`,
      name,
      path: f.path,
      kind: "file",
      bucket: f.bucket,
      size: f.size,
      icon: fileIcon(f.path),
    };
    parent.children!.push(fileNode);
  }

  const sortNodes = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === "dir" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    for (const n of nodes) {
      if (n.children) sortNodes(n.children);
    }
  };

  sortNodes(root.children || []);
  return root.children || roots;
}

export function flattenVisible(nodes: TreeNode[], expanded: Set<string>): TreeNode[] {
  const out: TreeNode[] = [];
  const walk = (list: TreeNode[], depth: number) => {
    for (const n of list) {
      out.push({ ...n, children: undefined });
      (n as TreeNode & { depth?: number }).depth = depth;
      if (n.kind === "dir" && expanded.has(n.path) && n.children?.length) {
        walk(n.children, depth + 1);
      }
    }
  };
  walk(nodes, 0);
  return out;
}

export type FlatTreeRow = TreeNode & { depth: number };

export function flattenTreeRows(nodes: TreeNode[], expanded: Set<string>, depth = 0): FlatTreeRow[] {
  const out: FlatTreeRow[] = [];
  for (const n of nodes) {
    out.push({ ...n, depth, children: n.children });
    if (n.kind === "dir" && expanded.has(n.path) && n.children?.length) {
      out.push(...flattenTreeRows(n.children, expanded, depth + 1));
    }
  }
  return out;
}
