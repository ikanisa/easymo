'use client';

import { useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/data-table/DataTable';
import type { InsuranceQuote } from '@/lib/schemas';
import { InsuranceDrawer } from './InsuranceDrawer';

interface InsuranceTableProps {
  data: InsuranceQuote[];
}

const columns: ColumnDef<InsuranceQuote>[] = [
  {
    header: 'Quote ID',
    accessorKey: 'id'
  },
  {
    header: 'User ID',
    accessorKey: 'userId'
  },
  {
    header: 'Status',
    accessorKey: 'status'
  },
  {
    header: 'Premium',
    accessorKey: 'premium',
    cell: ({ row }) => (row.original.premium ? `${row.original.premium.toLocaleString()} RWF` : '—')
  },
  {
    header: 'Insurer',
    accessorKey: 'insurer',
    cell: ({ row }) => row.original.insurer ?? '—'
  },
  {
    header: 'Created',
    accessorKey: 'createdAt',
    cell: ({ row }) => new Date(row.original.createdAt).toLocaleString()
  }
];

export function InsuranceTable({ data }: InsuranceTableProps) {
  const [selected, setSelected] = useState<InsuranceQuote | null>(null);

  return (
    <>
      <DataTable
        data={data}
        columns={columns}
        searchPlaceholder="Search insurance quotes"
        globalFilterFn={(row, value) => row.id.toLowerCase().includes(value.toLowerCase())}
        downloadFileName="insurance-quotes.csv"
        emptyTitle="No quotes pending"
        emptyDescription="Insurance quotes will surface here when Supabase data is available."
      />
      <div style={{ marginTop: '12px' }}>
        <button
          type="button"
          onClick={() => setSelected(data[0] ?? null)}
          disabled={!data.length}
          className="link-muted"
        >
          Open first quote
        </button>
      </div>
      {selected ? <InsuranceDrawer quote={selected} onClose={() => setSelected(null)} /> : null}
    </>
  );
}
