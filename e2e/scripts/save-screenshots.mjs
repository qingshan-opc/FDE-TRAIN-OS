#!/usr/bin/env node
/**
 * Capture baseline screenshots into e2e/artifacts/.
 * Requires API at FDE_E2E_BASE_URL (default http://127.0.0.1:8760).
 */
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const out = path.join(root, "artifacts");
const base = process.env.FDE_E2E_BASE_URL || "http://127.0.0.1:8760";

fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

await page.goto(`${base}/app/`);
await page.screenshot({ path: path.join(out, "smoke-login.png"), fullPage: true });

await page.locator("#btn-login").click();
await page.waitForSelector("#app-view:not(.hidden)", { timeout: 20_000 }).catch(() => undefined);
await page.screenshot({ path: path.join(out, "smoke-app.png"), fullPage: true });

await page.goto(`${base}/author/`);
await page.screenshot({ path: path.join(out, "smoke-author.png"), fullPage: true });

await browser.close();
console.log(`screenshots written to ${out}`);
