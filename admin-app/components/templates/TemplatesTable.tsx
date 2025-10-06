"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table/DataTable";
import { LoadMoreButton } from "@/components/ui/LoadMoreButton";
import type { TemplateMeta } from "@/lib/schemas";

interface TemplatesTableProps {
  data: TemplateMeta[];
  statusFilter?: TemplateMeta["status"] | "";
  onStatusChange?: (value: TemplateMeta["status"] | "") => void;
  hasMore?: boolean;
  onLoadMore?: () => void;
  loadingMore?: boolean;
}

const columns: ColumnDef<TemplateMeta>[] = [
  {
    header: "Name",
    accessorKey: "name",
  },
  {
    header: "Purpose",
    accessorKey: "purpose",
  },
  {
    header: "Locales",
    accessorKey: "locales",
    cell: ({ row }) => row.original.locales.join(", "),
  },
  {
    header: "Status",
    accessorKey: "status",
  },
  {
    header: "Variables",
    accessorKey: "variables",
    cell: ({ row }) => row.original.variables.join(", "),
  },
  {
    header: "Last used",
    accessorKey: "lastUsedAt",
    cell: (
      { row },
    ) => (row.original.lastUsedAt
      ? new Date(row.original.lastUsedAt).toLocaleString()
      : "—"),
  },
  {
    header: "Error rate",
    accessorKey: "errorRate",
    cell: ({ row }) => `${row.original.errorRate.toFixed(1)}%`,
  },
];

export function TemplatesTable({
  data,
  statusFilter = "",
  onStatusChange,
  hasMore,
  onLoadMore,
  loadingMore,
}: TemplatesTableProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <label className="text-sm text-[color:var(--color-muted)]">
          Status
          <select
            value={statusFilter}
            onChange={(event) => onStatusChange?.(event.target.value as TemplateMeta["status"] | "")}
            className="ml-2 rounded-lg border border-[color:var(--color-border)]/40 bg-white/90 px-3 py-1 text-sm"
          >
            <option value="">All</option>
            <option value="draft">Draft</option>
            <option value="approved">Approved</option>
          </select>
        </label>
      </div>
      <DataTable
        data={data}
        columns={columns}
        searchPlaceholder="Search templates"
        globalFilterFn={(row, value) =>
          `${row.name} ${row.purpose}`.toLowerCase().includes(
            value.toLowerCase(),
          )}
        downloadFileName="templates.csv"
      />
      <LoadMoreButton
        hasMore={hasMore}
        loading={loadingMore}
        onClick={onLoadMore}
      >
        Load more templates
      </LoadMoreButton>
    </div>
  );
}
