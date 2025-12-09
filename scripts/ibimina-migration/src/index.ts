import { createSourceClient, createTargetClient, testConnection } from "./utils/db.js";
import { IdMapper } from "./utils/id-mapping.js";
import { logger } from "./logger.js";
import { config } from "./config.js";
import { formatDuration, formatNumber } from "./utils/progress.js";
import {
  SaccoMigrator,
  GroupMigrator,
  MemberMigrator,
  AccountMigrator,
  PaymentMigrator,
  LedgerMigrator,
} from "./migrators/index.js";
import type { MigrationSummary } from "./types.js";

export async function runMigration(): Promise<MigrationSummary> {
  const startTime = Date.now();
  const startedAt = new Date().toISOString();

  logger.header("Ibimina → EasyMO Data Migration");
  logger.info(`Mode: ${config.DRY_RUN ? "DRY RUN (no changes)" : "LIVE"}`);
  logger.info(`Batch size: ${config.BATCH_SIZE}`);
  logger.separator();

  // Create clients
  const source = createSourceClient();
  const target = createTargetClient();

  // Test connections
  logger.info("\nTesting connections...");
  const sourceOk = await testConnection(source, "Source (Ibimina)");
  const targetOk = await testConnection(target, "Target (EasyMO)");

  if (!sourceOk || !targetOk) {
    throw new Error("Database connection failed");
  }

  // Create ID mapper
  const idMapper = new IdMapper();

  // Define migration order (respects foreign key dependencies)
  const migrators = [
    new SaccoMigrator(source, target, idMapper),
    new GroupMigrator(source, target, idMapper),
    new MemberMigrator(source, target, idMapper),
    new AccountMigrator(source, target, idMapper),
    new PaymentMigrator(source, target, idMapper),
    new LedgerMigrator(source, target, idMapper),
  ];

  // Initialize summary
  const summary: MigrationSummary = {
    startedAt,
    completedAt: "",
    dryRun: config.DRY_RUN,
    tables: {},
    idMappings: {},
    totalDuration: 0,
  };

  // Run migrations in order
  logger.separator();
  logger.info("\nStarting migration...\n");

  for (const migrator of migrators) {
    try {
      const result = await migrator.migrate();
      summary.tables[result.table] = {
        total: result.total,
        migrated: result.migrated,
        skipped: result.skipped,
        errors: result.errors.length,
        duration: result.duration,
      };
    } catch (error) {
      logger.error(`Migration failed for ${migrator.tableName}:`, error);
      throw error;
    }
  }

  // Finalize
  summary.completedAt = new Date().toISOString();
  summary.idMappings = idMapper.getStats();
  summary.totalDuration = Date.now() - startTime;

  // Save ID mappings
  if (!config.DRY_RUN) {
    idMapper.save();
  }

  // Print summary
  logger.separator();
  logger.header("Migration Summary");

  let totalRecords = 0;
  let totalMigrated = 0;
  let totalErrors = 0;

  for (const [table, stats] of Object.entries(summary.tables)) {
    totalRecords += stats.total;
    totalMigrated += stats.migrated;
    totalErrors += stats.errors;

    const status = stats.errors === 0 ? "✅" : "⚠️";
    logger.info(
      `${status} ${table.padEnd(15)} | ` +
      `${formatNumber(stats.migrated).padStart(6)}/${formatNumber(stats.total).padStart(6)} | ` +
      `${stats.errors} errors | ${formatDuration(stats.duration)}`
    );
  }

  logger.separator();
  logger.info(`Total: ${formatNumber(totalMigrated)}/${formatNumber(totalRecords)} records`);
  logger.info(`Errors: ${totalErrors}`);
  logger.info(`Duration: ${formatDuration(summary.totalDuration)}`);

  if (config.DRY_RUN) {
    logger.warn("\n⚠️  DRY RUN - No data was modified");
  } else {
    logger.success("\n✅ Migration complete!");
  }

  return summary;
}

export { config } from "./config.js";
export { logger } from "./logger.js";
export { IdMapper } from "./utils/id-mapping.js";
