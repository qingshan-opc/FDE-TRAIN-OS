import { chromium } from "@playwright/test";
import fs from "node:fs";

const out = new URL("../artifacts/design-gate/", import.meta.url);
fs.mkdirSync(out, { recursive: true });
const base = process.env.FDE_E2E_BASE_URL || "http://127.0.0.1:8760";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

await page.goto(base + "/");
await page.getByRole("button", { name: "公开课" }).click();
await page.waitForTimeout(800);
await page.screenshot({ path: new URL("01-landing-open-courses.png", out).pathname, fullPage: true });

await page.goto(base + "/login");
await page.locator("#email").fill("demo@fde.local");
await page.locator("#password").fill("demo1234");
await page.locator("#camp").fill("camp-v03");
await page.getByRole("button", { name: "登录" }).click();
await page.waitForURL(/\/app/);
await page.waitForTimeout(500);
await page.screenshot({ path: new URL("02-course-picker.png", out).pathname, fullPage: true });

await page.getByRole("button", { name: /继续 ·|进入课程|开始学习/ }).first().click();
await page.waitForURL(/\/app$/);
await page.getByRole("button", { name: /^Day1\b/ }).first().click();
await page.waitForTimeout(800);
await page.screenshot({ path: new URL("03-learner-day1.png", out).pathname, fullPage: true });

await page.goto(base + "/login");
await page.locator("#email").fill("author@fde.local");
await page.locator("#password").fill("author1234");
await page.locator("#camp").fill("camp-v03");
await page.getByRole("button", { name: "登录" }).click();
await page.waitForURL(/\/author/);
await page.goto(base + "/author/open-courses");
await page.waitForTimeout(800);
await page.screenshot({ path: new URL("04-author-open-courses.png", out).pathname, fullPage: true });

await browser.close();
console.log("shots ok");
