import { z } from "zod";

import { coerceNullableString } from "../_lib/utils";

export const driverSelect =
  "id, name, phone, status, vehicle_id, created_at, vehicles(id, make, model, license_plate)";

export type VehicleRow = {
  id: string;
  make: string | null;
  model: string | null;
  license_plate: string | null;
};

export type DriverRow = {
  id: string;
  name: string;
  phone: string;
  status: string | null;
  vehicle_id: string | null;
  created_at: string;
  vehicles: VehicleRow[] | null;
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
  const vehicle = row.vehicles?.[0] ?? null;
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    status: coerceNullableString(row.status),
    vehicle_id: row.vehicle_id ?? null,
    created_at: row.created_at,
    vehicles: vehicle
      ? {
          id: vehicle.id,
          make: vehicle.make,
          model: vehicle.model,
          license_plate: vehicle.license_plate,
        }
      : null,
  };
}
