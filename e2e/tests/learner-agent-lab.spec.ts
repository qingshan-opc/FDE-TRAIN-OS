import { test, expect } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";
import { loginAsLearner } from "../fixtures/auth";

const artifacts = path.join(__dirname, "..", "artifacts");

// NOTE: this spec uses the shared demo learner because Day1's lab node is
// gated behind learn+quiz completion. The demo workspace accumulates files
// across runs, and every workspace mutation snapshots the whole tree to
// MinIO synchronously — so CRUD toast waits below are generous (300s).
// If the demo workspace is ever reset, these can go back to 120s.
test.beforeAll(() => {
  fs.mkdirSync(artifacts, { recursive: true });
});

test("learner Agent Lab stub run on Day1", async ({ page }) => {
  test.setTimeout(900_000);
  await loginAsLearner(page);

  // Prefer deep-link into the Lab node — day row toggles expand/collapse and
  // may not change the URL when Day1 is already open in the syllabus.
  await page.goto("/app/day/1?node=d1-lab");
  await expect(page).toHaveURL(/\/app\/day\/1\?node=/);

  // Assert on something unique to the Lab workbench (the "生成" toolbar button).
  const genBtn = page.getByRole("button", { name: "生成", exact: true });
  try {
    await expect(genBtn).toBeVisible({ timeout: 8_000 });
  } catch {
    await page.getByRole("button", { name: /Agent 生成库存列表页/ }).click();
    await expect(genBtn).toBeVisible({ timeout: 15_000 });
  }

  await page.getByRole("button", { name: /^高级/ }).click();
  // LearnerHome polls the whole day/workspace bundle on a short interval, so
  // this checkbox's subtree can flicker (briefly detach/reattach) between
  // polls — bypass the actionability "stable" wait, which otherwise never
  // resolves against a target that keeps re-rendering every second, and
  // confirm the resulting state directly.
  await page.locator("#force-stub").check({ force: true });
  await expect(page.locator("#force-stub")).toBeChecked();
  const hasWorkspace = (await page.getByRole("treeitem").filter({ hasText: /index\.html/ }).count()) > 0;
  if (!hasWorkspace) {
    await genBtn.click();
  }
  await expect(page.getByRole("treeitem").filter({ hasText: /index\.html/ }).first()).toBeVisible({
    timeout: 300_000,
  });

  // Nested/file tree (not a flat Markdown dump): index.html + README.md visible.
  const tree = page.locator(".ide-file-tree, .file-tree").first();
  await expect(tree).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("treeitem").filter({ hasText: /index\.html/ }).first()).toBeVisible();
  await expect(page.getByRole("treeitem").filter({ hasText: /README\.md/ }).first()).toBeVisible();

  // Markdown must open as rich preview, not broken HTML iframe.
  await page.getByRole("treeitem").filter({ hasText: /README\.md/ }).first().click();
  await expect(page.getByText(/预览 · markdown/i)).toBeVisible({ timeout: 15_000 });
  await expect(page.locator(".ide-md-preview, .markdown-body, .ide-preview-body").first()).toBeVisible();

  // HTML preview: open index.html, wait for workspace fetch, then run preview.
  await page.getByRole("treeitem").filter({ hasText: /index\.html/ }).first().click();
  await expect(page.locator(".ide-monaco-wrap, .monaco-editor").first()).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(1500);
  await page.getByRole("button", { name: "运行", exact: true }).click();
  await expect(page.locator("iframe.lab-preview-frame")).toBeVisible({ timeout: 20_000 });

  const previewFrame = page.frameLocator("iframe.lab-preview-frame");
  // v0.7 Day1 lab：stub 产出 PRD.md + 产品愿景预览页（部门周报助手）
  await expect(previewFrame.getByRole("heading", { name: "部门周报助手" })).toBeVisible({ timeout: 15_000 });
  await expect(previewFrame.getByText(/每周节省 2 小时|自动汇总/).first()).toBeVisible({ timeout: 20_000 });
  await expect(previewFrame.locator("ul li").first()).toBeVisible({ timeout: 10_000 });

  await page.locator(".lab-ide-actions").getByRole("button", { name: "评测", exact: true }).click();
  await expect(page.getByText(/评测/).first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/验收标准/).first()).toBeVisible();

  const crudName = `e2e-crud-${Date.now()}.txt`;
  await page.getByRole("button", { name: "+文件", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByTestId("ide-crud-input").fill(crudName);
  await page.getByTestId("ide-crud-confirm").click();
  await expect(page.getByText(new RegExp(`已创建 ${crudName.replace(".", "\\.")}`))).toBeVisible({
    timeout: 300_000,
  });
  await expect(page.getByRole("treeitem").filter({ hasText: crudName }).first()).toBeVisible({
    timeout: 30_000,
  });

  const crudItem = page.getByRole("treeitem").filter({ hasText: crudName }).first();
  await crudItem.click({ button: "right" });
  await page.getByRole("menuitem", { name: "重命名" }).click();
  const renamed = crudName.replace(".txt", "-renamed.txt");
  await page.getByTestId("ide-crud-input").fill(renamed);
  await page.getByTestId("ide-crud-confirm").click();
  await expect(page.getByText(new RegExp(`已重命名为 ${renamed.replace(".", "\\.")}`))).toBeVisible({
    timeout: 300_000,
  });
  await expect(page.getByRole("treeitem").filter({ hasText: renamed }).first()).toBeVisible({
    timeout: 30_000,
  });

  await page.getByRole("treeitem").filter({ hasText: renamed }).first().click({ button: "right" });
  await page.getByRole("menuitem", { name: "删除" }).click();
  await page.getByTestId("ide-crud-confirm").click();
  await expect(page.getByText(new RegExp(`已删除 ${renamed.replace(".", "\\.")}`))).toBeVisible({
    timeout: 300_000,
  });
  await expect(page.getByRole("treeitem").filter({ hasText: renamed })).toHaveCount(0, {
    timeout: 30_000,
  });

  const finishBtn = page.locator(".lab-ide-actions").getByRole("button", { name: "完成", exact: true });
  if (await finishBtn.isEnabled()) {
    await finishBtn.click();
    await expect(page.getByText(/Lab 已完成|已完成/).first()).toBeVisible({ timeout: 15_000 });
  }

  await page.screenshot({ path: path.join(artifacts, "learner-agent-lab.png"), fullPage: true });
});
