#!/usr/bin/env node
/**
 * FDE Learning OS — Windows 一键开发启动器。
 *
 * 依次拉起：PostgreSQL(5433) → S3 模拟 moto(9000) → 迁移 → API(8760) → worker → Vite(web/)。
 * 原 scripts/start.sh 面向 Linux/macOS（.venv/bin、lsof），Windows 下不可直接用，
 * 本脚本为其 Windows 等价物。CLI 透传：`npm run dev -- --host 0.0.0.0 --port 7100`
 * 会把 host/port 转发给 Vite。
 *
 * 说明：
 * - PostgreSQL 以低权限本地用户 fdepg 运行（postgres 拒绝以管理员身份启动），
 *   密码仅用于本机开发数据库，见 scripts/dev.mjs 内 PGPASS_LOCAL。
 * - C:\fde-pgbin / C:\fde-pgdata 是指向工作区内的目录联接（junction），
 *   因 PostgreSQL 在含中文路径下无法初始化/启动；数据实体仍在工作区 data/pgdata。
 */
import { spawn, spawnSync } from "node:child_process";
import net from "node:net";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BACKEND = path.join(ROOT, "backend");
const PY = path.join(ROOT, ".venv", "Scripts", "python.exe");
const MOTO = path.join(ROOT, ".venv", "Scripts", "moto_server.exe");
const WEB = path.join(ROOT, "web");
const NPM = [
  process.env.FDE_NPM,
  "C:\\Users\\Administrator\\AppData\\Local\\Programs\\kimi-desktop\\resources\\resources\\runtime\\npm.cmd",
  "C:\\Program Files\\nodejs\\npm.cmd",
].find((p) => p && fs.existsSync(p)) || "npm.cmd";
const PG_BIN = "C:\\fde-pgbin\\bin";
const PG_ISREADY = path.join(PG_BIN, "pg_isready.exe");
const PG_DATA = "C:\\fde-pgdata";
const PG_REAL_DATA = path.join(ROOT, "data", "pgdata");
const PG_INSTALL = path.join(ROOT, ".venv", "Lib", "site-packages", "pgserver", "pginstall");
const PGPASS_LOCAL = "FdePg!2026x"; // 本机 dev 数据库专用低权限账号密码

const API_PORT = process.env.FDE_API_PORT || "8760";
const PG_PORT = 5433;
const S3_PORT = 9000;

const children = [];
function run(cmd, args, opts = {}) {
  const p = spawn(cmd, args, { stdio: "inherit", windowsHide: true, ...opts });
  children.push(p);
  return p;
}
function killTree(pid) {
  try { spawnSync("taskkill", ["/T", "/F", "/PID", String(pid)], { stdio: "ignore", windowsHide: true }); } catch {}
}
function shutdown(code = 0) {
  for (const p of children.splice(0)) if (p.pid) killTree(p.pid);
  process.exit(code);
}
process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
process.on("exit", () => { for (const p of children) if (p.pid) killTree(p.pid); });

function waitPort(port, host = "127.0.0.1", timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const tryOnce = () => {
      const s = net.connect(port, host);
      s.once("connect", () => { s.end(); resolve(); });
      s.once("error", () => {
        s.destroy();
        if (Date.now() > deadline) reject(new Error(`port ${port} not ready`));
        else setTimeout(tryOnce, 500);
      });
    };
    tryOnce();
  });
}
const isListening = (port) => waitPort(port, "127.0.0.1", 800).then(() => true, () => false);

async function waitPostgresReady(timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() <= deadline) {
    const probe = spawnSync(
      PG_ISREADY,
      ["-h", "127.0.0.1", "-p", String(PG_PORT)],
      { stdio: "ignore", windowsHide: true },
    );
    if (probe.status === 0) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`postgres :${PG_PORT} not ready`);
}

/** 轮询直到 HTTP 200 —— 用于等 API 完全就绪后再放前端，避免 vite 代理 ECONNREFUSED 返回 500。 */
async function waitHttpOk(url, timeoutMs = 120000) {
  const http = await import("node:http");
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const tryOnce = () => {
      const req = http.get(url, (res) => {
        res.resume();
        if (res.statusCode === 200) resolve();
        else retry();
      });
      req.on("error", retry);
      req.setTimeout(3000, () => req.destroy(new Error("timeout")));
      function retry() {
        if (Date.now() > deadline) reject(new Error(`${url} not ready`));
        else setTimeout(tryOnce, 1000);
      }
    };
    tryOnce();
  });
}

