#!/usr/bin/env node
/**
 * Verify each slide of section-05 and section-06:
 * - images actually loaded (naturalWidth > 0)
 * - slide-body fits within 1080px height (no overflow)
 * - key text content present
 */
import pkg from "playwright";
const { chromium } = pkg;

const BASE = "/Users/qingjiu/workspace/research/digital-fde-platform/class/bootcamp/day-06";

const sections = [
  { id: "s2", dir: "section-02-token-window-hallucination", count: 6 },
  { id: "s3", dir: "section-03-prompt-context-rag", count: 6 },
  { id: "s4", dir: "section-04-eval-guardrails-vibe", count: 6 },
  { id: "s5", dir: "section-05-agent-harness-mcp", count: 7 },
  { id: "s6", dir: "section-06-accept-18words", count: 5 },
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

for (const sec of sections) {
  const filePath = `${BASE}/${sec.dir}/video/index.html`;
  const fileUrl = `file://${filePath}?_t=${Date.now()}`;
  console.log(`\n=== ${sec.id} : ${sec.dir} ===`);
  await page.goto(fileUrl, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => document.documentElement.classList.add("browser-preview"));
  await page.waitForTimeout(2500);

  for (let i = 0; i < sec.count; i++) {
    const report = await page.evaluate(() => {
      const all = Array.from(document.querySelectorAll("section.slide"));
      // Handle both nav styles: opacity-based (s5/s6 simple) and visibility-based (s2-s4 GSAP)
      const visible = all.find(s => s.style.visibility !== "hidden" && getComputedStyle(s).visibility !== "hidden")
        || all.find(s => s.style.opacity === "1" || getComputedStyle(s).opacity === "1")
        || all[0];
      if (!visible) return { error: "no visible slide" };
      const id = visible.id;
      const h1 = visible.querySelector("h1.display");
      const h1Text = h1 ? h1.innerText.replace(/\n/g, " / ").slice(0, 80) : "(none)";
      const imgs = Array.from(visible.querySelectorAll("img"));
      const imgInfo = imgs.map(img => ({
        src: img.src.split("/").slice(-2).join("/"),
        natW: img.naturalWidth,
        ok: img.naturalWidth > 0,
      }));
      const body = visible.querySelector(".slide-body");
      const bodyBox = body ? body.getBoundingClientRect() : null;
      const bodyBottom = bodyBox ? Math.round(bodyBox.bottom) : null;
      const overflow = bodyBox ? bodyBox.bottom > 1010 : null;
      return { id, h1Text, imgs: imgInfo, bodyBottom, overflow };
    });
    console.log(`  [${i + 1}/${sec.count}] ${report.id || "???"} | h1: "${report.h1Text}"`);
    if (report.imgs.length === 0) {
      console.log(`     (no img)`);
    } else {
      report.imgs.forEach(im => {
        console.log(`     img ${im.src} natW=${im.natW} ${im.ok ? "OK" : "FAILED"}`);
      });
    }
    console.log(`     bodyBottom=${report.bodyBottom} overflow=${report.overflow}`);
    if (i < sec.count - 1) {
      await page.keyboard.press("ArrowRight");
      await page.waitForTimeout(400);
    }
  }
}

await browser.close();
console.log("\nVerification done.");
