import { test, expect } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";
import { loginAsLearner } from "../fixtures/auth";

const artifacts = path.join(__dirname, "..", "artifacts");

test.beforeAll(() => {
  fs.mkdirSync(artifacts, { recursive: true });
});

test("learner login → Day1 → capsule → quiz stub", async ({ page }) => {
  await loginAsLearner(page);

  // Anchor to syllabus rail — TaskHome cards also contain 「第一天」.
  await page
    .locator("button.syllabus-day-hit")
    .filter({ has: page.locator(".syllabus-day-name", { hasText: "第一天" }) })
    .first()
    .click();
  await expect(page).toHaveURL(/\/app\/day\/1\?node=/);
  await page.screenshot({ path: path.join(artifacts, "learner-day1.png"), fullPage: true });

  // learn / capsule
  const learnBtn = page.getByRole("button", { name: /学习|胶囊|learn/i }).first();
  if (await learnBtn.count()) {
    await learnBtn.click();
  }
  const cap = page.getByRole("button", { name: /胶囊|知识/i }).first();
  if (await cap.count()) {
    await cap.click();
    await page.screenshot({ path: path.join(artifacts, "learner-capsule.png"), fullPage: true });
  }

  const quizBtn = page.getByRole("button", { name: /测验|quiz/i }).first();
  if (await quizBtn.count()) {
    await quizBtn.click();
    const option = page.getByRole("button").filter({ hasText: /^[A-D]\.|选项/ }).first();
    if (await option.count()) {
      await option.click();
    }
    const submit = page.getByRole("button", { name: /提交测验/ });
    if (await submit.count()) {
      await submit.click();
    }
  }
  await page.screenshot({ path: path.join(artifacts, "learner-quiz.png"), fullPage: true });
});
