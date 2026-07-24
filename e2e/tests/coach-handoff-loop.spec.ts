import { test, expect } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";
import { loginAsAuthor, loginAsLearner, apiPost, getCsrfToken } from "../fixtures/auth";

const artifacts = path.join(__dirname, "..", "artifacts");

test.beforeAll(() => {
  fs.mkdirSync(artifacts, { recursive: true });
});

test("coach handoff closed loop: learner handoff → author resolves → learner sees feedback", async ({
  browser,
  baseURL,
}) => {
  test.setTimeout(120_000);
  const learnerContext = await browser.newContext();
  const authorContext = await browser.newContext();
  const learnerPage = await learnerContext.newPage();
  const authorPage = await authorContext.newPage();

  await loginAsLearner(learnerPage);
  await learnerPage.goto("/app/day/1?node=d1-learn");
  await expect(learnerPage).toHaveURL(/\/app\/day\/1\?node=/);

  await learnerPage.getByRole("button", { name: "AI 任务导师" }).click();
  await expect(learnerPage.getByRole("dialog", { name: "AI 任务导师" })).toBeVisible();
  await learnerPage.locator("#coach-q").fill("Day1 企业任务边界我还不太清楚，请导师帮我看看。");
  await learnerPage.getByRole("button", { name: "提问" }).click();
  await expect(learnerPage.getByText(/LEVEL/i).first()).toBeVisible({ timeout: 20_000 });

  const handoffRes = await apiPost(learnerPage, `${baseURL}/api/v1/coach/handoff`, {
    camp_id: "camp-v03",
    day: 1,
    node_id: "d1-learn",
    question: "E2E：企业任务边界我还不太清楚，请导师帮我看看。",
  });
  expect(handoffRes.ok()).toBeTruthy();
  const handoffBody = (await handoffRes.json()) as { review_id: string };
  const reviewId = handoffBody.review_id;

  await loginAsAuthor(authorPage);
  const authorCsrf = await getCsrfToken(authorPage);
  await authorPage.goto("/author/legacy/submissions");
  await expect(authorPage.getByText("导师复核队列")).toBeVisible({ timeout: 15_000 });

  const resolve = await authorPage.request.post(`${baseURL}/api/v1/author/reviews/${reviewId}/feedback`, {
    data: { feedback: "E2E 导师反馈：先写清老板要的库存列表四列，再动手生成页面。", status: "resolved" },
    headers: { "X-CSRF-Token": authorCsrf },
  });
  expect(resolve.ok()).toBeTruthy();

  await learnerPage.reload();
  await learnerPage.getByRole("button", { name: "AI 任务导师" }).click();
  await expect(learnerPage.getByText("E2E 导师反馈：先写清老板要的库存列表四列，再动手生成页面。")).toBeVisible({
    timeout: 15_000,
  });
  await learnerPage.screenshot({ path: path.join(artifacts, "coach-handoff-loop.png"), fullPage: true });

  await learnerContext.close();
  await authorContext.close();
});
