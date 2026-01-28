#!/usr/bin/env tsx
import { logger } from "../src/logger.js";
import { createSourceClient, createTargetClient, getTableCount } from "../src/utils/db.js";
import { formatNumber } from "../src/utils/progress.js";

const TABLES = [
  "saccos",
  "ikimina",
  "members",
  "accounts",
  "payments",
  "ledger_entries",
];

async function main() {
  logger.header("Post-Migration Verification");

  const source = createSourceClient();
  const target = createTargetClient();

  const results: Array<{
    table: string;
    source: number;
    target: number;
    diff: number;
    match: boolean;
  }> = [];

  logger.info("Comparing record counts...\n");

  for (const table of TABLES) {
    try {
      const sourceCount = await getTableCount(source, table);
      const targetCount = await getTableCount(target, table);
      const diff = targetCount - sourceCount;

      results.push({
        table,
        source: sourceCount,
        target: targetCount,
        diff,
        match: sourceCount === targetCount,
      });
    } catch (error) {
      logger.error(`Failed to count ${table}:`, error);
      results.push({
        table,
        source: -1,
        target: -1,
        diff: 0,
        match: false,
      });
    }
  }

  // Print results
  logger.info("Table".padEnd(20) + "Source".padStart(10) + "Target".padStart(10) + "Diff".padStart(10) + "  Status");
  logger.separator("-", 60);

  for (const r of results) {
    const status = r.match ? "✅" : r.diff > 0 ? "⚠️" : "❌";
    const diffStr = r.diff === 0 ? "-" : (r.diff > 0 ? `+${r.diff}` : `${r.diff}`);

    logger.info(
      r.table.padEnd(20) +
      formatNumber(r.source).padStart(10) +
      formatNumber(r.target).padStart(10) +
      diffStr.padStart(10) +
      `  ${status}`
    );
  }

  logger.separator();

  const allMatch = results.every((r) => r.match);
  const hasErrors = results.some((r) => r.source === -1);

  if (hasErrors) {
    logger.error("Some tables could not be verified. Check errors above.");
    process.exit(1);
  } else if (allMatch) {
    logger.success("All tables verified successfully!");
    process.exit(0);
  } else {
    logger.warn("Some tables have different counts. Review manually.");
    process.exit(1);
  }
}

main();
