import { existsSync,readFileSync, writeFileSync } from "fs";

import { logger } from "../logger.js";

/**
 * Maintains mapping between source IDs and target IDs
 * for preserving relationships during migration
 */
export class IdMapper {
  private maps: Map<string, Map<string, string>> = new Map();
  private filename: string;

  constructor(filename?: string) {
    this.filename = filename || `migration-mappings-${Date.now()}.json`;
  }

  /**
   * Set mapping from source ID to target ID
   */
  set(table: string, sourceId: string, targetId: string): void {
    if (!this.maps.has(table)) {
      this.maps.set(table, new Map());
    }
    this.maps.get(table)!.set(sourceId, targetId);
  }

  /**
   * Get target ID for a source ID
   */
  get(table: string, sourceId: string | null | undefined): string | null {
    if (!sourceId) return null;
    return this.maps.get(table)?.get(sourceId) ?? null;
  }

  /**
   * Get target ID or throw if not found
   */
  getOrThrow(table: string, sourceId: string): string {
    const targetId = this.get(table, sourceId);
    if (!targetId) {
      throw new Error(`No mapping found for ${table}:${sourceId}`);
    }
    return targetId;
  }

  /**
   * Check if a source ID has been mapped
   */
  has(table: string, sourceId: string): boolean {
    return this.maps.get(table)?.has(sourceId) ?? false;
  }

  /**
   * Get count of mappings per table
   */
  getStats(): Record<string, number> {
    const stats: Record<string, number> = {};
    for (const [table, map] of this.maps) {
      stats[table] = map.size;
    }
    return stats;
  }

  /**
   * Export all mappings as JSON-serializable object
   */
  export(): Record<string, Record<string, string>> {
    const data: Record<string, Record<string, string>> = {};
    for (const [table, map] of this.maps) {
      data[table] = Object.fromEntries(map);
    }
    return data;
  }

  /**
   * Save mappings to file
   */
  save(): string {
    const data = this.export();
    writeFileSync(this.filename, JSON.stringify(data, null, 2));
    logger.info(`ID mappings saved to ${this.filename}`);
    return this.filename;
  }

  /**
   * Load mappings from file
   */
  static load(filename: string): IdMapper {
    if (!existsSync(filename)) {
      throw new Error(`Mapping file not found: ${filename}`);
    }

    const data = JSON.parse(readFileSync(filename, "utf-8"));
    const mapper = new IdMapper(filename);

    for (const [table, mappings] of Object.entries(data)) {
      for (const [sourceId, targetId] of Object.entries(mappings as Record<string, string>)) {
        mapper.set(table, sourceId, targetId);
      }
    }

    logger.info(`Loaded ${Object.keys(data).length} tables from ${filename}`);
    return mapper;
  }
}
