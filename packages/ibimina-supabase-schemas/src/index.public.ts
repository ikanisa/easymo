// Public API surface for @ibimina/supabase-schemas
import type { Database } from "./database.types";

export type { Database, Json } from "./database.types";
export type SchemaName = keyof Database;
