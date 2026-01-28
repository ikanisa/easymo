import { createClient, SupabaseClient } from "@supabase/supabase-js";

import { config } from "../config.js";
import { logger } from "../logger.js";

let sourceClient: SupabaseClient | null = null;
let targetClient: SupabaseClient | null = null;

export function createSourceClient(): SupabaseClient {
  if (!sourceClient) {
    logger.debug("Creating source Supabase client...");
    sourceClient = createClient(
      config.SOURCE_SUPABASE_URL,
      config.SOURCE_SUPABASE_SERVICE_KEY,
      {
        db: { schema: "app" },
        auth: { persistSession: false },
      }
    );
  }
  return sourceClient;
}

export function createTargetClient(): SupabaseClient {
  if (!targetClient) {
    logger.debug("Creating target Supabase client...");
    targetClient = createClient(
      config.TARGET_SUPABASE_URL,
      config.TARGET_SUPABASE_SERVICE_KEY,
      {
        db: { schema: "app" },
        auth: { persistSession: false },
      }
    );
  }
  return targetClient;
}

export async function testConnection(client: SupabaseClient, name: string): Promise<boolean> {
  try {
    const { error } = await client.from("saccos").select("id").limit(1);
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

export async function getTableCount(
  client: SupabaseClient,
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
