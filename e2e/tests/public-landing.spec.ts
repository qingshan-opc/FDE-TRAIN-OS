import { test, expect } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";

const artifacts = path.join(__dirname, "..", "artifacts");
const OPEN_COURSES_PATH = "/open";

test.beforeAll(() => {
  fs.mkdirSync(artifacts, { recursive: true });
});

test("public landing and open courses pages load", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "青山在", exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByLabel("页面导航").getByRole("link", { name: "公开课" })).toBeVisible();

  await page.goto(OPEN_COURSES_PATH);
  await expect(page).toHaveURL(new RegExp(`${OPEN_COURSES_PATH.replace(/\//g, "\\/")}`));
  await expect(page.getByRole("link", { name: "青山在", exact: true })).toBeVisible();
  await page.screenshot({ path: path.join(artifacts, "public-landing-open-courses.png"), fullPage: true });
});
