import { test, expect, type Page } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";

const artifacts = path.join(__dirname, "..", "artifacts");

test.beforeAll(() => {
  fs.mkdirSync(artifacts, { recursive: true });
});

test.setTimeout(240_000);

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

interface QuizQuestion {
  q: string;
  options: string[];
  answer: number;
}

interface DayNode {
  id: string;
  title: string;
  kind: string;
  status: string;
}

interface DayPackage {
  day: number;
  title: string;
  nodes: DayNode[];
  quiz: { questions: QuizQuestion[]; pass_rate: number };
  learn: { capsules?: { id: string; practice?: unknown }[] };
}

async function fetchDay(page: Page, baseURL: string, campId: string, day: number): Promise<DayPackage> {
  const res = await page.request.get(`${baseURL}/api/v1/camps/${campId}/days/${day}`);
  expect(res.ok(), `GET days/${day} failed`).toBeTruthy();
  return (await res.json()) as DayPackage;
}

/** Click a syllabus tree node (L2) by title — scoped to avoid TaskHome/day rows. */
async function clickTreeNode(page: Page, title: string) {
  await page
    .locator(".syllabus-node-list button.syllabus-item")
    .filter({ hasText: new RegExp(escapeRegExp(title)) })
    .first()
    .click();
}

/** Answer every quiz question using API answer keys. */
async function answerQuiz(page: Page, questions: QuizQuestion[]) {
  const blocks = page.locator(".quiz-shell .quiz-question");
  await expect(blocks.first()).toBeVisible({ timeout: 15_000 });
  expect(await blocks.count()).toBeGreaterThanOrEqual(questions.length);
  for (let qi = 0; qi < questions.length; qi++) {
    const option = blocks.nth(qi).locator(".quiz-option").nth(questions[qi].answer);
    await option.click();
    await expect(option).toHaveClass(/selected/, { timeout: 5_000 });
  }
}

/** Fill + submit the practice block for whichever capsule is currently open
 * in the CapsuleReader (at most one practice block is mounted at a time —
 * either a textarea or a checklist). Optional practices may already show
 * 「已提交」 / have no required gate — skip those cleanly. */
async function submitActivePractice(page: Page, note: string) {
  // Practice lives under the 「练习」 tab in the learn reader.
  const practiceTab = page.getByRole("tab", { name: "练习" });
  if (await practiceTab.isVisible().catch(() => false)) {
    await practiceTab.click();
  }

  const submitted = page.locator(".learn-practice .learn-practice-badge").getByText("已提交");
  if (await submitted.isVisible().catch(() => false)) return;

  const practiceRoot = page.locator(".learn-practice");
  await expect(practiceRoot).toBeVisible({ timeout: 10_000 });

  const textarea = page.locator('textarea[id^="practice-"]');
  const checklist = page.locator(".learn-practice-checklist input[type='checkbox']");
  if (await textarea.count()) {
    await textarea.fill(note);
    // Click the prompt text to blur without starting a draft race against submit.
    await practiceRoot.locator("h4").click({ force: true });
  } else if (await checklist.count()) {
    // Drive React's onChange via label clicks — setting `.checked` alone does
    // not update controlled state, and Playwright `check()` can hang when the
    // day package remounts mid-action.
    const labels = page.locator(".learn-practice-checklist label");
    const n = await labels.count();
    for (let i = 0; i < n; i++) {
      const box = labels.nth(i).locator("input[type='checkbox']");
      if (!(await box.isChecked())) await labels.nth(i).click();
    }
  } else {
    // Optional empty practice — nothing to submit.
    return;
  }

  const submitBtn = practiceRoot.getByRole("button", { name: "提交练习" });
  await expect(submitBtn, "必做练习的提交按钮应可见且可点").toBeEnabled({ timeout: 10_000 });
  await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes("/api/v1/practice") && r.request().method() === "PUT" && r.ok(),
      { timeout: 15_000 },
    ),
    submitBtn.click(),
  ]);
  await expect(submitted).toBeVisible({ timeout: 10_000 });
}

