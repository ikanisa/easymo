import { z } from "zod";

import type { Database } from "@/src/v2/lib/supabase/database.types";

import { coerceNullableString } from "../_lib/utils";

export const driverSelect =
  "id, name, phone, status, vehicle_id, created_at, vehicles(id, make, model, license_plate)";

export type VehicleRow = Pick<
  Database["public"]["Tables"]["vehicles"]["Row"],
  "id" | "make" | "model" | "license_plate"
>;

export type DriverRow =
  Pick<
    Database["public"]["Tables"]["drivers"]["Row"],
    "id" | "name" | "phone" | "status" | "vehicle_id" | "created_at"
  > & {
    vehicles: VehicleRow | null;
  };

export const driverCreateSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, "Name is required"),
  phone: z.string().min(1, "Phone number is required"),
  status: z.string().optional().nullable(),
  vehicle_id: z.string().uuid().optional().nullable(),
});

export const driverUpdateSchema = driverCreateSchema.omit({ id: true }).partial();

export function sanitizeDriver(row: DriverRow) {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    status: coerceNullableString(row.status),
    vehicle_id: row.vehicle_id ?? null,
    created_at: row.created_at,
    vehicles: row.vehicles
      ? {
          id: row.vehicles.id,
          make: row.vehicles.make,
          model: row.vehicles.model,
          license_plate: row.vehicles.license_plate,
        }
      : null,
  };
}
