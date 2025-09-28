"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table/DataTable";
import type { SettingEntry } from "@/lib/schemas";

interface SettingsTableProps {
  data: SettingEntry[];
}

const columns: ColumnDef<SettingEntry>[] = [
  {
    header: "Key",
    accessorKey: "key",
  },
  {
    header: "Description",
    accessorKey: "description",
  },
  {
    header: "Value preview",
    accessorKey: "valuePreview",
  },
  {
    header: "Updated",
    accessorKey: "updatedAt",
    cell: ({ row }) => new Date(row.original.updatedAt).toLocaleString(),
  },
];

export function SettingsTable({ data }: SettingsTableProps) {
  return (
    <DataTable
      data={data}
      columns={columns}
      searchPlaceholder="Search settings"
      globalFilterFn={(row, value) =>
        `${row.key} ${row.description}`.toLowerCase().includes(
          value.toLowerCase(),
        )}
      downloadFileName="settings.csv"
    />
  );
}
