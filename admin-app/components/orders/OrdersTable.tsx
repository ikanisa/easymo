"use client";

import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/data-table/DataTable";
import type { Order } from "@/lib/schemas";

interface OrdersTableProps {
  data: Order[];
  onSelectOrder?: (order: Order) => void;
}

const baseColumns: ColumnDef<Order>[] = [
  {
    header: "Order code",
    accessorKey: "id",
  },
  {
    header: "Bar",
    accessorKey: "barName",
  },
  {
    header: "Table",
    accessorKey: "table",
    cell: ({ row }) => row.original.table ?? "—",
  },
  {
    header: "Status",
    accessorKey: "status",
  },
  {
    header: "Total",
    accessorKey: "total",
    cell: ({ row }) => `${row.original.total.toLocaleString()} RWF`,
  },
  {
    header: "Created",
    accessorKey: "createdAt",
    cell: ({ row }) => new Date(row.original.createdAt).toLocaleString(),
  },
  {
    header: "Last update",
    accessorKey: "updatedAt",
    cell: ({ row }) => new Date(row.original.updatedAt).toLocaleString(),
  },
];

export function OrdersTable({ data, onSelectOrder }: OrdersTableProps) {
  const [filters, setFilters] = useState<
    { status?: string; bar?: string; stuck?: boolean }
  >({});

  const columns = useMemo<ColumnDef<Order>[]>(() => {
    if (!onSelectOrder) return baseColumns;
    return [
      ...baseColumns,
      {
        header: "Actions",
        id: "actions",
        cell: ({ row }) => (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onSelectOrder(row.original)}
          >
            Override
          </Button>
        ),
      },
    ];
  }, [onSelectOrder]);

  const filteredData = useMemo(() => {
    return data.filter((order) => {
      const statusMatch = filters.status
        ? order.status === filters.status
        : true;
      const barMatch = filters.bar ? order.barId === filters.bar : true;
      const stuckMatch = filters.stuck
        ? Date.now() - new Date(order.createdAt).getTime() > 15 * 60 * 1000 &&
          order.status === "pending"
        : true;
      return statusMatch && barMatch && stuckMatch;
    });
  }, [data, filters]);

  return (
    <div className="stack">
      <div className="filters">
        <label>
          <span>Status</span>
          <input
            value={filters.status ?? ""}
            onChange={(event) =>
              setFilters((prev) => ({
                ...prev,
                status: event.target.value || undefined,
              }))}
            placeholder="e.g. pending"
          />
        </label>
        <label>
          <span>Bar ID</span>
          <input
            value={filters.bar ?? ""}
            onChange={(event) =>
              setFilters((prev) => ({
                ...prev,
                bar: event.target.value || undefined,
              }))}
            placeholder="Filter by bar"
          />
        </label>
        <label className="filters__field">
          <span>Stuck &gt; 15m</span>
          <select
            value={filters.stuck ? "yes" : ""}
            onChange={(event) =>
              setFilters((prev) => ({
                ...prev,
                stuck: event.target.value === "yes" ? true : undefined,
              }))}
          >
            <option value="">All</option>
            <option value="yes">Show only stuck</option>
          </select>
        </label>
      </div>
      <DataTable
        data={filteredData}
        columns={columns}
        globalFilterFn={(row, value) =>
          `${row.id} ${row.barName} ${row.table ?? ""}`.toLowerCase().includes(
            value.toLowerCase(),
          )}
        searchPlaceholder="Search orders"
        downloadFileName="orders.csv"
      />
    </div>
  );
}
