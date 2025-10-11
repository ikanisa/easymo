"use client";

import { DataTable } from "@/components/data-table/DataTable";
import { LoadMoreButton } from "@/components/ui/LoadMoreButton";
import type { User } from "@/lib/schemas";
import type { ColumnDef } from "@tanstack/react-table";
import { UserDrawerTrigger } from "./UserDrawer";

interface UsersTableProps {
  data: User[];
  hasMore?: boolean;
  onLoadMore?: () => void;
  loadingMore?: boolean;
}

const columns: ColumnDef<User>[] = [
  {
    header: "Display name",
    accessorKey: "displayName",
    cell: ({ row }) => (
      <UserDrawerTrigger user={row.original}>
        {row.original.displayName ?? row.original.msisdn}
      </UserDrawerTrigger>
    ),
  },
  {
    header: "MSISDN",
    accessorKey: "msisdn",
  },
  {
    header: "Locale",
    accessorKey: "locale",
  },
  {
    header: "Roles",
    accessorKey: "roles",
    cell: ({ row }) => row.original.roles.join(", ") || "—",
  },
  {
    header: "Status",
    accessorKey: "status",
  },
  {
    header: "Created",
    accessorKey: "createdAt",
    cell: ({ row }) => new Date(row.original.createdAt).toLocaleDateString(),
  },
  {
    header: "Last seen",
    accessorKey: "lastSeenAt",
    cell: (
      { row },
    ) => (row.original.lastSeenAt
      ? new Date(row.original.lastSeenAt).toLocaleString()
      : "—"),
  },
];

export function UsersTable({ data, hasMore, onLoadMore, loadingMore }: UsersTableProps) {
  return (
    <div className="space-y-3">
      <DataTable
        data={data}
        columns={columns}
        globalFilterFn={(row, value) =>
          `${row.displayName ?? ""} ${row.msisdn}`.toLowerCase().includes(
            value.toLowerCase(),
          )}
        searchPlaceholder="Search by name or number"
        downloadFileName="users.csv"
      />
      <LoadMoreButton
        hasMore={hasMore}
        loading={loadingMore}
        onClick={onLoadMore}
      >
        Load more users
      </LoadMoreButton>
    </div>
  );
}
