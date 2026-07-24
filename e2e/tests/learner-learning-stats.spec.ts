import { test, expect } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";
import { loginAsLearner } from "../fixtures/auth";

const artifacts = path.join(__dirname, "..", "artifacts");

test.beforeAll(() => {
  fs.mkdirSync(artifacts, { recursive: true });
});

test("learning heartbeat persists study minutes across refresh", async ({ page }) => {
  await loginAsLearner(page);
  await page.goto("/app/day/1?node=d1-learn");
  await expect(page.locator(".learner-context-bar__time")).toBeVisible();

  const beforeText = await page.locator(".learner-context-bar__time").innerText();
  const beforeMin = Number(/\d+/.exec(beforeText)?.[0] ?? 0);

  const heartbeat = page.waitForResponse(
    (res) => res.url().includes("/api/v1/learning/heartbeat") && res.status() === 200,
    { timeout: 45_000 },
  );
  await heartbeat;
  const body = (await (await heartbeat).json()) as { study_seconds: number };
  expect(body.study_seconds).toBeGreaterThanOrEqual(30);

  await page.reload();
  await expect(page.locator(".learner-context-bar__time")).toBeVisible();
  const afterText = await page.locator(".learner-context-bar__time").innerText();
  const afterMin = Number(/\d+/.exec(afterText)?.[0] ?? 0);
  expect(afterMin).toBeGreaterThanOrEqual(beforeMin);
  await page.screenshot({ path: path.join(artifacts, "learner-learning-stats.png"), fullPage: true });
});
