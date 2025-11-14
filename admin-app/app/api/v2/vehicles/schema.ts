export const vehicleSelect = "id, make, model, license_plate";

export type VehicleRow = {
  id: string;
  make: string | null;
  model: string | null;
  license_plate: string | null;
};

export function sanitizeVehicle(row: VehicleRow) {
  return {
    id: row.id,
    make: row.make,
    model: row.model,
    license_plate: row.license_plate,
  };
}
