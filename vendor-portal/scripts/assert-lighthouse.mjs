#!/usr/bin/env node
import { readFile } from "node:fs/promises";

const REPORT_PATH = ".reports/lighthouse.json";
const THRESHOLDS = {
  performance: 0.9,
  accessibility: 0.9,
  pwa: 0.9,
};

function formatScore(score) {
  if (typeof score !== "number" || Number.isNaN(score)) return "N/A";
  return `${Math.round(score * 100)}%`;
}

async function main() {
  let raw;
  try {
    raw = await readFile(REPORT_PATH, "utf8");
  } catch (error) {
    console.error(`Unable to read Lighthouse report at ${REPORT_PATH}`);
    throw error;
  }

  const report = JSON.parse(raw);
  const categories = report?.categories ?? {};

  const failures = [];
  for (const [category, minimum] of Object.entries(THRESHOLDS)) {
    const score = categories?.[category]?.score;
    if (typeof score !== "number") {
      failures.push(`Category \"${category}\" missing from Lighthouse report.`);
      continue;
    }

    if (score < minimum) {
      failures.push(
        `${category} scored ${formatScore(score)} (required ≥ ${Math.round(minimum * 100)}%)`
      );
    } else {
      console.log(
        `✅  ${category} score ${formatScore(score)} (threshold ${Math.round(minimum * 100)}%)`
      );
    }
  }

  if (failures.length > 0) {
    console.error("\nLighthouse budgets failed:");
    for (const failure of failures) {
      console.error(` - ${failure}`);
    }
    process.exit(1);
  }

  console.log("All Lighthouse thresholds satisfied.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
