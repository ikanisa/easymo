"use client";

import { useMemo, useRef, useState } from "react";
import { PlusIcon } from "@heroicons/react/24/outline";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/ToastProvider";
import { DataTable } from "@/src/v2/components/ui/DataTable";
import { CrudDialog } from "@/src/v2/components/ui/CrudDialog";
import {
  useDrivers,
  useVehicles,
  useCreateDriver,
  useUpdateDriver,
  useDeleteDriver,
} from "@/src/v2/lib/supabase/hooks";
import type { DriverRow, VehicleRow } from "@/src/v2/lib/supabase/database.types";

type DriverWithVehicle = DriverRow & { vehicles: VehicleRow | null };

interface DriverRowWithVehicle extends DriverWithVehicle {
  vehicle_name: string;
}

interface DriverFormValues {
  name: string;
  phone: string;
  status: string;
  vehicle_id: string | null;
}

type DialogState =
  | { mode: "create"; driver: null }
  | { mode: "edit"; driver: DriverWithVehicle }
  | null;

export default function DriversPage() {
  const { data: drivers = [], isLoading } = useDrivers();
  const { data: vehicles = [] } = useVehicles();
  const { pushToast } = useToast();
  const createDriver = useCreateDriver();
  const updateDriver = useUpdateDriver();
  const deleteDriver = useDeleteDriver();
  const undoBuffer = useRef<DriverRow | null>(null);
  const [dialogState, setDialogState] = useState<DialogState>(null);

  const rows: DriverRowWithVehicle[] = useMemo(() => {
    return drivers.map((driver) => ({
      ...driver,
      vehicle_name: driver.vehicles
        ? `${driver.vehicles.make ?? ""} ${driver.vehicles.model ?? ""}`.trim() ||
          driver.vehicles.license_plate ?? "Assigned"
        : "Unassigned",
    }));
  }, [drivers]);

  const vehicleOptions = useMemo(() => {
    return vehicles.map((vehicle) => ({
      label:
        `${vehicle.make ?? ""} ${vehicle.model ?? ""}`.trim() ||
        vehicle.license_plate ?? "Vehicle",
      value: vehicle.id,
    }));
  }, [vehicles]);

  const columns = [
    { key: "name" as const, label: "Name", sortable: true },
    { key: "phone" as const, label: "Phone", sortable: true },
    {
      key: "vehicle_name" as const,
      label: "Vehicle",
      render: (value: string) => value,
    },
    {
      key: "created_at" as const,
      label: "Joined",
      render: (value: string) => new Date(value).toLocaleDateString(),
    },
  ];

  const openCreateDialog = () => setDialogState({ mode: "create", driver: null });
  const openEditDialog = (driver: DriverRowWithVehicle) =>
    setDialogState({ mode: "edit", driver });
  const closeDialog = () => setDialogState(null);

  const initialValues: DriverFormValues = dialogState?.mode === "edit" && dialogState.driver
    ? {
        name: dialogState.driver.name,
        phone: dialogState.driver.phone,
        status: dialogState.driver.status ?? "active",
        vehicle_id: dialogState.driver.vehicle_id,
      }
    : {
        name: "",
        phone: "",
        status: "active",
        vehicle_id: null,
      };

  const handleSubmit = async (values: DriverFormValues) => {
    try {
      if (dialogState?.mode === "edit" && dialogState.driver) {
        await updateDriver.mutateAsync({
          id: dialogState.driver.id,
          name: values.name,
          phone: values.phone,
          status: values.status,
          vehicle_id: values.vehicle_id,
        });
        pushToast("Driver updated.", "success");
      } else {
        await createDriver.mutateAsync({
          name: values.name,
          phone: values.phone,
          status: values.status,
          vehicle_id: values.vehicle_id,
        });
        pushToast("Driver created.", "success");
      }
      closeDialog();
    } catch (error) {
      pushToast(
        error instanceof Error ? error.message : "We couldn’t save the driver.",
        "error",
      );
    }
  };

  const handleDelete = async () => {
    if (dialogState?.mode !== "edit" || !dialogState.driver) return;
    try {
      const deleted = await deleteDriver.mutateAsync({ id: dialogState.driver.id });
      undoBuffer.current = deleted;
      pushToast(`Deleted ${deleted.name}.`, {
        variant: "success",
        actionLabel: "Undo",
        onAction: async () => {
          const payload = undoBuffer.current;
          if (!payload) return;
          try {
            await createDriver.mutateAsync({
              id: payload.id,
              name: payload.name,
              phone: payload.phone,
              status: payload.status ?? undefined,
              vehicle_id: payload.vehicle_id,
            });
            pushToast("Restored driver.", "success");
          } catch (error) {
            pushToast(
              error instanceof Error
                ? error.message
                : "Unable to undo deletion.",
              "error",
            );
          }
        },
      });
      closeDialog();
    } catch (error) {
      pushToast(
        error instanceof Error ? error.message : "Failed to delete driver.",
        "error",
      );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Drivers</h1>
          <p className="mt-1 text-sm text-gray-500">
            Overview of your active driver fleet and assigned vehicles.
          </p>
        </div>
        <Button variant="primary" onClick={openCreateDialog}>
          <PlusIcon className="mr-2 h-5 w-5" />
          Add Driver
        </Button>
      </div>

      <DataTable data={rows} columns={columns} loading={isLoading} onRowClick={openEditDialog} />

      {dialogState ? (
        <CrudDialog
          open={Boolean(dialogState)}
          mode={dialogState.mode}
          entityName="driver"
          initialValues={initialValues}
          onClose={closeDialog}
          onSubmit={handleSubmit}
          onDelete={dialogState.mode === "edit" ? handleDelete : undefined}
          description="Assign a vehicle to improve dispatch accuracy. Unassigned drivers can still take manual trips."
          renderFields={({ values, onChange }) => (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700" htmlFor="driver-name">
                  Name
                </label>
                <Input
                  id="driver-name"
                  value={values.name}
                  onChange={(event) => onChange({ name: event.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700" htmlFor="driver-phone">
                  Phone
                </label>
                <Input
                  id="driver-phone"
                  value={values.phone}
                  onChange={(event) => onChange({ phone: event.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700" htmlFor="driver-status">
                  Status
                </label>
                <select
                  id="driver-status"
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                  value={values.status}
                  onChange={(event) => onChange({ status: event.target.value })}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700" htmlFor="driver-vehicle">
                  Vehicle
                </label>
                <select
                  id="driver-vehicle"
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                  value={values.vehicle_id ?? ""}
                  onChange={(event) =>
                    onChange({ vehicle_id: event.target.value || null })
                  }
                >
                  <option value="">Unassigned</option>
                  {vehicleOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}
        />
      ) : null}
    </div>
  );
}
