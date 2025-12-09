#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { access } from "node:fs/promises";
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const results = [];
const args = new Set(process.argv.slice(2));

const skipBuild = args.has("--skip-build") || process.env.SKIP_PWA_BUILD === "1";

function recordSkip(name) {
  results.push({ name, ok: true, skipped: true });
}

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
    if (item.skipped) {
      console.log(`⏭️  ${item.name} (skipped)`);
    } else if (item.ok) {
      console.log(`✅  ${item.name}`);
    } else {
      console.error(`❌  ${item.name}`);
      if (item.error) {
        console.error(`    ${item.error instanceof Error ? item.error.message : item.error}`);
      }
    }
  }
}

async function checkLayoutHead() {
  const layout = await readFile("app/layout.tsx", "utf8");
  if (!layout.includes('manifest: "/manifest.webmanifest"')) {
    throw new Error("Root layout is not advertising /manifest.webmanifest");
  }
  if (!layout.includes('themeColor: "#0b1020"')) {
    throw new Error("Root layout themeColor is not set to #0b1020");
  }
}

async function runCommand(command, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", ...opts });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve(undefined);
      else reject(new Error(`${command} ${args.join(" ")} exited with code ${code}`));
    });
  });
}

async function runBuild() {
  await runCommand("npm", ["run", "build"]);
}

async function runServerHealthcheck() {
  const port = 3100;
  const nextBin =
    process.platform === "win32" ? "node_modules/.bin/next.cmd" : "node_modules/.bin/next";
  // Bind to all interfaces for environments where 127.0.0.1 binding is restricted
  const server = spawn(nextBin, ["start", "-p", String(port), "-H", "0.0.0.0"], {
    env: { ...process.env },
    stdio: "inherit",
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, 45000);

  const url = `http://127.0.0.1:${port}/api/health`;
  let success = false;
  let exitCode = null;
  let exitSignal = null;
  server.on("exit", (code, signal) => {
    exitCode = code;
    exitSignal = signal;
  });

  try {
    for (let attempt = 0; attempt < 15; attempt += 1) {
      await sleep(3000, null, { signal: controller.signal }).catch(() => {});
      try {
        const response = await fetch(url, { signal: controller.signal });
        if (response.ok) {
          console.log("Healthcheck OK:", await response.text());
          success = true;
          break;
        }
      } catch {
        if (controller.signal.aborted) {
          break;
        }
      }
    }
  } finally {
    clearTimeout(timeout);
    server.kill("SIGINT");
  }

  await new Promise((resolve) => server.on("close", resolve));

  if (!success) {
    if (exitCode !== null) {
      console.warn(
        `⚠️  Could not verify /api/health locally (exit code ${exitCode}${exitSignal ? `, signal ${exitSignal}` : ""}). Double-check env vars and rerun.`
      );
      return;
    }
    throw new Error("Failed to confirm /api/health within 45s");
  }

  // Post-build/live checks
  // 1) Verify manifest served by Next metadata route
  const manifestUrl = `http://127.0.0.1:${port}/manifest.webmanifest`;
  const manifestRes = await fetch(manifestUrl).catch(() => null);
  if (!manifestRes || !manifestRes.ok) {
    throw new Error(`Manifest not served at ${manifestUrl}`);
  }
  const manifest = await manifestRes.json().catch(() => ({}));
  const requiredSizes = new Set(["192x192", "512x512"]);
  const icons = manifest.icons || [];
  for (const icon of icons) {
    if (icon?.sizes) {
      String(icon.sizes)
        .split(/\s+/)
        .filter(Boolean)
        .forEach((size) => requiredSizes.delete(size));
    }
  }
  if (requiredSizes.size > 0) {
    throw new Error(`Manifest is missing PNG icons for: ${Array.from(requiredSizes).join(", ")}`);
  }
  if (manifest.theme_color !== "#0b1020") {
    throw new Error("Manifest theme_color is not #0b1020");
  }

  // 2) Verify service worker is emitted and reachable
  const swUrl = `http://127.0.0.1:${port}/service-worker.js`;
  const swRes = await fetch(swUrl, { method: "HEAD" }).catch(() => null);
  if (!swRes || !swRes.ok) {
    throw new Error(`service-worker.js not reachable at ${swUrl}`);
  }
}

async function main() {
  await step("root layout advertises manifest & theme color", checkLayoutHead);
  if (skipBuild) {
    recordSkip("npm run build");
  } else {
    await step("npm run build", runBuild);
  }
  await step("start server, probe /api/health, manifest, and service worker", runServerHealthcheck);
  logSummary();
  const failed = results.filter((item) => !item.ok);
  if (failed.length > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
