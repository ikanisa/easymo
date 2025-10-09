"use client";

import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table/DataTable";
import { Button } from "@/components/ui/Button";
import { LoadMoreButton } from "@/components/ui/LoadMoreButton";
import { CampaignDrawer } from "@/components/campaigns/CampaignDrawer";
import type { Campaign } from "@/lib/schemas";

interface CampaignsTableProps {
  data: Campaign[];
  statusFilter?: string;
  onStatusChange?: (value: string) => void;
  hasMore?: boolean;
  onLoadMore?: () => void;
  loadingMore?: boolean;
}

const baseColumns: ColumnDef<Campaign>[] = [
  {
    header: "Campaign",
    accessorKey: "name",
  },
  {
    header: "Type",
    accessorKey: "type",
  },
  {
    header: "Status",
    accessorKey: "status",
  },
  {
    header: "Template",
    accessorKey: "templateId",
  },
  {
    header: "Created",
    accessorKey: "createdAt",
    cell: ({ row }) => new Date(row.original.createdAt).toLocaleString(),
  },
  {
    header: "Started",
    accessorKey: "startedAt",
    cell: ({ row }) =>
      row.original.startedAt
        ? new Date(row.original.startedAt).toLocaleString()
        : "—",
  },
];

export function CampaignsTable({
  data,
  statusFilter,
  onStatusChange,
  hasMore,
  onLoadMore,
  loadingMore,
}: CampaignsTableProps) {
  const [localStatus, setLocalStatus] = useState<string>("");
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const status = onStatusChange ? statusFilter ?? "" : localStatus;

  const filteredData = useMemo(() =>
    data.filter((campaign) => (status ? campaign.status === status : true)),
  [data, status]);

  const columns = useMemo<ColumnDef<Campaign>[]>(() => [
    ...baseColumns,
    {
      header: "",
      id: "actions",
      cell: ({ row }) => (
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setSelectedCampaign(row.original)}
        >
          View
        </Button>
      ),
    },
  ], []);

  const handleChange = (value: string) => {
    if (onStatusChange) {
      onStatusChange(value);
    } else {
      setLocalStatus(value);
    }
  };

  return (
    <div className="space-y-4">
      <div className="filters">
        <label>
          <span>Status</span>
          <select
            value={status}
            onChange={(event) => handleChange(event.target.value)}
          >
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
          `${row.name} ${row.templateId}`.toLowerCase().includes(
            value.toLowerCase(),
          )}
        searchPlaceholder="Search campaigns"
        downloadFileName="campaigns.csv"
      />
      <LoadMoreButton
        hasMore={hasMore}
        loading={loadingMore}
        onClick={onLoadMore}
      >
        Load more campaigns
      </LoadMoreButton>
      <CampaignDrawer
        campaign={selectedCampaign}
        onClose={() => setSelectedCampaign(null)}
      />
    </div>
  );
}
