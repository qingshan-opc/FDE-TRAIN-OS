import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import path from "node:path";
import fs from "node:fs";
import { loginAsLearner } from "../fixtures/auth";

const artifacts = path.join(__dirname, "..", "artifacts");

test.beforeAll(() => {
  fs.mkdirSync(artifacts, { recursive: true });
});

async function assertNoCritical(page: import("@playwright/test").Page, label: string) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .disableRules(["color-contrast"])
    .analyze();
  const serious = results.violations.filter((v) =>
    ["critical", "serious"].includes(v.impact || ""),
  );
  fs.writeFileSync(
    path.join(artifacts, `a11y-${label}.json`),
    JSON.stringify({ violations: results.violations, serious }, null, 2),
    "utf8",
  );
  expect(serious, `${label} axe serious/critical`).toEqual([]);
}

test("axe on login view", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "登录" })).toBeVisible();
  await page.screenshot({ path: path.join(artifacts, "a11y-login.png"), fullPage: true });
  await assertNoCritical(page, "login");
});

test("axe on app after login", async ({ page }) => {
  await loginAsLearner(page);
  await expect(page.getByLabel("课程大纲")).toBeVisible({ timeout: 20_000 });
  await page.screenshot({ path: path.join(artifacts, "a11y-app.png"), fullPage: true });
  await assertNoCritical(page, "app");
});

test("axe on Day1 Lab IDE", async ({ page }) => {
  test.setTimeout(90_000);
  await loginAsLearner(page);
  await page.goto("/app/day/1?node=d1-lab");
  await expect(page.getByLabel("Lab 工作台")).toBeVisible({ timeout: 20_000 });
  const results = await new AxeBuilder({ page })
    .include(".lab-ide")
    .withTags(["wcag2a", "wcag2aa"])
    .disableRules([
      "color-contrast",
      // Monaco injects aria-hidden regions and custom widgets.
      "aria-hidden-focus",
      "scrollable-region-focusable",
      // Tab close buttons sit beside role=tab within the tablist chrome.
      "aria-required-children",
    ])
    .analyze();
  const serious = results.violations.filter((v) => ["critical", "serious"].includes(v.impact || ""));
  fs.writeFileSync(
    path.join(artifacts, "a11y-lab-ide.json"),
    JSON.stringify({ violations: results.violations, serious }, null, 2),
    "utf8",
  );
  expect(serious, "lab-ide axe serious/critical").toEqual([]);
});
