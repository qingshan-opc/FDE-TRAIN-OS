import { describe, expect, it } from "vitest";
import { buildFileTree, type TreeNode } from "./fileTree";
import { languageOf, previewKindOf, isBinaryPath } from "./fileTypes";
import type { WorkspaceFile } from "./types";

describe("fileTypes", () => {
  it("maps languages and previews", () => {
    expect(languageOf("a/index.html")).toBe("html");
    expect(previewKindOf("README.md")).toBe("markdown");
    expect(languageOf("deploy.yaml")).toBe("yaml");
    expect(languageOf("schema.sql")).toBe("sql");
    expect(isBinaryPath("logo.png")).toBe(true);
    expect(previewKindOf("logo.png")).toBe("image");
  });
});

describe("fileTree", () => {
  it("builds nested directories", () => {
    const files: WorkspaceFile[] = [
      { path: "index.html", size: 1 },
      { path: "src/app.js", size: 1 },
      { path: "src/styles.css", size: 1 },
      { path: "README.md", size: 1 },
    ];
    const tree = buildFileTree(files);
    const names = tree.map((n: TreeNode) => n.name);
    expect(names).toContain("index.html");
    expect(names).toContain("src");
    const src = tree.find((n: TreeNode) => n.name === "src");
    expect(src?.kind).toBe("dir");
    expect(src?.children?.map((c: TreeNode) => c.name).sort()).toEqual(["app.js", "styles.css"]);
  });
});
