import { test, expect } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";
import { DEMO_LEARNER, DEMO_AUTHOR, loginAsAuthor, loginAsLearner, apiPost, getCsrfToken } from "../fixtures/auth";

const artifacts = path.join(__dirname, "..", "artifacts");

test.beforeAll(() => {
  fs.mkdirSync(artifacts, { recursive: true });
});

async function fetchDay1ProjectNode(page: import("@playwright/test").Page, baseURL: string) {
  const login = await page.request.post(`${baseURL}/api/v1/auth/login`, {
    data: { email: DEMO_LEARNER.email, password: DEMO_LEARNER.password, camp_id: DEMO_LEARNER.campId },
  });
  expect(login.ok()).toBeTruthy();
  const dayRes = await page.request.get(`${baseURL}/api/v1/camps/${DEMO_LEARNER.campId}/days/1`);
  expect(dayRes.ok()).toBeTruthy();
  const pkg = (await dayRes.json()) as { nodes: { id: string; kind: string; title: string }[] };
  const project = pkg.nodes.find((n) => n.kind === "project");
  expect(project, "Day1 project node").toBeTruthy();
  return project!;
}

test("grading closed loop: author fail → learner resubmit → author pass", async ({ browser, baseURL }) => {
  test.setTimeout(120_000);
  const learnerContext = await browser.newContext();
  const authorContext = await browser.newContext();
  const learnerPage = await learnerContext.newPage();
  const authorPage = await authorContext.newPage();

  await loginAsLearner(learnerPage);
  const project = await fetchDay1ProjectNode(learnerPage, baseURL!);

  let subRes = await learnerPage.request.get(
    `${baseURL}/api/v1/submissions?camp_id=${DEMO_LEARNER.campId}&day=1&node_id=${project.id}`,
  );
  expect(subRes.ok()).toBeTruthy();
  let subBody = (await subRes.json()) as { item: { id: string } | null };
  if (!subBody.item?.id) {
    const create = await apiPost(learnerPage, `${baseURL}/api/v1/submissions`, {
      camp_id: DEMO_LEARNER.campId,
      day: 1,
      node_id: project.id,
      eval: { reflection: "E2E 闭环测试：API 预置提交。" },
    });
    expect(create.ok()).toBeTruthy();
    subRes = await learnerPage.request.get(
      `${baseURL}/api/v1/submissions?camp_id=${DEMO_LEARNER.campId}&day=1&node_id=${project.id}`,
    );
    subBody = (await subRes.json()) as { item: { id: string } | null };
  }
  expect(subBody.item?.id).toBeTruthy();
  const submissionId = subBody.item!.id;

  await loginAsAuthor(authorPage);
  const authorCsrf = await getCsrfToken(authorPage);
  const failReview = await authorPage.request.post(
    `${baseURL}/api/v1/author/submissions/${submissionId}/review`,
    {
      data: { feedback: "E2E：请补充异常库存高亮说明后再交。", score: 55, status: "failed" },
      headers: { "X-CSRF-Token": authorCsrf },
    },
  );
  expect(failReview.ok()).toBeTruthy();

  await learnerPage.goto(`/app/day/1?node=${project.id}`);
  await expect(learnerPage.getByTestId("project-submission-review")).toBeVisible({ timeout: 15_000 });
  await expect(learnerPage.getByText("E2E：请补充异常库存高亮说明后再交。")).toBeVisible();
  await expect(learnerPage.getByText("需修改")).toBeVisible();

  await learnerPage.locator("#project-reflection").fill("E2E 闭环测试：已补充异常库存高亮与警戒线说明。");
  await learnerPage.getByRole("button", { name: "重新提交作业" }).click();
  await expect(learnerPage.getByText(/重新提交|已提交/)).toBeVisible({ timeout: 15_000 });

  subRes = await learnerPage.request.get(
    `${baseURL}/api/v1/submissions?camp_id=${DEMO_LEARNER.campId}&day=1&node_id=${project.id}`,
  );
  subBody = (await subRes.json()) as { item: { id: string } | null };
  expect(subBody.item?.id).toBeTruthy();
  const resubmittedId = subBody.item!.id;

  const passReview = await authorPage.request.post(
    `${baseURL}/api/v1/author/submissions/${resubmittedId}/review`,
    {
      data: { feedback: "E2E：复盘完整，准予通过。", score: 92, status: "passed" },
      headers: { "X-CSRF-Token": authorCsrf },
    },
  );
  expect(passReview.ok()).toBeTruthy();

  await learnerPage.goto(`/app/day/1?node=${project.id}`);
  await expect(learnerPage.getByText("E2E：复盘完整，准予通过。")).toBeVisible({ timeout: 15_000 });
  await expect(learnerPage.getByText("已通过")).toBeVisible();
  await learnerPage.screenshot({ path: path.join(artifacts, "grading-closed-loop.png"), fullPage: true });

  await learnerContext.close();
  await authorContext.close();
});
