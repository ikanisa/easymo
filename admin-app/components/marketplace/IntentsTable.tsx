"use client";

import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table/DataTable";
import type { MarketplaceIntent } from "@/lib/schemas";

interface IntentsTableProps {
  data: MarketplaceIntent[];
}

export function IntentsTable({ data }: IntentsTableProps) {
  const columns = useMemo<ColumnDef<MarketplaceIntent>[]>(() => [
    {
      header: "Buyer",
      accessorKey: "buyerName",
    },
    {
      header: "Channel",
      accessorKey: "channel",
    },
    {
      header: "Status",
      accessorKey: "status",
      cell: ({ row }) => row.original.status.toUpperCase(),
    },
    {
      header: "Quotes",
      accessorKey: "recentQuotes",
    },
    {
      header: "Created",
      accessorKey: "createdAt",
      cell: ({ row }) => new Date(row.original.createdAt).toLocaleString(),
    },
    {
      header: "Expires",
      accessorKey: "expiresAt",
      cell: ({ row }) =>
        row.original.expiresAt
          ? new Date(row.original.expiresAt).toLocaleString()
          : "—",
    },
  ], []);

  return (
    <DataTable
      data={data}
      columns={columns}
      searchPlaceholder="Search intents"
      globalFilterFn={(row, value) =>
        `${row.buyerName} ${row.channel} ${row.status}`.toLowerCase().includes(
          value.toLowerCase(),
        )}
      downloadFileName="intents.csv"
    />
  );
}
