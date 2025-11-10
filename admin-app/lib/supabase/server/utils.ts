import { z } from "zod";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

export class SupabaseUnavailableError extends Error {
  constructor() {
    super("supabase_unavailable");
    this.name = "SupabaseUnavailableError";
  }
}

export class SupabaseQueryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SupabaseQueryError";
  }
}

export function requireSupabaseAdminClient() {
  const client = getSupabaseAdminClient();
  if (!client) {
    throw new SupabaseUnavailableError();
  }
  return client;
}

export function parseArray<T extends z.ZodTypeAny>(schema: T, rows: unknown) {
  return schema.array().parse(rows) as z.infer<T>[];
}

export function parseRecord<T extends z.ZodTypeAny>(schema: T, value: unknown) {
  return schema.parse(value) as z.infer<T>;
}

export function mapNullableRecord<RecordType extends Record<string, unknown>>(
  row: RecordType,
  defaults: Partial<RecordType>,
) {
  return Object.assign({}, defaults, row);
}
