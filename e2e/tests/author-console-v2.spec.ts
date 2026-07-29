import { test, expect, type Page } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";

const artifacts = path.join(__dirname, "..", "artifacts", "author-console-v2");

test.beforeAll(() => {
  fs.mkdirSync(artifacts, { recursive: true });
});

async function authorLogin(page: Page) {
  await page.goto("/login");
  await page.locator("#email").fill("author@fde.local");
  await page.locator("#password").fill("author1234");
  await page.getByRole("button", { name: /登\s*录/ }).click();
  await expect(page).toHaveURL(/\/author/, { timeout: 20_000 });
}

async function goLeaf(page: Page, group: string, leaf: string) {
  const menu = page.locator(".author-side-menu");
  const submenu = menu.locator(".ant-menu-submenu").filter({ hasText: group });
  if (await submenu.count()) {
    const title = submenu.first().locator(".ant-menu-submenu-title");
    const isOpen = await submenu.first().evaluate((el) => el.classList.contains("ant-menu-submenu-open"));
    if (!isOpen) await title.click();
  } else {
    await menu.getByText(group, { exact: false }).first().click();
  }
  const leafItem = menu.locator(".ant-menu-item, .ant-menu-submenu .ant-menu-item").filter({ hasText: leaf });
  if (!(await leafItem.first().isVisible().catch(() => false))) {
    await menu.locator(".ant-menu-submenu-title").filter({ hasText: group }).first().click();
  }
  await expect(leafItem.first()).toBeVisible({ timeout: 10_000 });
  await leafItem.first().click();
}

test("author overview stats visible", async ({ page }) => {
  await authorLogin(page);
  await expect(page.getByRole("heading", { name: "概览" })).toBeVisible();
  await expect(page.locator(".ant-statistic-title", { hasText: "课程" })).toBeVisible({ timeout: 20_000 });
  await expect(page.locator(".ant-statistic-title", { hasText: "草稿版本" })).toBeVisible();
  await page.screenshot({ path: path.join(artifacts, "00-overview.png"), fullPage: true });
});

test("author antd IA + redirects", async ({ page }) => {
  test.setTimeout(120_000);
  await authorLogin(page);
  await expect(page.locator(".ant-layout-sider")).toBeVisible();
  await page.screenshot({ path: path.join(artifacts, "01-sidebar.png"), fullPage: true });
  const collapseBtn = page.locator(".ant-layout-sider-trigger");
  if (await collapseBtn.isVisible().catch(() => false)) {
    await collapseBtn.click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(artifacts, "01b-sidebar-collapsed.png"), fullPage: true });
    await collapseBtn.click();
    await page.waitForTimeout(400);
    const sider = page.locator(".ant-layout-sider");
    if (await sider.evaluate((el) => el.classList.contains("ant-layout-sider-collapsed")).catch(() => false)) {
      await collapseBtn.click();
      await page.waitForTimeout(400);
    }
  }

  await goLeaf(page, "资源", "文档库");
  await expect(page).toHaveURL(/\/author\/resources\/documents/);
  await expect(page.getByRole("heading", { name: /文档库/ })).toBeVisible();

  await page.goto("/author/documents");
  await expect(page).toHaveURL(/\/author\/resources\/documents/);

  await page.goto("/author/submissions");
  await expect(page).toHaveURL(/\/author\/learners\/submissions/);

  await page.goto("/author/legacy/submissions");
  await expect(page).toHaveURL(/\/author\/learners\/reviews/);

  await page.goto("/author/open-courses");
  await expect(page).toHaveURL(/\/author\/site\/open-courses/);

  await page.goto("/author/keys");
  await expect(page).toHaveURL(/\/author\/settings\/camp-key/);
});

test("author pagination search URL", async ({ page }) => {
  test.setTimeout(90_000);
  await authorLogin(page);
  await goLeaf(page, "资源", "文档库");
  await expect(page).toHaveURL(/\/author\/resources\/documents/);
  const search = page.getByPlaceholder(/搜索文件名/);
  await search.fill("day");
  await page.waitForTimeout(400);
  await expect(page).toHaveURL(/q=day/, { timeout: 10_000 });
  await page.reload();
  await expect(page).toHaveURL(/q=day/);
  await page.screenshot({ path: path.join(artifacts, "02-documents-search.png"), fullPage: true });
});

