import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.FDE_E2E_BASE_URL || "http://127.0.0.1:8760";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  outputDir: "test-results",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    locale: "zh-CN",
  },
  // Release gate runs Chromium. Firefox/WebKit are opt-in via
  // `npx playwright test --project=firefox` once browsers are installed.
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
    ...(process.env.FDE_E2E_ALL_BROWSERS === "1"
      ? [
          {
            name: "firefox",
            use: { ...devices["Desktop Firefox"], viewport: { width: 1280, height: 720 } },
          },
          {
            name: "webkit",
            use: { ...devices["Desktop Safari"], viewport: { width: 1280, height: 720 } },
          },
        ]
      : []),
  ],
});
