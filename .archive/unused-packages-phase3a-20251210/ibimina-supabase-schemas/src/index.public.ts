// Public API surface for @easymo/ibimina-supabase-schemas
import type { Database } from "./database.types";

export type { Database, Json } from "./database.types";
export type SchemaName = keyof Database;
