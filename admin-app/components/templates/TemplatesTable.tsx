"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table/DataTable";
import type { TemplateMeta } from "@/lib/schemas";

interface TemplatesTableProps {
  data: TemplateMeta[];
}

const columns: ColumnDef<TemplateMeta>[] = [
  {
    header: "Name",
    accessorKey: "name",
  },
  {
    header: "Purpose",
    accessorKey: "purpose",
  },
  {
    header: "Locales",
    accessorKey: "locales",
    cell: ({ row }) => row.original.locales.join(", "),
  },
  {
    header: "Status",
    accessorKey: "status",
  },
  {
    header: "Variables",
    accessorKey: "variables",
    cell: ({ row }) => row.original.variables.join(", "),
  },
  {
    header: "Last used",
    accessorKey: "lastUsedAt",
    cell: (
      { row },
    ) => (row.original.lastUsedAt
      ? new Date(row.original.lastUsedAt).toLocaleString()
      : "—"),
  },
  {
    header: "Error rate",
    accessorKey: "errorRate",
    cell: ({ row }) => `${row.original.errorRate.toFixed(1)}%`,
  },
];

export function TemplatesTable({ data }: TemplatesTableProps) {
  return (
    <DataTable
      data={data}
      columns={columns}
      searchPlaceholder="Search templates"
      globalFilterFn={(row, value) =>
        `${row.name} ${row.purpose}`.toLowerCase().includes(
          value.toLowerCase(),
        )}
      downloadFileName="templates.csv"
    />
  );
}
