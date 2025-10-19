"use client";

import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table/DataTable";
import type { VendorRanking } from "@/lib/schemas";

interface VendorRankingTableProps {
  data: VendorRanking[];
}

export function VendorRankingTable({ data }: VendorRankingTableProps) {
  const columns = useMemo<ColumnDef<VendorRanking>[]>(() => [
    {
      header: "#",
      accessorKey: "rank",
      cell: ({ row }) => <span className="font-semibold">{row.index + 1}</span>,
      meta: { width: "80px" },
    },
    {
      header: "Vendor",
      accessorKey: "name",
      cell: ({ row }) => (
        <div>
          <div className="font-medium text-[color:var(--color-foreground)]">
            {row.original.name}
          </div>
          <div className="text-xs text-[color:var(--color-muted)]">
            {row.original.categories.join(", ") || "—"}
          </div>
        </div>
      ),
    },
    {
      header: "Score",
      accessorKey: "score",
      cell: ({ row }) => row.original.score.toFixed(2),
    },
    {
      header: "Rating",
      accessorKey: "rating",
      cell: ({ row }) => row.original.rating?.toFixed(1) ?? "—",
    },
    {
      header: "Fulfilment",
      accessorKey: "fulfilmentRate",
      cell: ({ row }) =>
        row.original.fulfilmentRate
          ? `${Math.round(row.original.fulfilmentRate * 100)}%`
          : "—",
    },
    {
      header: "Response",
      accessorKey: "avgResponseMs",
      cell: ({ row }) =>
        row.original.avgResponseMs ? `${Math.round(row.original.avgResponseMs / 1000)}s` : "—",
    },
    {
      header: "Trips",
      accessorKey: "totalTrips",
    },
    {
      header: "Recent",
      accessorKey: "recentTrips",
    },
    {
      header: "Balance",
      accessorKey: "balance",
      cell: ({ row }) =>
        row.original.balance != null ? `$${row.original.balance.toFixed(2)}` : "—",
    },
  ], []);

  return (
    <DataTable
      data={data}
      columns={columns}
      searchPlaceholder="Search vendors"
      globalFilterFn={(row, value) =>
        `${row.name} ${row.region}`.toLowerCase().includes(value.toLowerCase())}
      downloadFileName="vendor-ranking.csv"
    />
  );
}
