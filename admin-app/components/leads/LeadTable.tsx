"use client";

import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table/DataTable";
import type { Lead } from "@/lib/schemas";

interface LeadTableProps {
  data: Lead[];
  onSelect: (lead: Lead) => void;
}

export function LeadTable({ data, onSelect }: LeadTableProps) {
  const columns = useMemo<ColumnDef<Lead>[]>(() => [
    {
      header: "",
      accessorKey: "actions",
      cell: ({ row }) => (
        <button
          type="button"
          className="rounded-full bg-[color:var(--color-surface)]/70 px-3 py-1 text-xs font-medium text-[color:var(--color-foreground)] shadow-[var(--elevation-low)] transition hover:bg-[color:var(--color-surface)]/90"
          onClick={() => onSelect(row.original)}
        >
          View
        </button>
      ),
      meta: { width: "minmax(80px, 120px)" },
    },
    {
      header: "Lead",
      accessorKey: "name",
      cell: ({ row }) => row.original.name ?? "Unknown",
    },
    {
      header: "Phone",
      accessorKey: "phoneE164",
    },
    {
      header: "Tags",
      accessorKey: "tags",
      cell: ({ row }) => row.original.tags.join(", ") || "—",
    },
    {
      header: "Opt-in",
      accessorKey: "optIn",
      cell: ({ row }) => (row.original.optIn ? "Yes" : "No"),
    },
    {
      header: "Last contact",
      accessorKey: "lastContactAt",
      cell: ({ row }) =>
        row.original.lastContactAt
          ? new Date(row.original.lastContactAt).toLocaleString()
          : "—",
    },
    {
      header: "Last call",
      accessorKey: "lastCallAt",
      cell: ({ row }) =>
        row.original.lastCallAt
          ? new Date(row.original.lastCallAt).toLocaleString()
          : "—",
    },
  ], [onSelect]);

  return (
    <DataTable
      data={data}
      columns={columns}
      globalFilterFn={(row, value) =>
        `${row.name ?? ""} ${row.phoneE164}`.toLowerCase().includes(
          value.toLowerCase(),
        )}
      searchPlaceholder="Search leads by name or phone"
      downloadFileName="leads.csv"
    />
  );
}
