import { test, expect } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";
import { DEMO_LEARNER, loginAsAuthor } from "../fixtures/auth";

const artifacts = path.join(__dirname, "..", "artifacts", "curriculum");
const artifactsV2 = path.join(__dirname, "..", "artifacts", "author-console-v2");

test.beforeAll(() => {
  fs.mkdirSync(artifacts, { recursive: true });
  fs.mkdirSync(artifactsV2, { recursive: true });
});

test("author curriculum editor: open draft + day/capsule/media/yaml modals", async ({ page, request, baseURL }) => {
  test.setTimeout(120_000);
  const tag = `draft-e2e-${Date.now()}`;

  await loginAsAuthor(page);

  const cookies = await page.context().cookies();
  const csrf = cookies.find((c) => c.name === "fde_csrf")?.value || "";
  const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
  const headers = { Cookie: cookieHeader, "X-CSRF-Token": csrf };

  const courses = await request.get(`${baseURL}/api/v1/author/courses?page=1&page_size=5`, { headers });
  const courseId = (await courses.json()).items?.[0]?.id as string;
  expect(courseId).toBeTruthy();

  const form = new URLSearchParams();
  form.set("version_tag", tag);
  form.set("title", "E2E blank");
  form.set("camp_id", DEMO_LEARNER.campId);
  const created = await request.post(`${baseURL}/api/v1/author/courses/${courseId}/versions`, {
    headers: { ...headers, "Content-Type": "application/x-www-form-urlencoded" },
    data: form.toString(),
  });
  expect(created.ok()).toBeTruthy();
  const versionId = (await created.json()).course_version_id as string;

  const dayRes = await request.post(`${baseURL}/api/v1/author/course-versions/${versionId}/days`, {
    headers: { ...headers, "Content-Type": "application/json" },
    data: JSON.stringify({ title: "E2E Day", week: 1 }),
  });
  expect(dayRes.ok()).toBeTruthy();
  const dayNo = (await dayRes.json()).day as number;

  await page.goto(`/author/curriculum/courses/${courseId}/versions/${versionId}`);
  await expect(page.getByText(/课纲编辑器|草稿/i).first()).toBeVisible({ timeout: 20_000 });
  await page.screenshot({ path: path.join(artifacts, "01-workbench.png"), fullPage: true });
  await page.screenshot({ path: path.join(artifactsV2, "10-curriculum-workbench.png"), fullPage: true });

  await page.getByRole("button", { name: /新建课次/ }).click();
  await expect(page.locator(".ant-modal")).toBeVisible();
  await page.screenshot({ path: path.join(artifactsV2, "11-day-modal.png"), fullPage: true });
  await page.locator(".ant-modal").getByRole("button", { name: /取\s*消/ }).click();

  // Select the day node so capsule actions appear
  await page.locator(".ant-tree-node-content-wrapper").filter({ hasText: new RegExp(`第\\s*${dayNo}\\s*课`) }).first().click();
  await expect(page.getByText("本课信息").first()).toBeVisible({ timeout: 10_000 });

  const addCap = page.locator(".ant-tree-node-content-wrapper").filter({ hasText: /新增课节/ });
  await expect(addCap).toBeVisible({ timeout: 10_000 });
  await addCap.click();
  await expect(page.locator(".ant-modal")).toBeVisible();
  await page.screenshot({ path: path.join(artifactsV2, "12-capsule-modal.png"), fullPage: true });
  await page.locator(".ant-modal").getByPlaceholder(/c1|例如/).first().fill("c-e2e");
  await page.locator(".ant-modal").getByRole("textbox").nth(1).fill("E2E节");
  const content = page.locator(".ant-modal textarea").first();
  if (await content.count()) await content.fill("hello");
  await page.locator(".ant-modal").getByRole("button", { name: /保存|确定/ }).click();
  await page.waitForTimeout(800);

  // Tree sub-item for c-e2e → 资源 tab
  await page.locator(".ant-tree .ant-tree-node-content-wrapper").filter({ hasText: /^资源$/ }).nth(1).click();
  await expect(page.getByRole("tab", { name: "资源", selected: true })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(/绑定本课资源池（多选）|可从本课整日资源池绑定/).first()).toBeVisible({ timeout: 10_000 });
  await page.screenshot({ path: path.join(artifactsV2, "14-capsule-resources-tab.png"), fullPage: true });

  // 讲义 tab media picker
  const notesLeaf = page.getByRole("treeitem", { name: "讲义", exact: true }).nth(1);
  if (await notesLeaf.isVisible().catch(() => false)) await notesLeaf.click();

  const fromLib = page.getByRole("button", { name: /从视频库选择/ });
  if (await fromLib.isVisible().catch(() => false)) {
    await fromLib.click();
    await expect(page.locator(".ant-modal")).toBeVisible();
    await page.screenshot({ path: path.join(artifactsV2, "13-media-picker.png"), fullPage: true });
    await page.locator(".ant-modal").getByRole("button", { name: /取\s*消|关\s*闭/ }).first().click();
  } else {
    await page.getByRole("button", { name: /导入 YAML/ }).click();
    await expect(page.locator(".ant-modal")).toBeVisible();
    await page.screenshot({ path: path.join(artifactsV2, "13-media-picker.png"), fullPage: true });
    await page.locator(".ant-modal").getByRole("button", { name: /取\s*消|关\s*闭/ }).first().click();
  }
  await expect(page.locator(".ant-modal")).toHaveCount(0, { timeout: 10_000 });

  // 知识卡片 Tab + 学员预览四步流（已在课节编辑器内，无需再点树节点）
  await page.getByRole("tab", { name: /知识卡片/ }).click();
  const cardsPanel = page.locator(".ant-tabs-tabpane-active");
  await cardsPanel.getByRole("button", { name: /添加知识卡片/ }).click();
  await cardsPanel.locator(".ant-card").last().getByRole("textbox").nth(1).fill("E2E词条");
  await cardsPanel.locator(".ant-card").last().locator("textarea").first().fill("E2E解释");
  await page.getByRole("button", { name: /学员预览/ }).click();
  const previewDrawer = page.locator(".ant-drawer");
  await expect(previewDrawer).toContainText("学员预览");
  await previewDrawer.getByRole("tab", { name: /知识卡片/ }).click();
  await expect(previewDrawer.getByRole("listitem").filter({ hasText: "E2E词条" }).first()).toBeVisible({ timeout: 10_000 });
  await page.screenshot({ path: path.join(artifactsV2, "15-knowledge-cards-preview.png"), fullPage: true });
  await page.keyboard.press("Escape");
  await expect(page.locator(".ant-drawer")).toHaveCount(0, { timeout: 10_000 });

  // 本地实操 Tab + 预览步流
  await page.getByRole("tab", { name: /本地实操/ }).click();
  const prepPanel = page.locator(".ant-tabs-tabpane-active");
  await prepPanel.locator("textarea").first().fill("E2E 本地任务：请在本机完成验收。");
  await page.getByRole("button", { name: /学员预览/ }).click();
  await previewDrawer.getByRole("tab", { name: /本地实操/ }).click();
  await expect(previewDrawer.locator(".local-prep-panel")).toBeVisible({ timeout: 10_000 });
  await expect(previewDrawer.getByText("E2E 本地任务")).toBeVisible();
  await page.screenshot({ path: path.join(artifactsV2, "16-local-prep-preview.png"), fullPage: true });
  await page.keyboard.press("Escape");

  await page.screenshot({ path: path.join(artifacts, "02-after-modals.png"), fullPage: true });
});
