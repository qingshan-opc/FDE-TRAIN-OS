import { expect, type APIRequestContext, type Page } from "@playwright/test";

export const DEMO_LEARNER = {
  email: "demo@fde.local",
  password: "demo1234",
  campId: "camp-v03",
} as const;

export const DEMO_AUTHOR = {
  email: "author@fde.local",
  password: "author1234",
} as const;

export async function getCsrfToken(page: Page): Promise<string> {
  const csrf = (await page.context().cookies()).find((c) => c.name === "fde_csrf")?.value;
  if (!csrf) throw new Error("missing fde_csrf cookie — login first");
  return csrf;
}

export async function apiPost(page: Page, url: string, data: unknown) {
  const csrf = await getCsrfToken(page);
  return page.request.post(url, { data, headers: { "X-CSRF-Token": csrf } });
}

export async function apiLogin(
  request: APIRequestContext,
  baseURL: string,
  account: { email: string; password: string; campId?: string },
) {
  const res = await request.post(`${baseURL}/api/v1/auth/login`, {
    data: {
      email: account.email,
      password: account.password,
      camp_id: account.campId,
    },
  });
  expect(res.ok()).toBeTruthy();
  const body = (await res.json()) as { csrf?: string; token?: string };
  return body;
}

/** Login demo learner; enter workbench from course picker when redirected. */
export async function loginAsLearner(page: Page) {
  await page.goto("/login");
  await page.locator("#email").fill(DEMO_LEARNER.email);
  await page.locator("#password").fill(DEMO_LEARNER.password);
  await page.locator("#camp").fill(DEMO_LEARNER.campId);
  await page.getByRole("button", { name: "登录" }).click();
  await expect(page).toHaveURL(/\/app/, { timeout: 20_000 });
  if (/\/app\/courses/.test(page.url())) {
    await page.getByRole("button", { name: /继续 ·|进入课程|开始学习/ }).first().click();
    await expect(page).toHaveURL(/\/app(\/|$)/, { timeout: 20_000 });
  }
}

/** Login demo author into `/author`. */
export async function loginAsAuthor(page: Page) {
  await page.goto("/login");
  await page.locator("#email").fill(DEMO_AUTHOR.email);
  await page.locator("#password").fill(DEMO_AUTHOR.password);
  await page.getByRole("button", { name: "登录" }).click();
  await expect(page).toHaveURL(/\/author/, { timeout: 20_000 });
}

/** Navigate author Ant Design side menu to a leaf item. */
export async function goAuthorLeaf(page: Page, group: string, leaf: string) {
  const menu = page.locator(".author-side-menu");
  const submenu = menu.locator(".ant-menu-submenu").filter({ hasText: group });
  if (await submenu.count()) {
    const title = submenu.first().locator(".ant-menu-submenu-title");
    const isOpen = await submenu.first().evaluate((el) => el.classList.contains("ant-menu-submenu-open"));
    if (!isOpen) await title.click();
  } else {
    await menu.getByText(group, { exact: false }).first().click();
  }
  const leafItem = menu.locator(".ant-menu-item, .ant-menu-submenu .ant-menu-item").filter({ hasText: leaf });
  if (!(await leafItem.first().isVisible().catch(() => false))) {
    await menu.locator(".ant-menu-submenu-title").filter({ hasText: group }).first().click();
  }
  await expect(leafItem.first()).toBeVisible({ timeout: 10_000 });
  await leafItem.first().click();
}

/** Open Day N from syllabus tree on workbench home. */
export async function openDayFromSyllabus(page: Page, dayLabel: string) {
  await page
    .locator("button.syllabus-day-hit")
    .filter({ has: page.locator(".syllabus-day-name", { hasText: dayLabel }) })
    .first()
    .click();
}