function ensureJunction(link, target) {
  if (fs.existsSync(path.join(link, "bin", "pg_ctl.exe"))) return; // pgbin 已就绪
  if (link.endsWith("pgdata") && fs.existsSync(path.join(link, "PG_VERSION"))) return;
  try { spawnSync("cmd", ["/c", "rmdir", link], { stdio: "ignore", windowsHide: true }); } catch {}
  const r = spawnSync("cmd", ["/c", "mklink", "/J", link, target], { stdio: "inherit", windowsHide: true });
  if (r.status !== 0) throw new Error(`mklink /J ${link} -> ${target} failed`);
}

async function ensurePostgres() {
  ensureJunction("C:\\fde-pgbin", PG_INSTALL);
  ensureJunction("C:\\fde-pgdata", PG_REAL_DATA);
  if (await isListening(PG_PORT)) {
    await waitPostgresReady();
    console.log("[fde] postgres already up :5433");
    return;
  }
  console.log("[fde] starting postgres :5433 (as local user fdepg) ...");
  const ps = [
    "$pw = ConvertTo-SecureString '" + PGPASS_LOCAL + "' -AsPlainText -Force;",
    "$cred = New-Object System.Management.Automation.PSCredential('fdepg', $pw);",
    `$pgArgs = 'start -D ${PG_DATA} -o "-p 5433 -h 127.0.0.1" -l ${PG_DATA}\\server.log';`,
    `Start-Process -FilePath '${PG_BIN}\\pg_ctl.exe' -ArgumentList $pgArgs -Credential $cred -WindowStyle Hidden`,
  ].join(" ");
  spawnSync("C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe",
    ["-NoProfile", "-Command", ps], { stdio: "inherit", windowsHide: true, timeout: 90000 });
  await waitPostgresReady();
  console.log("[fde] postgres ready :5433");
}

async function main() {
  const fwdArgs = process.argv.slice(2);
  const portIdx = fwdArgs.findIndex((a) => a === "--port" || a === "-p");
  const vitePort = portIdx >= 0 ? fwdArgs[portIdx + 1] : (process.env.FDE_DEV_PORT || "5173");

  await ensurePostgres();

  if (await isListening(S3_PORT)) {
    console.log("[fde] s3 stub already up :9000");
  } else {
    console.log("[fde] starting S3 stub (moto) :9000 ...");
    run(MOTO, ["-H", "127.0.0.1", "-p", String(S3_PORT)]);
    await waitPort(S3_PORT, "127.0.0.1", 60000);
  }

  const inheritedPythonPath = process.env.PYTHONPATH ? `${path.delimiter}${process.env.PYTHONPATH}` : "";
  const env = {
    ...process.env,
    FDE_ENV: "dev",
    AGENT_MODE: "stub",
    PYTHONPATH: `${BACKEND}${path.delimiter}${ROOT}${inheritedPythonPath}`,
  };

  console.log("[fde] running migrations (idempotent) ...");
  const mig = spawnSync(PY, ["-m", "services.migrations_runner"], { env, stdio: "inherit", windowsHide: true });
  if (mig.status !== 0) throw new Error("migrations failed");

  console.log(`[fde] starting API :${API_PORT} ...`);
  run(PY, ["-u", "-m", "uvicorn", "services.api.app:app", "--host", "127.0.0.1", "--port", API_PORT], { env });
  await waitHttpOk(`http://127.0.0.1:${API_PORT}/healthz`);
  console.log("[fde] API ready.");

  console.log("[fde] starting worker (AGENT_MODE=stub) ...");
  run(PY, ["-u", "-m", "services.worker"], { env });

  console.log(`[fde] starting web (vite) :${vitePort} ...`);
  const webCmd = [`"${NPM}"`, "run", "dev", "--", ...fwdArgs].join(" ");
  run(webCmd, [], {
    cwd: WEB,
    shell: true, // npm 是 .cmd，Node ≥18.20/20.12 要求 shell 才能 spawn
    env: { ...env, FDE_API_PORT: API_PORT, FDE_DEV_PORT: String(vitePort), FDE_INTERNAL_BASE: `http://127.0.0.1:${API_PORT}` },
  });

  console.log("");
  console.log(`  学员台  http://127.0.0.1:${vitePort}/app/   (learner@fde.local / learner1234)`);
  console.log(`  教研台  http://127.0.0.1:${vitePort}/author/ (author@fde.local / author1234)`);
  console.log(`  API     http://127.0.0.1:${API_PORT}/api/docs`);
  console.log("");

  await new Promise(() => {}); // 常驻，直到收到退出信号
}

main().catch((err) => { console.error("[fde] startup failed:", err.message); shutdown(1); });
