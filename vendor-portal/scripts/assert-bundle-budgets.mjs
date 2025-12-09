#!/usr/bin/env node
import { readFile, stat } from "node:fs/promises";
import path from "node:path";

const BUILD_MANIFEST_PATH = path.join(process.cwd(), ".next", "build-manifest.json");
const APP_MANIFEST_PATH = path.join(process.cwd(), ".next", "app-build-manifest.json");

function formatBytes(bytes) {
  const units = ["B", "KB", "MB"];
  let size = bytes;
  let index = 0;
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024;
    index += 1;
  }
  const precision = size < 10 && index > 0 ? 1 : 0;
  return `${size.toFixed(precision)}${units[index]}`;
}

async function fileSize(relativePath) {
  const filePath = path.join(process.cwd(), ".next", relativePath);
  const info = await stat(filePath);
  return info.size;
}

async function sumAssetSizes(assetPaths) {
  const unique = Array.from(new Set(assetPaths));
  let total = 0;
  for (const asset of unique) {
    total += await fileSize(asset);
  }
  return total;
}

async function main() {
  let buildManifest;
  let appManifest;
  try {
    buildManifest = JSON.parse(await readFile(BUILD_MANIFEST_PATH, "utf8"));
  } catch (error) {
    console.error(`Unable to read build manifest at ${BUILD_MANIFEST_PATH}`);
    throw error;
  }

  try {
    appManifest = JSON.parse(await readFile(APP_MANIFEST_PATH, "utf8"));
  } catch (error) {
    console.error(`Unable to read app manifest at ${APP_MANIFEST_PATH}`);
    throw error;
  }

  const initialAssets = [
    ...(buildManifest.rootMainFiles ?? []),
    ...(buildManifest.polyfillFiles ?? []),
  ];
  const initialTotal = await sumAssetSizes(initialAssets);

  const sharedAssets = new Set(initialAssets);
  const dashboardAssets = appManifest.pages?.["/(main)/dashboard/page"] ?? [];
  const dashboardSpecificAssets = dashboardAssets.filter((asset) => !sharedAssets.has(asset));
  const dashboardTotal =
    dashboardSpecificAssets.length > 0 ? await sumAssetSizes(dashboardSpecificAssets) : null;

  const checks = [
    {
      label: "Initial JS total",
      value: initialTotal,
      limit: 480 * 1024,
    },
  ];

  if (dashboardTotal != null) {
    checks.push({
      label: "Dashboard payload",
      value: dashboardTotal,
      limit: 360 * 1024,
    });
  } else {
    console.warn("⚠️  Dashboard route missing from app manifest; skipping dashboard budget.");
  }

  const failures = [];
  for (const check of checks) {
    if (check.value > check.limit) {
      failures.push(
        `${check.label} ${formatBytes(check.value)} (limit ${formatBytes(check.limit)})`
      );
    } else {
      console.log(
        `✅  ${check.label} ${formatBytes(check.value)} (limit ${formatBytes(check.limit)})`
      );
    }
  }

  if (failures.length > 0) {
    console.error("\nBundle budgets failed:");
    for (const failure of failures) {
      console.error(` - ${failure}`);
    }
    process.exit(1);
  }

  console.log("Bundle size budgets satisfied.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
