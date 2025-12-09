import { createSourceClient, createTargetClient, testConnection, getTableCount } from "@easymo/migration-shared/db-clients";
import { logger } from "@easymo/migration-shared/logger";
import { config } from "../config.js";
import type { HealthCheck, CheckStatus } from "../types.js";

const TABLES = ["saccos", "ikimina", "members", "accounts", "payments", "ledger_entries"];

async function createCheck(
  name: string,
  category: string,
  fn: () => Promise<{ status: CheckStatus; message: string; details?: Record<string, unknown> }>
): Promise<HealthCheck> {
  const startTime = Date.now();
  try {
    const result = await fn();
    return {
      name,
      category,
      status: result.status,
      message: result.message,
      details: result.details,
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    return {
      name,
      category,
      status: "fail",
      message: error instanceof Error ? error.message : String(error),
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    };
  }
}

export async function checkOldDatabaseConnection(): Promise<HealthCheck> {
  return createCheck("Old DB Connection", "Database", async () => {
    const client = createSourceClient(config.OLD_SUPABASE_URL, config.OLD_SUPABASE_SERVICE_KEY);
    const isConnected = await testConnection(client, "Old DB");
    if (!isConnected) throw new Error("Connection failed");
    return { status: "pass", message: "Connected to old database" };
  });
}

export async function checkNewDatabaseConnection(): Promise<HealthCheck> {
  return createCheck("New DB Connection", "Database", async () => {
    const client = createTargetClient(config.NEW_SUPABASE_URL, config.NEW_SUPABASE_SERVICE_KEY);
    const isConnected = await testConnection(client, "New DB");
    if (!isConnected) throw new Error("Connection failed");
    return { status: "pass", message: "Connected to new database" };
  });
}

export async function checkDataSync(): Promise<HealthCheck> {
  return createCheck("Data Sync Status", "Database", async () => {
    const oldClient = createSourceClient(config.OLD_SUPABASE_URL, config.OLD_SUPABASE_SERVICE_KEY);
    const newClient = createTargetClient(config.NEW_SUPABASE_URL, config.NEW_SUPABASE_SERVICE_KEY);

    const mismatches: string[] = [];

    for (const table of TABLES) {
      try {
        const oldCount = await getTableCount(oldClient, table);
        const newCount = await getTableCount(newClient, table);

        if (oldCount !== newCount) {
          mismatches.push(`${table}: ${oldCount} vs ${newCount}`);
        }
      } catch {
        mismatches.push(`${table}: check failed`);
      }
    }

    if (mismatches.length > 0) {
      return {
        status: "warn",
        message: `${mismatches.length} tables out of sync`,
        details: { mismatches },
      };
    }

    return { status: "pass", message: "All tables in sync" };
  });
}

export const databaseChecks = [
  checkOldDatabaseConnection,
  checkNewDatabaseConnection,
  checkDataSync,
];
