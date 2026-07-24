import { test, expect } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";
import { loginAsLearner } from "../fixtures/auth";

const artifacts = path.join(__dirname, "..", "artifacts");

test.beforeAll(() => {
  fs.mkdirSync(artifacts, { recursive: true });
});

test("learner Day5 sim terminal UI", async ({ page, request, baseURL }) => {
  // login via API for unlocks + cookie jar for page
  const login = await request.post(`${baseURL}/api/v1/auth/login`, {
    data: { email: "demo@fde.local", password: "demo1234", camp_id: "camp-v03" },
  });
  expect(login.ok()).toBeTruthy();
  const csrf = (await login.json()).csrf as string;

  const day = await request.get(`${baseURL}/api/v1/camps/camp-v03/days/5`);
  expect(day.ok()).toBeTruthy();
  const pkg = await day.json();
  const learn = (pkg.nodes as { id: string; kind: string }[]).find((n) => n.kind === "learn");
  const quiz = (pkg.nodes as { id: string; kind: string }[]).find((n) => n.kind === "quiz");
  expect(learn && quiz).toBeTruthy();

  for (const n of [learn!, quiz!]) {
    const r = await request.post(`${baseURL}/api/v1/nodes/${encodeURIComponent(n.id)}/complete`, {
      headers: { "X-CSRF-Token": csrf },
      data: { camp_id: "camp-v03", day: 5 },
    });
    // may already be passed
    expect([200, 400, 409].includes(r.status()) || r.ok()).toBeTruthy();
  }

  await loginAsLearner(page);

  await page.goto("/app/day/5");
  await expect(page).toHaveURL(/\/app\/day\/5/);
  await page.getByRole("button", { name: /仿真机配置 Nginx/ }).click();
  await expect(page.getByRole("heading", { name: /仿真机配置 Nginx/ })).toBeVisible();

  const create = page.getByRole("button", { name: /创建 Sim 会话|重建会话/ });
  await expect(create).toBeEnabled({ timeout: 15_000 });
  await create.click();
  await expect(page.getByText("终端").first()).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: /^nginx -t$/ }).click();
  await expect(page.locator(".sim-terminal")).toContainText(/nginx -t|syntax/i, { timeout: 10_000 });
  await page.screenshot({ path: path.join(artifacts, "learner-sim-day5.png"), fullPage: true });
});
