import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "./logger.js";

export interface SupabaseConnectionConfig {
  url: string;
  serviceKey: string;
  schema?: string;
}

// Use 'any' for schema type to allow flexible schema switching
const clients = new Map<string, SupabaseClient<any, any, any>>();

/**
 * Create or retrieve a cached Supabase client
 */
export function getSupabaseClient(
  name: string,
  config: SupabaseConnectionConfig
): SupabaseClient<any, any, any> {
  if (!clients.has(name)) {
    logger.debug(`Creating Supabase client: ${name}`);
    const client = createClient(config.url, config.serviceKey, {
      db: { schema: config.schema || "app" },
      auth: { persistSession: false },
    });
    clients.set(name, client);
  }
  return clients.get(name)!;
}

/**
 * Create source/old system client
 */
export function createSourceClient(url: string, serviceKey: string): SupabaseClient<any, any, any> {
  return getSupabaseClient("source", { url, serviceKey });
}

/**
 * Create target/new system client
 */
export function createTargetClient(url: string, serviceKey: string): SupabaseClient<any, any, any> {
  return getSupabaseClient("target", { url, serviceKey });
}

/**
 * Test database connection
 */
export async function testConnection(
  client: SupabaseClient<any, any, any>,
  name: string
): Promise<boolean> {
  try {
    // Try to query a common table
    const { error } = await client.from("saccos").select("id").limit(1);
    
    // Ignore "table does not exist" - connection is still valid
    if (error && !error.message.includes("does not exist")) {
      throw error;
    }
    
    logger.success(`${name} connection successful`);
    return true;
  } catch (error) {
    logger.error(`${name} connection failed:`, error);
    return false;
  }
}

/**
 * Get record count for a table
 */
export async function getTableCount(
  client: SupabaseClient<any, any, any>,
  table: string
): Promise<number> {
  const { count, error } = await client
    .from(table)
    .select("*", { count: "exact", head: true });

  if (error) {
    throw new Error(`Failed to count ${table}: ${error.message}`);
  }

  return count || 0;
}

/**
 * Clear all cached clients (useful for testing)
 */
export function clearClientCache(): void {
  clients.clear();
  logger.debug("Cleared Supabase client cache");
}
