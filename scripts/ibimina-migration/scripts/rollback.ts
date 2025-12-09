#!/usr/bin/env tsx
import { createTargetClient } from "../src/utils/db.js";
import { logger } from "../src/logger.js";
import readline from "readline";

// Tables in reverse dependency order (delete children first)
const TABLES = [
  "ledger_entries",
  "payments",
  "accounts",
  "members",
  "ikimina",
  "saccos",
];

async function confirm(): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question('Type "ROLLBACK" to confirm deletion: ', (answer) => {
      rl.close();
      resolve(answer === "ROLLBACK");
    });
  });
}

async function main() {
  logger.header("🚨 EMERGENCY ROLLBACK 🚨");
  logger.error("This will DELETE all data from the following tables:\n");

  for (const table of TABLES) {
    logger.error(`  • app.${table}`);
  }

  logger.warn("\nThis action CANNOT be undone!\n");

  const confirmed = await confirm();

  if (!confirmed) {
    logger.info("Rollback cancelled.");
    process.exit(0);
  }

  const target = createTargetClient();

  logger.info("\nDeleting data...\n");

  for (const table of TABLES) {
    try {
      // Delete all records (use a condition that matches everything)
      const { error } = await target
        .from(table)
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000");

      if (error) {
        logger.error(`Failed to delete ${table}: ${error.message}`);
      } else {
        logger.success(`✓ ${table} cleared`);
      }
    } catch (error) {
      logger.error(`Error deleting ${table}:`, error);
    }
  }

  logger.separator();
  logger.success("Rollback complete. All migrated data has been removed.");
}

main();
