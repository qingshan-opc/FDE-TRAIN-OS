import { test, expect } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";
import { loginAsLearner } from "../fixtures/auth";

const artifacts = path.join(__dirname, "..", "artifacts");

test.beforeAll(() => {
  fs.mkdirSync(artifacts, { recursive: true });
});

async function loginAndEnterCourse(page: import("@playwright/test").Page) {
  await loginAsLearner(page);
}

test("task home shows pending cards and deep-links with ?node=", async ({ page }) => {
  await loginAndEnterCourse(page);

  await expect(page.getByLabel("任务首页")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("heading", { name: "今日任务" })).toBeVisible();
  await expect(page.getByRole("tab", { name: /待办/ })).toBeVisible();

  const continueBtn = page.getByRole("button", { name: /继续：/ }).first();
  await expect(continueBtn).toBeVisible();
  await continueBtn.click();

  await expect(page).toHaveURL(/\/app\/day\/\d+\?node=/, { timeout: 20_000 });

  await page.goto("/app");
  await expect(page.getByLabel("任务首页")).toBeVisible();

  await page
    .locator("button.syllabus-day-hit")
    .filter({ has: page.locator(".syllabus-day-name", { hasText: "第一天" }) })
    .first()
    .click();
  await expect(page).toHaveURL(/\/app\/day\/1\?node=/, { timeout: 20_000 });

  await page.goto("/app");
  await expect(page.getByLabel("任务首页")).toBeVisible();

  const firstCard = page.locator(".task-home-card:not(.is-locked)").first();
  await expect(firstCard).toBeVisible();
  await firstCard.click();
  await expect(page).toHaveURL(/\/app\/day\/\d+\?node=/, { timeout: 20_000 });

  await page.screenshot({ path: path.join(artifacts, "learner-task-home.png"), fullPage: true });
});

test("task panel CTA deep-links from /app", async ({ page }) => {
  await loginAndEnterCourse(page);
  await expect(page.getByLabel("任务首页")).toBeVisible();

  await page
    .getByLabel("任务面板")
    .getByRole("button", { name: /继续：|去做作业/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/app\/day\/\d+\?node=/, { timeout: 20_000 });
});
