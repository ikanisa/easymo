'use client';

import { useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/data-table/DataTable';
import type { StaffNumber } from '@/lib/schemas';

interface StaffNumbersTableProps {
  data: StaffNumber[];
}

const columns: ColumnDef<StaffNumber>[] = [
  {
    header: 'Bar',
    accessorKey: 'barName'
  },
  {
    header: 'Number',
    accessorKey: 'number'
  },
  {
    header: 'Role',
    accessorKey: 'role'
  },
  {
    header: 'Active',
    accessorKey: 'active',
    cell: ({ row }) => (row.original.active ? 'Yes' : 'No')
  },
  {
    header: 'Verified',
    accessorKey: 'verified',
    cell: ({ row }) => (row.original.verified ? 'Yes' : 'No')
  },
  {
    header: 'Last seen',
    accessorKey: 'lastSeenAt',
    cell: ({ row }) => (row.original.lastSeenAt ? new Date(row.original.lastSeenAt).toLocaleString() : '—')
  }
];

export function StaffNumbersTable({ data }: StaffNumbersTableProps) {
  const [filters, setFilters] = useState<{ role?: string; active?: string }>({});

  const filteredData = useMemo(() => {
    return data.filter((row) => {
      const roleMatch = filters.role ? row.role === filters.role : true;
      const activeMatch = filters.active ? String(row.active) === filters.active : true;
      return roleMatch && activeMatch;
    });
  }, [data, filters]);

  return (
    <div className="stack">
      <div className="filters">
        <label>
          <span>Role</span>
          <input
            value={filters.role ?? ''}
            onChange={(event) => setFilters((prev) => ({ ...prev, role: event.target.value || undefined }))}
            placeholder="Filter by role"
          />
        </label>
        <label>
          <span>Active</span>
          <select
            value={filters.active ?? ''}
            onChange={(event) => setFilters((prev) => ({ ...prev, active: event.target.value || undefined }))}
          >
            <option value="">All</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </label>
      </div>
      <DataTable
        data={filteredData}
        columns={columns}
        searchPlaceholder="Search staff numbers"
        globalFilterFn={(row, value) =>
          `${row.barName} ${row.number}`.toLowerCase().includes(value.toLowerCase())
        }
        downloadFileName="staff-numbers.csv"
      />
    </div>
  );
}
