"use client";

import { useMemo } from "react";
import { DataTable } from "@/src/v2/components/ui/DataTable";
import { useDrivers } from "@/src/v2/lib/supabase/hooks";

export default function DriversPage() {
  const { data: drivers = [], isLoading } = useDrivers();

  const rows = useMemo(() => {
    return drivers.map((driver) => ({
      ...driver,
      vehicle_name: driver.vehicles
        ? `${driver.vehicles.make ?? "Unknown"} ${driver.vehicles.model ?? "Vehicle"}`.trim()
        : "Unassigned",
    }));
  }, [drivers]);

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Drivers</h1>
        <p className="mt-1 text-sm text-gray-500">
          Overview of your active driver fleet and assigned vehicles.
        </p>
      </div>

      <DataTable data={rows} columns={columns} loading={isLoading} />
    </div>
  );
}
