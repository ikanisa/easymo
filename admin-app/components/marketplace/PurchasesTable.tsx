"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { useMemo } from "react";

import { DataTable } from "@/components/data-table/DataTable";
import type { MarketplacePurchase } from "@/lib/schemas";

interface PurchasesTableProps {
  data: MarketplacePurchase[];
}

export function PurchasesTable({ data }: PurchasesTableProps) {
  const columns = useMemo<ColumnDef<MarketplacePurchase>[]>(() => [
    {
      header: "Buyer",
      accessorKey: "buyerName",
    },
    {
      header: "Vendor",
      accessorKey: "vendorName",
    },
    {
      header: "Status",
      accessorKey: "status",
      cell: ({ row }) => row.original.status.toUpperCase(),
    },
    {
      header: "Amount",
      accessorKey: "amount",
      cell: ({ row }) =>
        row.original.amount != null
          ? `${row.original.currency ?? "USD"} ${row.original.amount.toFixed(2)}`
          : "—",
    },
    {
      header: "Created",
      accessorKey: "createdAt",
      cell: ({ row }) => new Date(row.original.createdAt).toLocaleString(),
    },
    {
      header: "Fulfilled",
      accessorKey: "fulfilledAt",
      cell: ({ row }) =>
        row.original.fulfilledAt
          ? new Date(row.original.fulfilledAt).toLocaleString()
          : "—",
    },
  ], []);

  return (
    <DataTable
      data={data}
      columns={columns}
      searchPlaceholder="Search purchases"
      globalFilterFn={(row, value) =>
        `${row.vendorName} ${row.buyerName}`.toLowerCase().includes(
          value.toLowerCase(),
        )}
      downloadFileName="purchases.csv"
    />
  );
}
