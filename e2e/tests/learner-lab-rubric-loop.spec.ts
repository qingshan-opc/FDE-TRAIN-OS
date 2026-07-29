import { test, expect } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";
import { loginAsLearner } from "../fixtures/auth";

const artifacts = path.join(__dirname, "..", "artifacts");

test.beforeAll(() => {
  fs.mkdirSync(artifacts, { recursive: true });
});

test("lab rubric fail then pass unlocks project node", async ({ page }) => {
  test.setTimeout(420_000);
  await loginAsLearner(page);

  await page.goto("/app/day/1?node=d1-lab");
  await expect(page).toHaveURL(/\/app\/day\/1\?node=/);

  const genBtn = page.getByRole("button", { name: "生成", exact: true });
  try {
    await expect(genBtn).toBeVisible({ timeout: 8_000 });
  } catch {
    await page.getByRole("button", { name: /Agent 生成库存列表页/ }).click();
    await expect(genBtn).toBeVisible({ timeout: 15_000 });
  }

  await page.getByRole("button", { name: /^高级/ }).click();
  await page.locator("#force-stub").check({ force: true });
  await expect(page.locator("#force-stub")).toBeChecked();

  if ((await page.getByRole("treeitem").filter({ hasText: /PRD\.md/ }).count()) === 0) {
    await genBtn.click();
  }
  // v0.7 Day1 rubric 锚定 PRD.md（用户故事/验收标准）。
  const prdItem = page.getByRole("treeitem").filter({ hasText: /PRD\.md/ }).first();
  await expect(prdItem).toBeVisible({ timeout: 120_000 });

  // Break rubric by deleting required artifact.
  await prdItem.click({ button: "right" });
  await page.getByRole("menuitem", { name: "删除" }).click();
  await page.getByTestId("ide-crud-confirm").click();
  await expect(page.getByText(/已删除 PRD\.md/)).toBeVisible({ timeout: 300_000 });
  await expect(page.getByRole("treeitem").filter({ hasText: /PRD\.md/ })).toHaveCount(0, {
    timeout: 30_000,
  });

  await page.locator(".lab-ide-actions").getByRole("button", { name: "评测", exact: true }).click();
  await expect(page.getByText(/评测未通过|未通过/).first()).toBeVisible({ timeout: 30_000 });

  const finishBlocked = page.locator(".lab-ide-actions").getByRole("button", { name: "完成", exact: true });
  if (await finishBlocked.isEnabled().catch(() => false)) {
    await finishBlocked.click();
    await expect(page.getByText(/请先通过 Rubric 评测后再完成/).first()).toBeVisible({ timeout: 10_000 });
  }

  await genBtn.click();
  await expect(page.getByRole("treeitem").filter({ hasText: /PRD\.md/ }).first()).toBeVisible({
    timeout: 300_000,
  });
  await page.locator(".lab-ide-actions").getByRole("button", { name: "评测", exact: true }).click();
  await expect(page.getByText(/评测已通过：点「完成」|评测通过/).first()).toBeVisible({ timeout: 30_000 });

  const finishBtn = page.locator(".lab-ide-actions").getByRole("button", { name: "完成", exact: true });
  if (await finishBtn.isEnabled()) {
    await finishBtn.click();
    await expect(page.getByText(/Lab 已完成|已完成/).first()).toBeVisible({ timeout: 15_000 });
  }

  await page.goto("/app/day/1?node=d1-project");
  await expect(page.getByRole("heading", { name: /企业任务|库存管理系统/ }).first()).toBeVisible({
    timeout: 15_000,
  });
  await page.screenshot({ path: path.join(artifacts, "learner-lab-rubric-loop.png"), fullPage: true });
});
