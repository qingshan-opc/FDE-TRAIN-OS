#!/usr/bin/env node
/**
 * Post-build gate: Monaco / xterm must live in dedicated async chunks,
 * not in the main entry bundle.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const assetsDir = path.join(root, "..", "dist", "assets");

if (!fs.existsSync(assetsDir)) {
  console.error("check-chunk-split: dist/assets missing — run vite build first");
  process.exit(1);
}

const files = fs.readdirSync(assetsDir);
const jsFiles = files.filter((f) => f.endsWith(".js"));
const indexFile = jsFiles.find((f) => f.startsWith("index-"));
const monacoFile = jsFiles.find((f) => f.startsWith("monaco-"));
const xtermFile = jsFiles.find((f) => f.startsWith("xterm-"));

const errors = [];

if (!indexFile) errors.push("missing index-*.js entry chunk");
if (!monacoFile) errors.push("missing monaco-*.js async chunk");
if (!xtermFile) errors.push("missing xterm-*.js async chunk");

if (indexFile) {
  const indexSrc = fs.readFileSync(path.join(assetsDir, indexFile), "utf8");
  const forbidden = ["monaco-editor/esm", "monaco-editor/min", "@xterm/xterm"];
  for (const needle of forbidden) {
    if (indexSrc.includes(needle)) {
      errors.push(`entry chunk ${indexFile} embeds ${needle}`);
    }
  }
}

if (errors.length) {
  console.error("check-chunk-split failed:\n" + errors.map((e) => `  - ${e}`).join("\n"));
  process.exit(1);
}

console.log(
  `check-chunk-split ok: entry=${indexFile}, monaco=${monacoFile}, xterm=${xtermFile}`,
);
