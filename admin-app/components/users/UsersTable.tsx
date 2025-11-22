"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { maskMsisdn } from "@va/shared";
import { useMemo } from "react";

import { DataTable } from "@/components/data-table/DataTable";
import { LoadMoreButton } from "@/components/ui/LoadMoreButton";
import type { User } from "@/lib/schemas";

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
        {row.original.displayName ?? maskMsisdn(row.original.msisdn)}
      </UserDrawerTrigger>
    ),
  },
  {
    header: "MSISDN",
    accessorKey: "msisdn",
    cell: ({ row }) => maskMsisdn(row.original.msisdn),
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
  const localeOptions = useMemo(() => {
    const unique = new Set<string>();
    for (const user of data) {
      if (user.locale) {
        unique.add(user.locale);
      }
    }
    return Array.from(unique)
      .sort((a, b) => a.localeCompare(b))
      .map((locale) => ({ label: locale, value: locale }));
  }, [data]);

  const statusOptions = useMemo(() => {
    const unique = new Set<string>();
    for (const user of data) {
      if (user.status) {
        unique.add(user.status);
      }
    }
    return Array.from(unique)
      .sort((a, b) => a.localeCompare(b))
      .map((status) => ({ label: status, value: status }));
  }, [data]);

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
        filters={[
          {
            id: "locale",
            label: "Locale",
            columnId: "locale",
            type: "select",
            options: localeOptions,
            placeholder: "All locales",
          },
          {
            id: "status",
            label: "Status",
            columnId: "status",
            type: "multi-select",
            options: statusOptions,
          },
        ]}
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
