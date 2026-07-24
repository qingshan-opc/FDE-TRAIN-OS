import { test, expect } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";
import { goAuthorLeaf, loginAsAuthor } from "../fixtures/auth";

const artifacts = path.join(__dirname, "..", "artifacts");

test.beforeAll(() => {
  fs.mkdirSync(artifacts, { recursive: true });
});

test("author login and upload Day YAML", async ({ page }) => {
  test.setTimeout(120_000);
  const tag = `e2e-yaml-${Date.now()}`;

  await loginAsAuthor(page);
  await expect(page.getByRole("heading", { name: "概览" })).toBeVisible();

  await goAuthorLeaf(page, "课程设计", "课程版本");
  await expect(page.getByRole("heading", { name: "课程版本" })).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: /新增版本/ }).click();
  await expect(page.getByRole("dialog")).toBeVisible();

  await page.locator(".ant-modal .ant-select").first().click();
  await page.locator(".ant-select-item-option").first().click();
  await page.locator(".ant-modal").getByLabel("版本 Tag").fill(tag);

  await page.getByRole("tab", { name: "导入 YAML" }).click();
  const yaml = `day: 99
title: E2E stub day
week: 1
nodes:
  - type: learn
    title: stub
`;
  const tmp = path.join(artifacts, "day-99-e2e-stub.yaml");
  fs.writeFileSync(tmp, yaml, "utf8");
  await page.locator(".ant-modal").locator('input[type="file"]').setInputFiles(tmp);
  await expect(page.getByText(/day-99-e2e-stub\.yaml/)).toBeVisible();

  await page.getByRole("button", { name: "保存" }).click();
  await expect(page.getByText(/已创建草稿|创建成功/i).first()).toBeVisible({ timeout: 30_000 });
  await expect(page).toHaveURL(/\/author\/curriculum\/courses\/.+\/versions\//, { timeout: 20_000 });
  await expect(page.getByText(/第\s*99\s*课|E2E stub day|99/).first()).toBeVisible({ timeout: 20_000 });
  await page.screenshot({ path: path.join(artifacts, "author-upload.png"), fullPage: true });
});
