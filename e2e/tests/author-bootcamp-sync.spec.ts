import { test, expect } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";
import { DEMO_LEARNER, loginAsAuthor } from "../fixtures/auth";

const artifacts = path.join(__dirname, "..", "artifacts", "author-bootcamp-sync");

test.beforeAll(() => {
  fs.mkdirSync(artifacts, { recursive: true });
});

test("author bootcamp sync: preview + apply day 6", async ({ page, request, baseURL }) => {
  test.setTimeout(120_000);
  await loginAsAuthor(page);

  const cookies = await page.context().cookies();
  const csrf = cookies.find((c) => c.name === "fde_csrf")?.value || "";
  const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
  const headers = { Cookie: cookieHeader, "X-CSRF-Token": csrf };

  const courses = await request.get(`${baseURL}/api/v1/author/courses?page=1&page_size=5`, { headers });
  const courseId = (await courses.json()).items?.[0]?.id as string;
  expect(courseId).toBeTruthy();

  const tag = `bootcamp-sync-${Date.now()}`;
  const form = new URLSearchParams();
  form.set("version_tag", tag);
  form.set("title", "Bootcamp sync E2E");
  form.set("camp_id", DEMO_LEARNER.campId);
  const created = await request.post(`${baseURL}/api/v1/author/courses/${courseId}/versions`, {
    headers: { ...headers, "Content-Type": "application/x-www-form-urlencoded" },
    data: form.toString(),
  });
  expect(created.ok()).toBeTruthy();
  const versionId = (await created.json()).course_version_id as string;

  const bootDays = await request.get(`${baseURL}/api/v1/author/bootcamp/days`, { headers });
  expect(bootDays.ok()).toBeTruthy();
  const items = (await bootDays.json()).items as number[];
  expect(items.length).toBeGreaterThan(0);
  expect(items).toContain(6);

  const preview = await request.post(
    `${baseURL}/api/v1/author/course-versions/${versionId}/sync-bootcamp`,
    {
      headers: { ...headers, "Content-Type": "application/json" },
      data: JSON.stringify({ days: [6], mode: "preview" }),
    },
  );
  expect(preview.ok()).toBeTruthy();
  const previewBody = await preview.json();
  expect(previewBody.changes?.length).toBeGreaterThan(0);

  const apply = await request.post(
    `${baseURL}/api/v1/author/course-versions/${versionId}/sync-bootcamp`,
    {
      headers: { ...headers, "Content-Type": "application/json" },
      data: JSON.stringify({ days: [6], mode: "apply" }),
    },
  );
  expect(apply.ok()).toBeTruthy();
  fs.writeFileSync(path.join(artifacts, "sync-result.json"), JSON.stringify(await apply.json(), null, 2));
});
