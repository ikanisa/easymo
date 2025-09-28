"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table/DataTable";
import type { QrToken } from "@/lib/schemas";

interface QrTokenTableProps {
  data: QrToken[];
}

const columns: ColumnDef<QrToken>[] = [
  {
    header: "Bar",
    accessorKey: "barName",
  },
  {
    header: "Table",
    accessorKey: "tableLabel",
  },
  {
    header: "Token",
    accessorKey: "token",
  },
  {
    header: "Created",
    accessorKey: "createdAt",
    cell: ({ row }) => new Date(row.original.createdAt).toLocaleString(),
  },
  {
    header: "Printed",
    accessorKey: "printed",
    cell: ({ row }) => (row.original.printed ? "Yes" : "No"),
  },
  {
    header: "Last scan",
    accessorKey: "lastScanAt",
    cell: (
      { row },
    ) => (row.original.lastScanAt
      ? new Date(row.original.lastScanAt).toLocaleString()
      : "—"),
  },
];

export function QrTokenTable({ data }: QrTokenTableProps) {
  return (
    <DataTable
      data={data}
      columns={columns}
      searchPlaceholder="Search QR tokens"
      globalFilterFn={(row, value) =>
        `${row.barName} ${row.tableLabel} ${row.token}`.toLowerCase().includes(
          value.toLowerCase(),
        )}
      downloadFileName="qr-tokens.csv"
    />
  );
}
