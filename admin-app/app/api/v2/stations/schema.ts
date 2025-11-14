import { z } from "zod";

import type { Database } from "@/src/v2/lib/supabase/database.types";

import { coerceNullableString } from "../_lib/utils";

export const stationSelect = "id, name, location, created_at";

export type StationRow = Pick<
  Database["public"]["Tables"]["stations"]["Row"],
  "id" | "name" | "location" | "created_at"
>;

export const stationCreateSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, "Name is required"),
  location: z.string().optional().nullable(),
});

export const stationUpdateSchema = stationCreateSchema.omit({ id: true }).partial();

export function sanitizeStation(row: StationRow) {
  return {
    id: row.id,
    name: row.name,
    location: coerceNullableString(row.location),
    created_at: row.created_at,
  };
}
