import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const host = process.env.HOSTNAME ?? "127.0.0.1";
const port = process.env.PORT ?? "3100";
const preferStandalone = process.env.ADMIN_USE_STANDALONE_START === "1";
const useDevServer = process.env.E2E_USE_DEV === "1";
const standaloneEntry = path.resolve(projectRoot, ".next/standalone/server.js");
const standaloneCpuProfile = path.resolve(
  projectRoot,
  ".next/standalone/node_modules/next/dist/server/lib/cpu-profile.js"
);

const run = (command, args) =>
  spawn(command, args, { stdio: "inherit", cwd: projectRoot, env: process.env });

let child;

const require = createRequire(import.meta.url);
const nextCli = require.resolve("next/dist/bin/next");

if (useDevServer) {
  const args = ["dev", "--hostname", host, "--port", port];
  child = run(process.execPath, [nextCli, ...args]);
} else {
  const canUseStandalone =
    preferStandalone && existsSync(standaloneEntry) && existsSync(standaloneCpuProfile);

  if (canUseStandalone) {
    child = run(process.execPath, [standaloneEntry]);
  } else {
    if (preferStandalone) {
      console.warn(
        "ADMIN_USE_STANDALONE_START requested but standalone bundle is incomplete; falling back to next start."
      );
    }
    const args = ["start", "--hostname", host, "--port", port];
    child = run(process.execPath, [nextCli, ...args]);
  }
}

child.on("close", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exitCode = code ?? 0;
});

child.on("error", (error) => {
  console.error("Failed to launch e2e server", error);
  process.exit(1);
});
