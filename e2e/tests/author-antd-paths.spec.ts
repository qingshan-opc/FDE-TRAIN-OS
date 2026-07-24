/**
 * @deprecated Prefer author-console-v2.spec.ts — kept as thin smoke for CI path aliases.
 */
import { test, expect, type Page } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";

const artifacts = path.join(__dirname, "..", "artifacts", "antd-gate");

test.beforeAll(() => {
  fs.mkdirSync(artifacts, { recursive: true });
});

async function authorLogin(page: Page) {
  await page.goto("/login");
  await page.locator("#email").fill("author@fde.local");
  await page.locator("#password").fill("author1234");
  await page.getByRole("button", { name: /登\s*录/ }).click();
  await expect(page).toHaveURL(/\/author/, { timeout: 20_000 });
  await expect(page.getByRole("menuitem", { name: "概览" })).toBeVisible();
}

async function goLeaf(page: Page, group: string, leaf: string) {
  const menu = page.locator(".ant-menu");
  const submenu = menu.locator(".ant-menu-submenu").filter({ hasText: group });
  if (await submenu.count()) {
    const isOpen = await submenu.first().evaluate((el) => el.classList.contains("ant-menu-submenu-open"));
    if (!isOpen) await submenu.first().click();
  }
  await menu.locator(".ant-menu-item").filter({ hasText: leaf }).click();
}

test("antd author shell + main paths smoke", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/login");
  await expect(page.locator(".ant-card")).toBeVisible();
  await page.screenshot({ path: path.join(artifacts, "01-login.png"), fullPage: true });

  await authorLogin(page);
  await expect(page.locator(".ant-layout-sider")).toBeVisible();
  await page.screenshot({ path: path.join(artifacts, "02-author-overview.png"), fullPage: true });

  await goLeaf(page, "资源", "文档库");
  await expect(page).toHaveURL(/\/author\/resources\/documents/);
  await expect(page.locator(".ant-table")).toBeVisible();
  await page.screenshot({ path: path.join(artifacts, "03-documents.png"), fullPage: true });

  await goLeaf(page, "学员中心", "提交资料");
  await expect(page).toHaveURL(/\/author\/learners\/submissions/);
  await page.screenshot({ path: path.join(artifacts, "04-submissions.png"), fullPage: true });

  await goLeaf(page, "课程设计", "课程版本");
  await expect(page).toHaveURL(/\/author\/curriculum\/versions/);
  await page.screenshot({ path: path.join(artifacts, "05-course-yaml.png"), fullPage: true });

  await goLeaf(page, "课程设计", "课程与大纲");
  await expect(page).toHaveURL(/\/author\/curriculum\/courses/);
  await page.screenshot({ path: path.join(artifacts, "06-courses.png"), fullPage: true });

  await goLeaf(page, "网站维护", "站点公开课");
  await expect(page).toHaveURL(/\/author\/site\/open-courses/);
  await page.screenshot({ path: path.join(artifacts, "07-open-courses.png"), fullPage: true });

  await goLeaf(page, "系统设置", "营期 Key");
  await expect(page).toHaveURL(/\/author\/settings\/camp-key/);
  await page.screenshot({ path: path.join(artifacts, "08-keys.png"), fullPage: true });
});
