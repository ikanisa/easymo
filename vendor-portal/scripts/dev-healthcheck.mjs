#!/usr/bin/env node
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const PORT = Number(process.env.DEV_HEALTH_PORT ?? 3200);
const HOST = "127.0.0.1";
const BASE = `http://${HOST}:${PORT}`;

const results = [];

async function step(name, fn) {
  try {
    await fn();
    results.push({ name, ok: true });
  } catch (error) {
    results.push({ name, ok: false, error });
  }
}

function logSummary() {
  for (const item of results) {
    if (item.ok) console.log(`✅  ${item.name}`);
    else {
      console.error(`❌  ${item.name}`);
      if (item.error) console.error(`    ${item.error.message ?? String(item.error)}`);
    }
  }
}

async function fetchOk(path) {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`${path} -> HTTP ${res.status}`);
}

async function run() {
  const nextBin =
    process.platform === "win32" ? "node_modules/.bin/next.cmd" : "node_modules/.bin/next";
  const server = spawn(nextBin, ["dev", "-p", String(PORT), "-H", HOST], {
    stdio: "inherit",
    env: { ...process.env },
  });

  let started = false;
  for (let i = 0; i < 20; i += 1) {
    await sleep(1500);
    try {
      await fetchOk("/api/health");
      started = true;
      break;
    } catch {}
  }

  if (!started) {
    server.kill("SIGINT");
    await new Promise((r) => server.on("close", r));
    throw new Error("Dev server did not become healthy in time");
  }

  await step("GET /api/health", async () => fetchOk("/api/health"));
  await step("GET /login", async () => fetchOk("/login"));
  await step("GET /", async () => fetchOk("/"));

  server.kill("SIGINT");
  await new Promise((r) => server.on("close", r));

  logSummary();
  const failed = results.filter((r) => !r.ok);
  if (failed.length) process.exit(1);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
