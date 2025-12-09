#!/usr/bin/env node
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(projectRoot, "../../..");

const loadedEnv = loadEnvFiles([
  path.join(repoRoot, ".env"),
  path.join(repoRoot, ".env.local"),
  path.join(projectRoot, ".env"),
  path.join(projectRoot, ".env.local"),
]);

const env = { ...loadedEnv, ...process.env };

const stubAllowed = env.ALLOW_STUB_ENV !== "0";
if (stubAllowed && !env.ALLOW_STUB_ENV) {
  env.ALLOW_STUB_ENV = "1";
}
if (stubAllowed && !env.AUTH_E2E_STUB) {
  env.AUTH_E2E_STUB = "1";
}

const nextBinary = process.platform === "win32" ? "next.cmd" : "next";
const args = ["build", ...process.argv.slice(2)];

const child = spawn(nextBinary, args, {
  stdio: "inherit",
  env,
});

child.on("exit", (code, signal) => {
  if (typeof code === "number") {
    process.exit(code);
  }
  process.exit(signal ? 1 : 0);
});

function loadEnvFiles(files) {
  const result = {};
  for (const filePath of files) {
    if (!filePath) continue;
    try {
      const stats = fs.statSync(filePath);
      if (!stats.isFile()) continue;
      Object.assign(result, parseEnvFile(filePath));
    } catch {
      // Ignore missing files
    }
  }
  return result;
}

function parseEnvFile(filePath) {
  const contents = fs.readFileSync(filePath, "utf8");
  const entries = {};
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^(?:export\s+)?([^=]+)=(.*)$/);
    if (!match) continue;
    const key = match[1].trim();
    if (!key) continue;
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    entries[key] = value;
  }
  return entries;
}
