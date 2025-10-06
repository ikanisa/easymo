"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table/DataTable";
import { LoadMoreButton } from "@/components/ui/LoadMoreButton";
import type { FlowMeta } from "@/lib/schemas";

interface FlowsTableProps {
  data: FlowMeta[];
  statusFilter?: FlowMeta["status"] | "";
  onStatusChange?: (value: FlowMeta["status"] | "") => void;
  hasMore?: boolean;
  onLoadMore?: () => void;
  loadingMore?: boolean;
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

export function FlowsTable({
  data,
  statusFilter = "",
  onStatusChange,
  hasMore,
  onLoadMore,
  loadingMore,
}: FlowsTableProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <label className="text-sm text-[color:var(--color-muted)]">
          Status
          <select
            value={statusFilter}
            onChange={(event) => onStatusChange?.(event.target.value as FlowMeta["status"] | "")}
            className="ml-2 rounded-lg border border-[color:var(--color-border)]/40 bg-white/90 px-3 py-1 text-sm"
          >
            <option value="">All</option>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </select>
        </label>
      </div>
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
      <LoadMoreButton
        hasMore={hasMore}
        loading={loadingMore}
        onClick={onLoadMore}
      >
        Load more flows
      </LoadMoreButton>
    </div>
  );
}
