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
  await page.locator("#coach-q").fill("第一天的库存列表页怎么验收？");
  await page.getByRole("button", { name: "发送" }).click();
  await expect(page.locator(".coach-msg-bot").first()).toBeVisible({ timeout: 20_000 });
  await page.screenshot({ path: path.join(artifacts, "learner-coach.png"), fullPage: true });
});

test("c4 local_prep suggested questions appear in coach drawer", async ({ page }) => {
  await loginAsLearner(page);
  await openDayFromSyllabus(page, "第一天");
  await page.getByRole("button", { name: /4\. 实战：用 PM 提示词跑出你的第一份迷你 PRD/ }).click();
  await expect(page.getByRole("heading", { name: "实战：用 PM 提示词跑出你的第一份迷你 PRD" })).toBeVisible();

  await page.getByRole("button", { name: "AI 任务导师" }).click();
  await expect(page.getByRole("dialog", { name: "AI 任务导师" })).toBeVisible();
  await expect(page.getByText("推荐问题")).toBeVisible();
  await expect(page.getByRole("button", { name: "AI 没有反问我就直接开写了，怎么办？" })).toBeVisible();
  await expect(page.getByRole("button", { name: "验收标准里的「可衡量」到底怎么判断？" })).toBeVisible();
});
