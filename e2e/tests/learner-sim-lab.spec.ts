import { test, expect } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";
import { loginAsLearner } from "../fixtures/auth";

const artifacts = path.join(__dirname, "..", "artifacts");

test.beforeAll(() => {
  fs.mkdirSync(artifacts, { recursive: true });
});

// v0.7.4：Day 5 lab = 原生 server sim（终端实验台：命令行八句 + 启动周报助手）。
// Day 5 的 lab 被 learn+quiz 闸门锁定——先在 API 侧把闸门全部过完，再进 UI 做终端实战。
test("learner Day5 server sim terminal lab", async ({ page, request, baseURL }) => {
  test.setTimeout(300_000);
  const campId = "camp-v03";

  const login = await request.post(`${baseURL}/api/v1/auth/login`, {
    data: { email: "demo@fde.local", password: "demo1234", camp_id: campId },
  });
  expect(login.ok()).toBeTruthy();
  const csrf = (await login.json()).csrf as string;
  const authed = { headers: { "X-CSRF-Token": csrf } };
  const me = await request.get(`${baseURL}/api/v1/auth/me`);
  const learnerId = ((await me.json()).user?.id || (await me.json()).id) as string;

  const dayRes = await request.get(`${baseURL}/api/v1/camps/${campId}/days/5`);
  expect(dayRes.ok()).toBeTruthy();
  const pkg = await dayRes.json();
  expect(pkg.lab?.runner).toBe("sim");
  expect(pkg.lab?.sim_kind).toBe("server");

  // 1) 过 learn 闸：全部胶囊 opened + 必做练习 submitted
  const capsules = pkg.learn?.capsules || [];
  expect(capsules.length).toBeGreaterThan(0);
  for (const c of capsules) {
    await request.post(`${baseURL}/api/v1/capsules/progress`, {
      ...authed,
      data: { camp_id: campId, day: 5, capsule_id: c.id, learner_id: learnerId },
    });
    if (c.practice) {
      const r = await request.put(`${baseURL}/api/v1/practice`, {
        ...authed,
        data: { camp_id: campId, day: 5, capsule_id: c.id, response_text: "e2e 解锁：本节练习已完成", status: "submitted" },
      });
      expect(r.ok()).toBeTruthy();
    }
  }
  const learn = (pkg.nodes as { id: string; kind: string }[]).find((n) => n.kind === "learn")!;
  const learnDone = await request.post(`${baseURL}/api/v1/nodes/${encodeURIComponent(learn.id)}/complete`, {
    ...authed,
    data: { camp_id: campId, day: 5 },
  });
  expect(learnDone.ok(), "learn node should pass once capsules are opened and practices submitted").toBeTruthy();

  // 2) 过 quiz 闸：答案直接取自 day package
  const answers = (pkg.quiz?.questions || []).map((q: { answer?: number }) => q.answer ?? 0);
  expect(answers.length).toBe(18);
  const quizRes = await request.post(`${baseURL}/api/v1/quiz/submit`, {
    ...authed,
    data: { camp_id: campId, day: 5, node_id: "d5-quiz", answers },
  });
  expect(quizRes.ok()).toBeTruthy();
  const quizBody = await quizRes.json();
  expect(quizBody.pass ?? quizBody.passed).toBeTruthy();

  // 3) UI：进 lab，创建会话，敲完八句 + 启动 + 验证，评测通过
  await loginAsLearner(page);
  await page.goto("/app/day/5");
  await expect(page).toHaveURL(/\/app\/day\/5/);
  await page.getByRole("button", { name: /终端实验台：命令行八句/ }).click();
  await expect(page.getByRole("heading", { name: /终端实验台：命令行八句/ })).toBeVisible();

  await page.getByRole("button", { name: /创建 Sim 会话|重建会话/ }).click();
  await expect(page.getByRole("heading", { name: "终端" })).toBeVisible({ timeout: 15_000 });
  // 任务说明来自 lab.task_brief
  await expect(page.getByText(/任务：在这台仿真服务器上把「周报助手」跑起来并验证/)).toBeVisible();

  for (const c of [
    "pwd",
    "ls -l",
    "mkdir -p app/logs",
    "cd app",
    "python3 server.py",
    "curl localhost:8000/healthz",
    "tail -f logs/server.log",
    "chmod +x deploy.sh",
    "docker ps",
  ]) {
    // 快捷按钮只负责「填入」，学员自己回车执行（不许代敲）
    await page.getByRole("button", { name: c, exact: true }).click();
    await page.locator("#sim-cmd").press("Enter");
    await expect(page.locator(".sim-terminal")).toContainText(c, { timeout: 10_000 });
  }
  await expect(page.locator(".sim-terminal")).toContainText("200", { timeout: 10_000 });
  await expect(page.locator(".sim-terminal")).toContainText("weekbot", { timeout: 10_000 });

  await page.getByRole("button", { name: "评测", exact: true }).click();
  await expect(page.getByText(/评测通过/).first()).toBeVisible({ timeout: 15_000 });
  await page.screenshot({ path: path.join(artifacts, "learner-sim-day5.png"), fullPage: true });

  // 4) 完成节点（可选：通过并完成按钮在评测通过后可用）
  const finish = page.getByRole("button", { name: "通过并完成", exact: true });
  if (await finish.isEnabled()) {
    await finish.click();
    await expect(page.getByText(/Sim Lab 已完成|已完成/).first()).toBeVisible({ timeout: 15_000 });
  }
});
