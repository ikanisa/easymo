#!/usr/bin/env tsx
import { logger } from "@easymo/migration-shared/logger";

import { apiChecks } from "../src/checks/api.js";
import { databaseChecks } from "../src/checks/database.js";
import { config } from "../src/config.js";
import type { CheckStatus,HealthCheck, HealthCheckResult } from "../src/types.js";

logger.configure({ verbose: config.VERBOSE });

async function runAllChecks(
  checks: Array<() => Promise<HealthCheck>>
): Promise<HealthCheckResult> {
  const startTime = Date.now();
  const results: HealthCheck[] = [];

  for (const check of checks) {
    try {
      const result = await check();
      results.push(result);
    } catch (error) {
      results.push({
        name: "Unknown Check",
        category: "error",
        status: "fail",
        message: error instanceof Error ? error.message : String(error),
        duration: 0,
        timestamp: new Date().toISOString(),
      });
    }
  }

  const summary = {
    total: results.length,
    passed: results.filter((r) => r.status === "pass").length,
    failed: results.filter((r) => r.status === "fail").length,
    warnings: results.filter((r) => r.status === "warn").length,
    skipped: results.filter((r) => r.status === "skip").length,
  };

  const overall: CheckStatus =
    summary.failed > 0 ? "fail" : summary.warnings > 0 ? "warn" : "pass";

  return {
    overall,
    checks: results,
    summary,
    duration: Date.now() - startTime,
    timestamp: new Date().toISOString(),
  };
}

function printHealthCheckResult(result: HealthCheckResult): void {
  logger.header("Go-Live Pre-Flight Health Checks");

  // Group by category
  const byCategory = new Map<string, HealthCheck[]>();
  for (const check of result.checks) {
    const cat = check.category;
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat)!.push(check);
  }

  for (const [category, checks] of byCategory) {
    logger.subheader(category);
    logger.checklist(checks.map((c) => ({ name: `${c.name}: ${c.message}`, status: c.status })));
  }

  logger.separator();
  logger.info(`Total: ${result.summary.total} checks`);
  logger.info(`  ✓ Passed: ${result.summary.passed}`);
  logger.info(`  ✗ Failed: ${result.summary.failed}`);
  logger.info(`  ⚠ Warnings: ${result.summary.warnings}`);
  logger.info(`  ○ Skipped: ${result.summary.skipped}`);
  logger.info(`  Duration: ${result.duration}ms`);

  if (result.overall === "pass") {
    logger.success("\n✅ All checks passed! System ready for go-live.");
  } else if (result.overall === "warn") {
    logger.warn("\n⚠️  Checks passed with warnings. Review before proceeding.");
  } else {
    logger.error("\n❌ Some checks failed. Fix issues before go-live.");
    process.exit(1);
  }
}

async function main() {
  logger.info("Starting pre-flight health checks...");
  logger.info(`Mode: ${config.DRY_RUN ? "DRY RUN" : "LIVE"}`);
  logger.separator();

  const allChecks = [...databaseChecks, ...apiChecks];

  const result = await runAllChecks(allChecks);
  printHealthCheckResult(result);
}

main().catch((error) => {
  logger.error("Pre-flight check failed:", error);
  process.exit(1);
});
