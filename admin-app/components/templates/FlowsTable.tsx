"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table/DataTable";
import type { FlowMeta } from "@/lib/schemas";

interface FlowsTableProps {
  data: FlowMeta[];
}

const columns: ColumnDef<FlowMeta>[] = [
  {
    header: "Title",
    accessorKey: "title",
  },
  {
    header: "Version",
    accessorKey: "version",
  },
  {
    header: "Status",
    accessorKey: "status",
  },
  {
    header: "Linked endpoints",
    accessorKey: "linkedEndpoints",
    cell: ({ row }) => row.original.linkedEndpoints.join(", "),
  },
  {
    header: "Last error",
    accessorKey: "lastErrorAt",
    cell: (
      { row },
    ) => (row.original.lastErrorAt
      ? new Date(row.original.lastErrorAt).toLocaleString()
      : "—"),
  },
];

export function FlowsTable({ data }: FlowsTableProps) {
  return (
    <DataTable
      data={data}
      columns={columns}
      searchPlaceholder="Search flows"
      globalFilterFn={(row, value) =>
        `${row.title} ${row.version}`.toLowerCase().includes(
          value.toLowerCase(),
        )}
      downloadFileName="flows.csv"
    />
  );
}
