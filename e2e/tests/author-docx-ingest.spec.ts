import { test, expect } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { goAuthorLeaf, loginAsAuthor } from "../fixtures/auth";

const artifacts = path.join(__dirname, "..", "artifacts");

test.beforeAll(() => {
  fs.mkdirSync(artifacts, { recursive: true });
});

function makeDocx(outPath: string) {
  const root = path.join(__dirname, "..", "..");
  const py = path.join(root, ".venv", "bin", "python");
  execFileSync(
    py,
    [
      "-c",
      `
from docx import Document
from pathlib import Path
d=Document(); d.add_paragraph('Playwright DOCX ingest smoke')
Path(${JSON.stringify(outPath)}).parent.mkdir(parents=True, exist_ok=True)
d.save(${JSON.stringify(outPath)})
`,
    ],
    { stdio: "pipe" },
  );
}

test("author upload DOCX and see ingest status", async ({ page }) => {
  test.setTimeout(180_000);
  const docx = path.join(artifacts, `playwright-day1-${Date.now()}.docx`);
  makeDocx(docx);

  await loginAsAuthor(page);
  await goAuthorLeaf(page, "资源", "文档库");
  await expect(page).toHaveURL(/\/author\/resources\/documents/);
  await expect(page.getByRole("heading", { name: /文档库/ })).toBeVisible();
  await expect(page.locator(".ant-table")).toBeVisible();

  await page.getByRole("button", { name: "上传文档" }).click();
  await expect(page.getByRole("dialog", { name: "上传文档" })).toBeVisible();
  await page.locator(".ant-modal").locator('input[type="file"]').setInputFiles(docx);
  await expect(page.getByText(/上传成功|ready|queued|ingesting|扫描/i).first()).toBeVisible({
    timeout: 30_000,
  });

  await expect(page.getByText(/ready|失败|failed|offline|queued|ingesting/i).first()).toBeVisible({
    timeout: 120_000,
  });
  await page.screenshot({ path: path.join(artifacts, "author-docx-ingest.png"), fullPage: true });
});
