#!/usr/bin/env tsx
import { runMigration, logger, config } from "../src/index.js";
import readline from "readline";

async function confirm(message: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`${message} (yes/no): `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === "yes");
    });
  });
}

async function main() {
  if (config.DRY_RUN) {
    logger.info("Running in DRY RUN mode (set DRY_RUN=false to execute)");
  } else {
    logger.warn("⚠️  LIVE MIGRATION MODE ⚠️");
    logger.warn("This will modify the target database.");
    logger.warn("");

    const confirmed = await confirm("Are you sure you want to proceed?");

    if (!confirmed) {
      logger.info("Migration cancelled.");
      process.exit(0);
    }
  }

  try {
    await runMigration();
    process.exit(0);
  } catch (error) {
    logger.error("Migration failed:", error);
    process.exit(1);
  }
}

main();
