import { test, expect } from "@playwright/test";
import { loginAsLearner } from "../fixtures/auth";

async function login(page: import("@playwright/test").Page) {
  await loginAsLearner(page);
}

test("learner local prep tab copy prompt", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await login(page);
  await page
    .locator("button.syllabus-day-hit")
    .filter({ has: page.locator(".syllabus-day-name", { hasText: "第一天" }) })
    .first()
    .click();
  await expect(page).toHaveURL(/\/app\/day\/1\?node=/);

  await page.getByRole("button", { name: /6\. 今日交付规格：企业库存管理系统 Week1/ }).click();
  await expect(page.getByRole("heading", { name: "今日交付规格：企业库存管理系统 Week1" })).toBeVisible();

  await page.getByRole("tab", { name: "本地实操" }).click();
  await expect(page.locator(".local-prep-panel")).toBeVisible();
  await page.getByRole("button", { name: "复制任务背景" }).click();
  await expect(page.getByText(/已复制/)).toBeVisible({ timeout: 5000 });
});
