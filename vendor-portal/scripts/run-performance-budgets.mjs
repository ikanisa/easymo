import { mkdir, readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import process from "node:process";
import { setTimeout as sleep } from "node:timers/promises";

const REPORT_PATH = new URL("../.lighthouse/report.json", import.meta.url);
const BUDGET_PATH = new URL("../lighthouse.budgets.json", import.meta.url);

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", shell: false, ...options });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} ${args.join(" ")} exited with code ${code}`));
      }
    });
  });
}

async function waitForServer(url, retries = 30, delayMs = 1000) {
  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (response.ok) {
        return;
      }
    } catch {}
    await sleep(delayMs);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function extractResourceSize(items, type) {
  const match = items.find(
    (item) => item.resourceType === type || item.resourceType === type.toUpperCase()
  );
  if (!match) return 0;
  if (typeof match.transferSize === "number") {
    return match.transferSize / 1024;
  }
  if (typeof match.size === "number") {
    return match.size;
  }
  return 0;
}

async function main() {
  const cwd = new URL("../", import.meta.url);

  await run("pnpm", ["run", "build"], { cwd: cwd.pathname });

  const server = spawn("pnpm", ["run", "start"], {
    cwd: cwd.pathname,
    stdio: "inherit",
    env: { ...process.env, PORT: "3100" },
  });

  try {
    await waitForServer("http://127.0.0.1:3100/dashboard");
    await mkdir(new URL("../.lighthouse", import.meta.url), { recursive: true });
    await run(
      "npx",
      [
        "--yes",
        "lighthouse",
        "http://127.0.0.1:3100/dashboard",
        "--config-path=./lighthouse.config.cjs",
        "--budgets-path=./lighthouse.budgets.json",
        "--output=json",
        `--output-path=${REPORT_PATH.pathname}`,
        "--quiet",
      ],
      { cwd: cwd.pathname }
    );
  } finally {
    server.kill("SIGINT");
    await sleep(1000);
  }

  const reportRaw = await readFile(REPORT_PATH);
  const report = JSON.parse(reportRaw.toString());
  const budgets = JSON.parse((await readFile(BUDGET_PATH)).toString());

  const errors = [];
  const resourceItems = report?.audits?.["resource-summary"]?.details?.items ?? [];
  const totalBytes = report?.audits?.["total-byte-weight"]?.numericValue ?? 0;
  const interactive = report?.audits?.interactive?.numericValue ?? 0;
  const fcp = report?.audits?.["first-contentful-paint"]?.numericValue ?? 0;
  const thirdPartyItems = report?.audits?.["third-party-summary"]?.details?.items ?? [];
  const thirdPartyCount = Array.isArray(thirdPartyItems)
    ? thirdPartyItems.reduce((sum, item) => sum + (item.requestCount ?? 0), 0)
    : 0;

  const budget = budgets[0] ?? {};
  const resourceBudgets = budget.resourceSizes ?? [];
  for (const entry of resourceBudgets) {
    const actual =
      entry.resourceType === "total"
        ? totalBytes / 1024
        : extractResourceSize(resourceItems, entry.resourceType);
    if (actual > entry.budget) {
      errors.push(
        `${entry.resourceType} budget exceeded: ${actual.toFixed(1)}KB > ${entry.budget}KB`
      );
    }
  }

  const resourceCountBudgets = budget.resourceCounts ?? [];
  for (const entry of resourceCountBudgets) {
    if (entry.resourceType === "third-party" && thirdPartyCount > entry.budget) {
      errors.push(`Third-party requests ${thirdPartyCount} exceed budget of ${entry.budget}`);
    }
  }

  const timingBudgets = budget.timings ?? [];
  for (const entry of timingBudgets) {
    if (entry.metric === "interactive" && interactive > entry.budget) {
      errors.push(`Time to interactive ${Math.round(interactive)}ms exceeds ${entry.budget}ms`);
    }
    if (entry.metric === "first-contentful-paint" && fcp > entry.budget) {
      errors.push(`First contentful paint ${Math.round(fcp)}ms exceeds ${entry.budget}ms`);
    }
  }

  if (errors.length > 0) {
    console.error("Performance budgets failed:\n" + errors.map((line) => ` - ${line}`).join("\n"));
    process.exit(1);
  }

  console.log("Performance budgets passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
