"use client";

import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table/DataTable";
import { Button } from "@/components/ui/Button";
import { LoadMoreButton } from "@/components/ui/LoadMoreButton";
import { VoucherDrawer } from "@/components/vouchers/VoucherDrawer";
import type { Voucher } from "@/lib/schemas";

interface VouchersTableProps {
  data: Voucher[];
  statusFilter?: string;
  onStatusChange?: (value: string) => void;
  searchFilter?: string;
  onSearchChange?: (value: string) => void;
  hasMore?: boolean;
  onLoadMore?: () => void;
  loadingMore?: boolean;
}

const baseColumns: ColumnDef<Voucher>[] = [
  {
    header: "Voucher",
    accessorKey: "id",
  },
  {
    header: "User",
    accessorKey: "userName",
    cell: ({ row }) => row.original.userName ?? row.original.msisdn,
  },
  {
    header: "Status",
    accessorKey: "status",
  },
  {
    header: "Amount",
    accessorKey: "amount",
    cell: ({ row }) =>
      `${row.original.amount.toLocaleString()} ${row.original.currency}`,
  },
  {
    header: "Issued",
    accessorKey: "issuedAt",
    cell: ({ row }) => new Date(row.original.issuedAt).toLocaleString(),
  },
  {
    header: "Redeemed",
    accessorKey: "redeemedAt",
    cell: (
      { row },
    ) => (row.original.redeemedAt
      ? new Date(row.original.redeemedAt).toLocaleString()
      : "—"),
  },
  {
    header: "Expires",
    accessorKey: "expiresAt",
    cell: (
      { row },
    ) => (row.original.expiresAt
      ? new Date(row.original.expiresAt).toLocaleDateString()
      : "—"),
  },
];

export function VouchersTable({
  data,
  statusFilter,
  onStatusChange,
  searchFilter,
  onSearchChange,
  hasMore,
  onLoadMore,
  loadingMore,
}: VouchersTableProps) {
  const [localFilters, setLocalFilters] = useState<
    { status?: string; search?: string }
  >({});
  const [selectedVoucher, setSelectedVoucher] = useState<Voucher | null>(null);

  const statusValue = onStatusChange ? statusFilter ?? "" : localFilters.status ?? "";
  const searchValue = onSearchChange ? searchFilter ?? "" : localFilters.search ?? "";

  const handleStatusChange = (value: string) => {
    if (onStatusChange) {
      onStatusChange(value);
    } else {
      setLocalFilters((prev) => ({ ...prev, status: value || undefined }));
    }
  };

  const handleSearchChange = (value: string) => {
    if (onSearchChange) {
      onSearchChange(value);
    } else {
      setLocalFilters((prev) => ({ ...prev, search: value || undefined }));
    }
  };

  const filteredData = useMemo(() => {
    const normalizedSearch = searchValue.toLowerCase();
    return data.filter((voucher) => {
      const statusMatch = statusValue
        ? voucher.status === statusValue
        : true;
      const searchMatch = searchValue
        ? `${voucher.id} ${voucher.msisdn ?? ""}`.toLowerCase().includes(
          normalizedSearch,
        )
        : true;
      return statusMatch && searchMatch;
    });
  }, [data, statusValue, searchValue]);

  const columns = useMemo<ColumnDef<Voucher>[]>(() => {
    return [
      ...baseColumns,
      {
        header: "",
        id: "actions",
        cell: ({ row }) => (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setSelectedVoucher(row.original)}
          >
            View
          </Button>
        ),
      },
    ];
  }, []);

  return (
    <div className="space-y-4">
      <div className="filters">
        <label>
          <span>Status</span>
          <select
            value={statusValue}
            onChange={(event) => handleStatusChange(event.target.value)}
          >
            <option value="">All</option>
            <option value="issued">Issued</option>
            <option value="sent">Sent</option>
            <option value="redeemed">Redeemed</option>
            <option value="expired">Expired</option>
            <option value="void">Void</option>
          </select>
        </label>
        <label>
          <span>Search</span>
          <input
            value={searchValue}
            onChange={(event) => handleSearchChange(event.target.value)}
            placeholder="Voucher ID or MSISDN"
          />
        </label>
      </div>
      <DataTable
        data={filteredData}
        columns={columns}
        globalFilterFn={(row, value) =>
          `${row.id} ${row.userName ?? ""} ${row.msisdn}`.toLowerCase()
            .includes(value.toLowerCase())}
        searchPlaceholder="Search vouchers"
        downloadFileName="vouchers.csv"
      />
      <LoadMoreButton
        hasMore={hasMore}
        loading={loadingMore}
        onClick={onLoadMore}
      >
        Load more vouchers
      </LoadMoreButton>
      <VoucherDrawer
        voucher={selectedVoucher}
        onClose={() => setSelectedVoucher(null)}
      />
    </div>
  );
}
