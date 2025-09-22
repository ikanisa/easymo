'use client';

import { useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/data-table/DataTable';
import type { Bar } from '@/lib/schemas';

interface BarsTableProps {
  data: Bar[];
}

const columns: ColumnDef<Bar>[] = [
  {
    header: 'Name',
    accessorKey: 'name',
    cell: ({ row }) => (
      <div>
        <strong>{row.original.name}</strong>
        <p className="cell-muted">{row.original.location ?? 'Location not set'}</p>
      </div>
    )
  },
  {
    header: 'Active',
    accessorKey: 'isActive',
    cell: ({ row }) => (row.original.isActive ? 'Yes' : 'No')
  },
  {
    header: 'Receiving numbers',
    accessorKey: 'receivingNumbers'
  },
  {
    header: 'Menu version',
    accessorKey: 'publishedMenuVersion',
    cell: ({ row }) => row.original.publishedMenuVersion ?? '—'
  },
  {
    header: 'Last updated',
    accessorKey: 'lastUpdated',
    cell: ({ row }) => new Date(row.original.lastUpdated).toLocaleString()
  }
];

export function BarsTable({ data }: BarsTableProps) {
  const [filters, setFilters] = useState<{ active?: string; search?: string }>({});

  const filteredData = useMemo(() => {
    return data.filter((bar) => {
      const activeMatch = filters.active ? String(bar.isActive) === filters.active : true;
      const searchMatch = filters.search
        ? `${bar.name} ${bar.location ?? ''}`.toLowerCase().includes(filters.search.toLowerCase())
        : true;
      return activeMatch && searchMatch;
    });
  }, [data, filters]);

  return (
    <div className="stack">
      <div className="filters">
        <label>
          <span>Status</span>
          <select
            value={filters.active ?? ''}
            onChange={(event) =>
              setFilters((prev) => ({ ...prev, active: event.target.value || undefined }))
            }
          >
            <option value="">All</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </label>
        <label>
          <span>Search</span>
          <input
            value={filters.search ?? ''}
            onChange={(event) =>
              setFilters((prev) => ({ ...prev, search: event.target.value || undefined }))
            }
            placeholder="Search by name or location"
          />
        </label>
      </div>
      <DataTable
        data={filteredData}
        columns={columns}
        globalFilterFn={(row, value) =>
          `${row.name} ${row.location ?? ''}`.toLowerCase().includes(value.toLowerCase())
        }
        searchPlaceholder="Search bars"
        downloadFileName="bars.csv"
      />
    </div>
  );
}
