"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { DataTable } from "@/components/data-table/DataTable";
import type { LiveCall } from "@/lib/schemas";

interface LiveCallsTableProps {
  data: LiveCall[];
}

const columns: ColumnDef<LiveCall>[] = [
  {
    header: "Lead",
    accessorKey: "leadName",
    cell: ({ row }) => row.original.leadName ?? "Unknown lead",
  },
  {
    header: "Phone",
    accessorKey: "leadPhone",
  },
  {
    header: "Status",
    accessorKey: "status",
    cell: ({ row }) => row.original.status.toUpperCase(),
  },
  {
    header: "Direction",
    accessorKey: "direction",
  },
  {
    header: "Duration",
    accessorKey: "durationSeconds",
    cell: ({ row }) => {
      const duration = row.original.durationSeconds ?? 0;
      const minutes = Math.floor(duration / 60);
      const seconds = duration % 60;
      return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
    },
  },
  {
    header: "Last media",
    accessorKey: "lastMediaAt",
    cell: ({ row }) =>
      row.original.lastMediaAt
        ? new Date(row.original.lastMediaAt).toLocaleTimeString()
        : "—",
  },
  {
    header: "Warm transfer",
    accessorKey: "warmTransferQueue",
    cell: ({ row }) => row.original.warmTransferQueue ?? "—",
  },
  {
    header: "Opt-out",
    accessorKey: "optOutDetected",
    cell: ({ row }) => (row.original.optOutDetected ? "Yes" : "No"),
  },
  {
    header: "Transcript",
    accessorKey: "transcriptPreview",
    cell: ({ row }) => row.original.transcriptPreview ?? "—",
  },
];

export function LiveCallsTable({ data }: LiveCallsTableProps) {
  return (
    <DataTable
      data={data}
      columns={columns}
      globalFilterFn={(row, value) =>
        `${row.leadName ?? ""} ${row.leadPhone}`.toLowerCase().includes(
          value.toLowerCase(),
        )}
      searchPlaceholder="Search calls by lead or phone"
      downloadFileName="live-calls.csv"
    />
  );
}