test("author site settings roundtrip", async ({ page }) => {
  test.setTimeout(90_000);
  await authorLogin(page);
  await goLeaf(page, "网站维护", "站点信息");
  await expect(page).toHaveURL(/\/author\/site\/settings/);
  await page.screenshot({ path: path.join(artifacts, "03-site-settings.png"), fullPage: true });
  const editBtn = page.getByRole("button", { name: /^编辑$/ }).first();
  if (await editBtn.isVisible().catch(() => false)) {
    await editBtn.click();
    await expect(page.locator(".ant-modal")).toContainText("编辑站点信息", { timeout: 15_000 });
    await page.locator(".ant-modal").getByRole("button", { name: /取\s*消|Cancel/i }).click();
  }

  await goLeaf(page, "网站维护", "首页内容");
  await expect(page).toHaveURL(/\/author\/site\/home/);
  await page.getByRole("button", { name: /上传 Hero/ }).click();
  await expect(page.locator(".ant-modal")).toBeVisible();
  await expect(page.getByText(/拖拽或点击上传|上传视频/)).toBeVisible();
  await page.screenshot({ path: path.join(artifacts, "03b-site-hero-modal.png"), fullPage: true });
  await page.locator(".ant-modal").getByRole("button", { name: /关闭/ }).click();
});

test("author resources videos + packs", async ({ page }) => {
  test.setTimeout(90_000);
  await authorLogin(page);
  await goLeaf(page, "资源", "视频库");
  await expect(page).toHaveURL(/\/author\/resources\/videos/);
  await expect(page.getByRole("heading", { name: /视频库/ })).toBeVisible();
  await page.screenshot({ path: path.join(artifacts, "04-video-library.png"), fullPage: true });

  await goLeaf(page, "资源", "素材包");
  await expect(page).toHaveURL(/\/author\/resources\/packs/);
  await page.screenshot({ path: path.join(artifacts, "05-material-packs.png"), fullPage: true });
});

test("author curriculum versions + courses", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/login");
  await expect(page.locator("#email")).toBeVisible({ timeout: 20_000 });
  await authorLogin(page);
  await goLeaf(page, "课程设计", "课程与大纲");
  await expect(page).toHaveURL(/\/author\/curriculum\/courses/);
  await expect(page.getByRole("heading", { name: /课程与大纲/ })).toBeVisible();
  await page.screenshot({ path: path.join(artifacts, "06-courses.png"), fullPage: true });

  // 设计大纲 should land on filtered versions or workbench
  const designBtn = page.getByRole("button", { name: "设计大纲" }).first();
  await expect(designBtn).toBeVisible();
  await designBtn.click();
  await expect(page).toHaveURL(/\/author\/curriculum\/(versions|courses)/, { timeout: 20_000 });
  if (page.url().includes("/versions")) {
    await expect(page).toHaveURL(/course_id=/);
  }

  await goLeaf(page, "课程设计", "课程版本");
  await expect(page).toHaveURL(/\/author\/curriculum\/versions/);
  await expect(page.getByRole("button", { name: /新增版本/ })).toBeVisible();
  await page.getByRole("button", { name: /新增版本/ }).click();
  await expect(page.locator(".ant-modal")).toBeVisible();
  await page.screenshot({ path: path.join(artifacts, "07-version-create.png"), fullPage: true });
  await page.getByRole("button", { name: /取\s*消|Cancel/i }).click();
});

test("author learners + submissions", async ({ page }) => {
  test.setTimeout(90_000);
  await authorLogin(page);
  await goLeaf(page, "学员中心", "学员与课程");
  await expect(page).toHaveURL(/\/author\/learners$/);
  await page.screenshot({ path: path.join(artifacts, "08-learners.png"), fullPage: true });

  await goLeaf(page, "学员中心", "提交资料");
  await expect(page).toHaveURL(/\/author\/learners\/submissions/);
  await expect(page.locator(".ant-table")).toBeVisible();
  await page.screenshot({ path: path.join(artifacts, "09-submissions.png"), fullPage: true });
  const toolbar = page.locator(".author-search-toolbar");
  await expect(toolbar).toBeVisible();
  const box = await toolbar.boundingBox();
  expect(box?.height || 0).toBeLessThan(80);
  await page.screenshot({ path: path.join(artifacts, "09b-submissions-toolbar-row.png"), fullPage: false });
  const viewBtn = page.locator(".ant-table").getByRole("button", { name: "查看" }).first();
  await expect(viewBtn).toBeVisible({ timeout: 10_000 });
  await viewBtn.click();
  await expect(page.locator(".ant-modal")).toBeVisible({ timeout: 10_000 });
  await page.screenshot({ path: path.join(artifacts, "09-submission-detail.png"), fullPage: true });
  await page.keyboard.press("Escape");
});
