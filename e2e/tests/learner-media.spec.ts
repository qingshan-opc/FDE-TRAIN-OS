import { test, expect } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";
import { loginAsLearner } from "../fixtures/auth";

const artifacts = path.join(__dirname, "..", "artifacts");

test.beforeAll(() => {
  fs.mkdirSync(artifacts, { recursive: true });
});

test("learner Day1 capsule shows 口播稿 prose (video deferred in v0.7)", async ({ page }) => {
  await loginAsLearner(page);
  await expect(page.getByLabel("课程大纲")).toBeVisible({ timeout: 20_000 });

  await page
    .locator("button.syllabus-day-hit")
    .filter({ has: page.locator(".syllabus-day-name", { hasText: "第一天" }) })
    .first()
    .click();
  await expect(page).toHaveURL(/\/app\/day\/1\?node=/);

  await page.goto("/app/day/1?node=d1-learn");
  // v0.7 第一周：视频暂缓生成，胶囊呈现口播稿正文（同学们开场）
  await expect(page.getByRole("heading", { name: "AI 时代的产品经理：从写文档到定方向", exact: true })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText(/同学们/).first()).toBeVisible();
  await page.screenshot({ path: path.join(artifacts, "learner-media-day1.png"), fullPage: true });
});
