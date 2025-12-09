import { SupabaseClient } from "@supabase/supabase-js";
import { config } from "../config.js";
import { IdMapper } from "../utils/id-mapping.js";
import { logger } from "../logger.js";
import { createProgressBar, formatDuration } from "../utils/progress.js";
import type { MigrationResult } from "../types.js";

export abstract class BaseMigrator<TSource = unknown, TTarget = unknown> {
  protected source: SupabaseClient;
  protected target: SupabaseClient;
  protected idMapper: IdMapper;
  protected dryRun: boolean;

  constructor(
    source: SupabaseClient,
    target: SupabaseClient,
    idMapper: IdMapper
  ) {
    this.source = source;
    this.target = target;
    this.idMapper = idMapper;
    this.dryRun = config.DRY_RUN;
  }

  abstract get tableName(): string;
  abstract get displayName(): string;
  abstract transform(source: TSource): TTarget;
  abstract validate(data: TSource): boolean;

  async fetchSourceData(): Promise<TSource[]> {
    const { data, error } = await this.source
      .from(this.tableName)
      .select("*")
      .order("created_at", { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch ${this.tableName}: ${error.message}`);
    }

    return (data || []) as TSource[];
  }

  async insertTarget(data: TTarget): Promise<string> {
    const { data: inserted, error } = await this.target
      .from(this.tableName)
      .insert(data)
      .select("id")
      .single();

    if (error) {
      throw new Error(`Insert failed: ${error.message}`);
    }

    return inserted.id;
  }

  async migrate(): Promise<MigrationResult> {
    const startTime = Date.now();
    const result: MigrationResult = {
      table: this.tableName,
      total: 0,
      migrated: 0,
      skipped: 0,
      errors: [],
      duration: 0,
    };

    logger.info(`\nMigrating ${this.displayName}...`);

    // Fetch source data
    const sourceData = await this.fetchSourceData();
    result.total = sourceData.length;

    if (result.total === 0) {
      logger.warn(`No records found in ${this.tableName}`);
      result.duration = Date.now() - startTime;
      return result;
    }

    logger.info(`Found ${result.total} records`);

    // Create progress bar
    const progressBar = createProgressBar(result.total, this.displayName);

    // Process each record
    for (let i = 0; i < sourceData.length; i++) {
      const record = sourceData[i] as TSource & { id: string };

      try {
        // Validate
        if (!this.validate(record)) {
          result.skipped++;
          progressBar.update(i + 1);
          continue;
        }

        // Transform
        const transformed = this.transform(record);

        if (this.dryRun) {
          // In dry run, use same ID for mapping
          this.idMapper.set(this.tableName, record.id, record.id);
        } else {
          // Insert into target
          const targetId = await this.insertTarget(transformed);
          this.idMapper.set(this.tableName, record.id, targetId);
        }

        result.migrated++;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        result.errors.push({ id: record.id, error: errorMessage });
        logger.debug(`Error migrating ${record.id}: ${errorMessage}`);
      }

      progressBar.update(i + 1);
    }

    progressBar.stop();

    result.duration = Date.now() - startTime;

    // Log summary
    logger.info(
      `  ✓ ${result.migrated} migrated, ${result.skipped} skipped, ` +
      `${result.errors.length} errors (${formatDuration(result.duration)})`
    );

    return result;
  }
}
