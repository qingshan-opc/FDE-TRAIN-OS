import { test, expect } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";
import { loginAsLearner, openDayFromSyllabus } from "../fixtures/auth";

const artifacts = path.join(__dirname, "..", "artifacts");

test.beforeAll(() => {
  fs.mkdirSync(artifacts, { recursive: true });
});

test("learner asks coach via global AI 任务导师 FAB", async ({ page }) => {
  await loginAsLearner(page);
  await openDayFromSyllabus(page, "第一天");
  await expect(page).toHaveURL(/\/app\/day\/1\?node=/);

  await expect(page.locator(".learner-context-bar")).toBeVisible();
  await expect(page.locator(".learner-context-bar__weekday")).toContainText(/第1周 · Day 1/);
  await expect(page.locator(".learner-context-bar__time")).toContainText(/已学习 \d+ 分钟/);

  await expect(page.getByRole("tab", { name: "AI 导师" })).toHaveCount(0);
  await expect(page.getByLabel("任务面板")).toBeVisible();

  await expect(page.getByRole("button", { name: "AI 任务导师" })).toBeVisible();
  await page.getByRole("button", { name: "AI 任务导师" }).click();
  await expect(page.getByRole("dialog", { name: "AI 任务导师" })).toBeVisible({ timeout: 10_000 });
  await page.locator("#coach-q").fill("Day1 库存列表页怎么验收？");
  await page.getByRole("button", { name: "提问" }).click();
  await expect(page.getByText(/LEVEL/i).first()).toBeVisible({ timeout: 20_000 });
  await page.screenshot({ path: path.join(artifacts, "learner-coach.png"), fullPage: true });
});

test("c6 local_prep suggested questions appear in coach drawer", async ({ page }) => {
  await loginAsLearner(page);
  await openDayFromSyllabus(page, "第一天");
  await page.getByRole("button", { name: /6\. 今日交付规格：企业库存管理系统 Week1/ }).click();
  await expect(page.getByRole("heading", { name: "今日交付规格：企业库存管理系统 Week1" })).toBeVisible();

  await page.getByRole("button", { name: "AI 任务导师" }).click();
  await expect(page.getByRole("dialog", { name: "AI 任务导师" })).toBeVisible();
  await expect(page.getByText("推荐问题")).toBeVisible();
  await expect(page.getByRole("button", { name: "我不知道表格里还必须有哪些列" })).toBeVisible();
  await expect(page.getByRole("button", { name: "示例数据怎样才算「能验收」" })).toBeVisible();
});
