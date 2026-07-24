import { test, expect } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";
import { loginAsLearner } from "../fixtures/auth";

const artifacts = path.join(__dirname, "..", "artifacts");

test.beforeAll(() => {
  fs.mkdirSync(artifacts, { recursive: true });
});

test("learner Day1 capsule shows audio screen / video", async ({ page }) => {
  await loginAsLearner(page);
  await expect(page.getByLabel("课程大纲")).toBeVisible({ timeout: 20_000 });

  await page
    .locator("button.syllabus-day-hit")
    .filter({ has: page.locator(".syllabus-day-name", { hasText: "第一天" }) })
    .first()
    .click();
  await expect(page).toHaveURL(/\/app\/day\/1\?node=/);

  await page.goto("/app/day/1?node=d1-learn");
  await expect(page.getByRole("heading", { name: "FDE 是谁：懂业务的技术落地者" })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByRole("heading", { name: "语音讲解 · FDE 是谁" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "讲解视频 · FDE 是谁" })).toBeVisible();
  await page.screenshot({ path: path.join(artifacts, "learner-media-day1.png"), fullPage: true });
});
