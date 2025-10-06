"use client";

import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table/DataTable";
import { LoadMoreButton } from "@/components/ui/LoadMoreButton";
import type { MenuVersion } from "@/lib/schemas";

interface MenuTableProps {
  data: MenuVersion[];
  hasMore?: boolean;
  onLoadMore?: () => void;
  loadingMore?: boolean;
}

const columns: ColumnDef<MenuVersion>[] = [
  {
    header: "Bar",
    accessorKey: "barName",
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
    header: "Source",
    accessorKey: "source",
  },
  {
    header: "Categories",
    accessorKey: "categories",
  },
  {
    header: "Items",
    accessorKey: "items",
  },
  {
    header: "Updated",
    accessorKey: "updatedAt",
    cell: ({ row }) => new Date(row.original.updatedAt).toLocaleString(),
  },
];

export function MenuTable({ data, hasMore, onLoadMore, loadingMore }: MenuTableProps) {
  const [filters, setFilters] = useState<
    { status?: MenuVersion["status"]; bar?: string }
  >({});

  const filteredData = useMemo(() => {
    return data.filter((menu) => {
      const statusMatch = filters.status
        ? menu.status === filters.status
        : true;
      const barMatch = filters.bar ? menu.barId === filters.bar : true;
      return statusMatch && barMatch;
    });
  }, [data, filters]);

  return (
    <div className="space-y-4">
      <div className="filters">
        <label>
          <span>Status</span>
          <select
            value={filters.status ?? ""}
            onChange={(event) => {
              const value = event.target.value as MenuVersion["status"] | "";
              setFilters((prev) => ({
                ...prev,
                status: value === "" ? undefined : value,
              }));
            }}
          >
            <option value="">All</option>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </select>
        </label>
        <label>
          <span>Bar</span>
          <input
            value={filters.bar ?? ""}
            onChange={(event) =>
              setFilters((prev) => ({
                ...prev,
                bar: event.target.value || undefined,
              }))}
            placeholder="Filter by bar ID"
          />
        </label>
      </div>
      <DataTable
        data={filteredData}
        columns={columns}
        globalFilterFn={(row, value) =>
          `${row.barName} ${row.version}`.toLowerCase().includes(
            value.toLowerCase(),
          )}
        searchPlaceholder="Search menus"
        downloadFileName="menus.csv"
      />
      <LoadMoreButton
        hasMore={hasMore}
        loading={loadingMore}
        onClick={onLoadMore}
      >
        Load more menus
      </LoadMoreButton>
    </div>
  );
}