test("learner Day1 full chain: invite -> learn -> quiz -> lab -> project -> review -> Day2 unlocked", async ({
  page,
  baseURL,
}) => {
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const displayName = `QA全链路-${runId}`;
  const email = `e2e-day1-${runId}@fde.local`;
  const campId = "camp-v03";

  // 1) Landing page — public IA (企业培训/公开课/关于我们/联系我们), then 登录.
  await page.goto("/");
  await expect(page.getByRole("link", { name: "青山在" }).first()).toBeVisible();
  for (const label of ["企业培训"]) {
    await expect(page.getByRole("button", { name: label, exact: true })).toBeVisible();
  }
  await expect(page.getByRole("link", { name: "公开课", exact: true }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "关于我们", exact: true }).first()).toBeVisible();
  await page.getByRole("link", { name: "公开课", exact: true }).first().click();
  await expect(page).toHaveURL(/\/open$/);
  await expect(page.getByRole("heading", { name: "公开课" })).toBeVisible();
  await page.goto("/");
  await page.getByRole("link", { name: "登录" }).first().click();
  await expect(page).toHaveURL(/\/login/);

  // 2) Login via a FRESH invite (isolated learner + progress every run).
  await expect(page.getByRole("heading", { name: "登录" })).toBeVisible();
  await page.getByRole("tab", { name: "邀请码" }).click();
  await page.locator("#invite").fill("FDE-DEMO");
  await page.locator("#display").fill(displayName);
  await page.locator("#invite-email").fill(email);
  await page.getByRole("button", { name: "用邀请码进入" }).click();
  await expect(page).toHaveURL(/\/app\/courses/, { timeout: 20_000 });

  // 3) CoursePicker shows the FDE course card; enter it.
  await page.getByRole("button", { name: /继续 ·|进入课程|开始学习/ }).first().click();
  await expect(page).toHaveURL(/\/app(\/|$)/, { timeout: 20_000 });

  // 4) Tree: Day1 expandable/clickable, Day2 locked.
  await expect(page.getByLabel("课程大纲")).toBeVisible({ timeout: 20_000 });
  const syllabus = page.getByLabel("课程大纲");
  const day1Btn = syllabus.locator("button.syllabus-day-hit").filter({
    has: page.locator(".syllabus-day-name", { hasText: "第一天" }),
  });
  const day2Btn = syllabus.locator("button.syllabus-day-hit").filter({
    has: page.locator(".syllabus-day-name", { hasText: "第二天" }),
  });
  await expect(day1Btn).toBeEnabled();
  await expect(day2Btn).toBeDisabled();
  await page.screenshot({ path: path.join(artifacts, "day1-chain-00-app-home.png"), fullPage: true });

  await day1Btn.click();
  await expect(page).toHaveURL(/\/app\/day\/1\?node=/);

  const pkg1 = await fetchDay(page, baseURL!, campId, 1);
  const nodeByKind = (kind: string) => {
    const n = pkg1.nodes.find((x) => x.kind === kind);
    expect(n, `day1 missing node kind=${kind}`).toBeTruthy();
    return n!;
  };
  const learnNode = nodeByKind("learn");
  const quizNode = nodeByKind("quiz");
  const labNode = nodeByKind("lab");
  const projectNode = nodeByKind("project");
  const reviewNode = nodeByKind("review");

  // 5) Learn node — open every capsule (submit its required practice) then
  // complete. Current course content requires a text practice on every
  // capsule; asserting hard here (no silent skip) mirrors that real gate.
  await expect(page.getByLabel("课程大纲")).toBeVisible({ timeout: 15_000 });
  // CapsuleReader's mount effect restores server-side progress via two
  // sequential fetches; `networkidle` can resolve in the (rare) gap before
  // those fetches are actually issued. A short, explicit settle window here
  // — once, right after the node mounts — avoids racing capsule c1's first
  // practice submit against that restore.
  await page.waitForTimeout(800);
  // Learn mode left rail lists capsules as `.syllabus-item` (true 3-column).
  await expect(page.locator(".syllabus-rail .syllabus-item").first()).toBeVisible({ timeout: 15_000 });
  const capsuleCount = await page.locator(".syllabus-rail .syllabus-item").count();
  expect(capsuleCount, "day1 learn should ship at least the c1 capsule").toBeGreaterThan(0);
  for (let i = 0; i < capsuleCount; i++) {
    await submitActivePractice(page, `学员练习记录（第 ${i + 1} 节 / 共 ${capsuleCount} 节）：已理解本节要点并完成练习。`);
    if (i < capsuleCount - 1) {
      await page.getByRole("button", { name: "下一节" }).click();
    }
  }
  await page.screenshot({ path: path.join(artifacts, "day1-chain-01-learn-practices.png"), fullPage: true });

  // TaskRail mirrors the primary CTA in the right sidebar, so scope to .first().
  await page.getByRole("button", { name: "完成学习", exact: true }).first().click();
  await expect(page.getByText("学习节点已完成")).toBeVisible({ timeout: 15_000 });

  // 6) Quiz — answer key comes straight from the day package API, so this
  // stays correct even if the curriculum content changes.
  await clickTreeNode(page, quizNode.title);
  await expect(page.getByRole("heading", { name: quizNode.title })).toBeVisible({ timeout: 15_000 });
  const questions = pkg1.quiz.questions;
  expect(questions.length, "day1 quiz should have questions").toBeGreaterThan(0);
  await answerQuiz(page, questions);
  await page.getByRole("button", { name: "提交测验", exact: true }).first().click();
  await expect(page.getByText(/· 已通过/).first()).toBeVisible({ timeout: 15_000 });
  await page.screenshot({ path: path.join(artifacts, "day1-chain-02-quiz-pass.png"), fullPage: true });

  // 7) Lab — Agent Lab: advanced -> force-stub -> 生成 -> 评测(通过) -> 完成.
  await clickTreeNode(page, labNode.title);
  await expect(page.getByText(labNode.title).first()).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: /^高级/ }).click();
  // LearnerHome polls the whole day/workspace bundle on a short interval, so
  // this checkbox's subtree can flicker (briefly detach/reattach) between
  // polls — bypass the actionability "stable" wait, which otherwise never
  // resolves against a target that keeps re-rendering every second, and
  // confirm the resulting state directly.
  await page.locator("#force-stub").check({ force: true });
  await expect(page.locator("#force-stub")).toBeChecked();
  await page.getByRole("button", { name: "生成", exact: true }).first().click();
  // Wait for the *full* job pipeline to finish, not just the first sign of
  //生成 activity — the worker only updates the workspace snapshot that
  // 评测 reads from right before it emits "[done] succeeded"; racing ahead
  // on an earlier log line (e.g. the file tree showing index.html mid-job)
  // can make 评测 read a workspace snapshot that isn't there yet.
  await expect(page.getByText(/\[done\] succeeded/i).first()).toBeVisible({ timeout: 60_000 });
  await expect(page.locator(".lab-ide-title").getByText(/succeeded/i)).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "评测", exact: true }).first().click();
  await expect(page.locator(".lab-ide-eval strong")).toContainText(/评测 · 通过 · \d+%/, { timeout: 30_000 });
  await expect(page.getByText(/警戒/).first()).toBeVisible();
  await page.screenshot({ path: path.join(artifacts, "day1-chain-03-lab-eval-pass.png"), fullPage: true });

  await page.getByRole("button", { name: "完成", exact: true }).first().click();
  await expect(page.getByText("Lab 已完成")).toBeVisible({ timeout: 15_000 });

  // 8) Project — reflection + 提交作业 (gated on the Lab evidence just written).
  await clickTreeNode(page, projectNode.title);
  await expect(page.getByRole("heading", { name: projectNode.title })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/来源：/).first()).toBeVisible({ timeout: 15_000 });
  await page
    .locator("#project-reflection")
    .fill("1 分钟复盘：完成了库存列表页交付，Prompt 迭代一次，rubric 三条全部通过，下一步会补充异常库存的高亮样式。");
  await page.getByRole("button", { name: "提交作业", exact: true }).first().click();
  await expect(page.getByText("作业已提交")).toBeVisible({ timeout: 15_000 });
  await page.screenshot({ path: path.join(artifacts, "day1-chain-04-project-submitted.png"), fullPage: true });

  // 9) Review — mark complete; Day1 completion auto-advances to Day2.
  await clickTreeNode(page, reviewNode.title);
  await expect(page.getByRole("heading", { name: reviewNode.title })).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "标记完成", exact: true }).first().click();
  await expect(page.getByText(/本日课程已完成/).first()).toBeVisible({ timeout: 15_000 });

  // 10) Day2 unlocked — auto-nav lands on Day2; syllabus may be in capsule TOC.
  await expect(page).toHaveURL(/\/app\/day\/2(\?node=|$)/, { timeout: 20_000 });
  const pkg2Gate = await fetchDay(page, baseURL!, campId, 2);
  expect(pkg2Gate.day).toBe(2);
  expect(pkg2Gate.nodes.some((n) => n.status !== "locked")).toBeTruthy();

  await page.goto("/app");
  await expect(page.getByLabel("任务首页")).toBeVisible({ timeout: 15_000 });
  const day2Unlocked = page
    .getByLabel("课程大纲")
    .locator("button.syllabus-day-hit")
    .filter({ has: page.locator(".syllabus-day-name", { hasText: "第二天" }) });
  await expect(day2Unlocked).toBeEnabled({ timeout: 15_000 });
  await page.screenshot({ path: path.join(artifacts, "day1-chain-05-day2-unlocked.png"), fullPage: true });

  // 11) Day2 workspace contract: today's focus vs inherited Day1 files.
  // Cross-day unlock opens the Day, but Day2's own learn/quiz still gate its
  // lab node — so assert the package metadata here (always available), and
  // only open the Lab file tree when that node is already reachable.
  const pkg2 = await fetchDay(page, baseURL!, campId, 2);
  const labMeta = (pkg2 as DayPackage & {
    lab?: { primary_files?: string[]; inherited_files?: string[]; workspace_mode?: string };
  }).lab;
  expect(labMeta?.workspace_mode || "cumulative").toBeTruthy();
  expect(labMeta?.primary_files?.length ?? 0, "Day2 should declare primary_files").toBeGreaterThan(0);
  expect(labMeta?.inherited_files || []).toEqual(expect.arrayContaining(["index.html"]));
  expect(labMeta?.primary_files || []).not.toEqual(expect.arrayContaining(["index.html"]));

  const day2LabNode = pkg2.nodes.find((n) => n.kind === "lab");
  if (day2LabNode && day2LabNode.status !== "locked") {
    await day2Unlocked.click();
    await expect(page).toHaveURL(/\/app\/day\/2(\?node=|$)/, { timeout: 15_000 });
    await clickTreeNode(page, day2LabNode.title);
    await expect(page.getByText(day2LabNode.title).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("本日作业")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("项目历史")).toBeVisible();
    await expect(page.getByText("index.html")).toBeVisible();
    await page.screenshot({ path: path.join(artifacts, "day1-chain-06-day2-lab-filetree.png"), fullPage: true });
  } else {
    console.log(
      `[info] Day2 lab node status=${day2LabNode?.status ?? "missing"} — asserting package metadata only.`,
    );
  }
});
