import { test, expect } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";
import { loginAsLearner } from "../fixtures/auth";

const artifacts = path.join(__dirname, "..", "artifacts");

test.beforeAll(() => {
  fs.mkdirSync(artifacts, { recursive: true });
});

async function passDay(request: any, baseURL: string, csrf: string, dayNum: number) {
  const day = await request.get(`${baseURL}/api/v1/camps/camp-v03/days/${dayNum}`);
  if (!day.ok()) return;
  const pkg = await day.json();
  const learn = pkg.learn || {};
  const capsules = (learn.capsules || []) as { id: string; practice?: unknown }[];
  for (const c of capsules) {
    await request.post(`${baseURL}/api/v1/capsules/progress`, {
      headers: { "X-CSRF-Token": csrf },
      data: { camp_id: "camp-v03", day: dayNum, capsule_id: c.id, learner_id: "ignored" },
    });
    if (c.practice) {
      await request.put(`${baseURL}/api/v1/practice`, {
        headers: { "X-CSRF-Token": csrf },
        data: {
          camp_id: "camp-v03",
          day: dayNum,
          capsule_id: c.id,
          response_text: "e2e practice",
          status: "submitted",
        },
      });
    }
  }
  for (const n of pkg.nodes as { id: string; kind: string }[]) {
    await request.post(`${baseURL}/api/v1/nodes/${encodeURIComponent(n.id)}/complete`, {
      headers: { "X-CSRF-Token": csrf },
      data: { camp_id: "camp-v03", day: dayNum },
    });
  }
}

test("learner Day13 k8s workbench", async ({ page, request, baseURL }) => {
  test.setTimeout(240_000);
  const login = await request.post(`${baseURL}/api/v1/auth/login`, {
    data: { email: "demo@fde.local", password: "demo1234", camp_id: "camp-v03" },
  });
  expect(login.ok()).toBeTruthy();
  const csrf = (await login.json()).csrf as string;

  for (let d = 1; d <= 12; d++) {
    await passDay(request, baseURL!, csrf, d);
  }

  const day = await request.get(`${baseURL}/api/v1/camps/camp-v03/days/13`);
  expect(day.ok()).toBeTruthy();
  const pkg = await day.json();
  expect(pkg.lab.runner).toBe("sim");
  expect(pkg.lab.sim_kind).toBe("k8s");

  const learn = (pkg.nodes as { id: string; kind: string }[]).find((n) => n.kind === "learn");
  const quiz = (pkg.nodes as { id: string; kind: string }[]).find((n) => n.kind === "quiz");
  for (const n of [learn!, quiz!].filter(Boolean)) {
    await request.post(`${baseURL}/api/v1/nodes/${encodeURIComponent(n.id)}/complete`, {
      headers: { "X-CSRF-Token": csrf },
      data: { camp_id: "camp-v03", day: 13 },
    });
  }

  await loginAsLearner(page);

  await page.goto("/app/day/13");
  await expect(page).toHaveURL(/\/app\/day\/13/);
  await page.getByRole("button", { name: /仿真集群中完成滚动发布/ }).click();
  await expect(page.getByText(/Kubernetes 实训运行在仿真对象图/)).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: /创建 Sim 会话|重建会话/ }).click();
  await expect(page.getByLabel("Kubernetes 仿真工作台")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/仿真集群 · 非真实 Kubernetes/)).toBeVisible();
  await expect(page.getByText(/deployment\.yaml/i).first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/kubectl apply/).first()).toBeVisible();

  await page.getByRole("button", { name: /kubectl apply/ }).first().click();
  await page.getByRole("button", { name: /kubectl rollout status/ }).first().click();
  await expect(page.getByText(/Ready/i).first()).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: "评测", exact: true }).click();
  await expect(page.getByText(/评测/).first()).toBeVisible({ timeout: 20_000 });
  const finish = page.getByRole("button", { name: /通过并完成/ });
  await expect(finish).toBeEnabled({ timeout: 20_000 });
  await finish.click();
  await expect(page.getByText(/Sim Lab 已完成|已完成/).first()).toBeVisible({ timeout: 20_000 });
  await page.screenshot({ path: path.join(artifacts, "learner-k8s-day13.png"), fullPage: true });
});
