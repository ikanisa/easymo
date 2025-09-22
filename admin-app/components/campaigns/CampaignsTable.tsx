'use client';

import type { ColumnDef } from '@tanstack/react-table';
import { useMemo, useState } from 'react';
import { DataTable } from '@/components/data-table/DataTable';
import type { Campaign } from '@/lib/schemas';

interface CampaignsTableProps {
  data: Campaign[];
}

const columns: ColumnDef<Campaign>[] = [
  {
    header: 'Campaign',
    accessorKey: 'name'
  },
  {
    header: 'Type',
    accessorKey: 'type'
  },
  {
    header: 'Status',
    accessorKey: 'status'
  },
  {
    header: 'Template',
    accessorKey: 'templateId'
  },
  {
    header: 'Created',
    accessorKey: 'createdAt',
    cell: ({ row }) => new Date(row.original.createdAt).toLocaleString()
  },
  {
    header: 'Started',
    accessorKey: 'startedAt',
    cell: ({ row }) => (row.original.startedAt ? new Date(row.original.startedAt).toLocaleString() : '—')
  }
];

export function CampaignsTable({ data }: CampaignsTableProps) {
  const [status, setStatus] = useState<string>('');

  const filteredData = useMemo(() => {
    return data.filter((campaign) => (status ? campaign.status === status : true));
  }, [data, status]);

  return (
    <div className="stack">
      <div className="filters">
        <label>
          <span>Status</span>
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">All</option>
            <option value="draft">Draft</option>
            <option value="running">Running</option>
            <option value="paused">Paused</option>
            <option value="done">Done</option>
          </select>
        </label>
      </div>
      <DataTable
        data={filteredData}
        columns={columns}
        globalFilterFn={(row, value) =>
          `${row.name} ${row.templateId}`.toLowerCase().includes(value.toLowerCase())
        }
        searchPlaceholder="Search campaigns"
        downloadFileName="campaigns.csv"
      />
    </div>
  );
}
