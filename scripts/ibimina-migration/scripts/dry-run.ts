#!/usr/bin/env tsx
import { runMigration, logger } from "../src/index.js";

// Force dry run mode
process.env.DRY_RUN = "true";

async function main() {
  try {
    await runMigration();
    process.exit(0);
  } catch (error) {
    logger.error("Dry run failed:", error);
    process.exit(1);
  }
}

main();
