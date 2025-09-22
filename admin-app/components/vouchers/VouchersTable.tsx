'use client';

import { useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/data-table/DataTable';
import type { Voucher } from '@/lib/schemas';

interface VouchersTableProps {
  data: Voucher[];
}

const columns: ColumnDef<Voucher>[] = [
  {
    header: 'Voucher',
    accessorKey: 'id'
  },
  {
    header: 'User',
    accessorKey: 'userName',
    cell: ({ row }) => row.original.userName ?? row.original.msisdn
  },
  {
    header: 'Status',
    accessorKey: 'status'
  },
  {
    header: 'Amount',
    accessorKey: 'amount',
    cell: ({ row }) => `${row.original.amount.toLocaleString()} ${row.original.currency}`
  },
  {
    header: 'Issued',
    accessorKey: 'issuedAt',
    cell: ({ row }) => new Date(row.original.issuedAt).toLocaleString()
  },
  {
    header: 'Redeemed',
    accessorKey: 'redeemedAt',
    cell: ({ row }) => (row.original.redeemedAt ? new Date(row.original.redeemedAt).toLocaleString() : '—')
  },
  {
    header: 'Expires',
    accessorKey: 'expiresAt',
    cell: ({ row }) => (row.original.expiresAt ? new Date(row.original.expiresAt).toLocaleDateString() : '—')
  }
];

export function VouchersTable({ data }: VouchersTableProps) {
  const [filters, setFilters] = useState<{ status?: string; search?: string }>({});

  const filteredData = useMemo(() => {
    return data.filter((voucher) => {
      const statusMatch = filters.status ? voucher.status === filters.status : true;
      const searchMatch = filters.search
        ? `${voucher.id} ${voucher.msisdn}`.toLowerCase().includes(filters.search.toLowerCase())
        : true;
      return statusMatch && searchMatch;
    });
  }, [data, filters]);

  return (
    <div className="stack">
      <div className="filters">
        <label>
          <span>Status</span>
          <select
            value={filters.status ?? ''}
            onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value || undefined }))}
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
            value={filters.search ?? ''}
            onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value || undefined }))}
            placeholder="Voucher ID or MSISDN"
          />
        </label>
      </div>
      <DataTable
        data={filteredData}
        columns={columns}
        globalFilterFn={(row, value) =>
          `${row.id} ${row.userName ?? ''} ${row.msisdn}`.toLowerCase().includes(value.toLowerCase())
        }
        searchPlaceholder="Search vouchers"
        downloadFileName="vouchers.csv"
      />
    </div>
  );
}
