import { test, expect } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";

const artifacts = path.join(__dirname, "..", "artifacts");

test.beforeAll(() => {
  fs.mkdirSync(artifacts, { recursive: true });
});

test("learner cannot use author APIs or author UI", async ({ page, request, baseURL }) => {
  const login = await request.post(`${baseURL}/api/v1/auth/login`, {
    data: {
      email: "demo@fde.local",
      password: "demo1234",
      camp_id: "camp-v03",
    },
  });
  expect(login.ok()).toBeTruthy();
  const body = await login.json();
  const token = body.token as string;
  expect(token).toBeTruthy();

  const evidence = await request.get(`${baseURL}/api/v1/author/evidence`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(evidence.status()).toBe(403);

  const upload = await request.post(`${baseURL}/api/v1/author/contracts/upload`, {
    headers: { Authorization: `Bearer ${token}` },
    multipart: {
      file: {
        name: "day-01.yaml",
        mimeType: "application/yaml",
        buffer: Buffer.from("day: 1\n"),
      },
    },
  });
  expect([401, 403]).toContain(upload.status());

  // Browser: learner cookie session should be redirected away from /author
  await page.goto("/login");
  await page.locator("#email").fill("demo@fde.local");
  await page.locator("#password").fill("demo1234");
  await page.getByRole("button", { name: /登\s*录/ }).click();
  await expect(page).toHaveURL(/\/app/, { timeout: 20_000 });
  await page.goto("/author/");
  await expect(page).toHaveURL(/\/(app|login)/, { timeout: 15_000 });
  await page.screenshot({ path: path.join(artifacts, "permissions-learner-author.png"), fullPage: true });
});
