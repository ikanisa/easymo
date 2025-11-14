import type { Database } from "@/src/v2/lib/supabase/database.types";

export const vehicleSelect = "id, make, model, license_plate";

export type VehicleRow = Pick<
  Database["public"]["Tables"]["vehicles"]["Row"],
  "id" | "make" | "model" | "license_plate"
>;

export function sanitizeVehicle(row: VehicleRow) {
  return {
    id: row.id,
    make: row.make,
    model: row.model,
    license_plate: row.license_plate,
  };
}
