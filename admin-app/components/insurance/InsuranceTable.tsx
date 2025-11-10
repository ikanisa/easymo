"use client";

import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table/DataTable";
import { Button } from "@/components/ui/Button";
import { LoadMoreButton } from "@/components/ui/LoadMoreButton";
import type { InsuranceQuote } from "@/lib/schemas";
import { InsuranceDrawer } from "./InsuranceDrawer";

interface InsuranceTableProps {
  data: InsuranceQuote[];
  hasMore?: boolean;
  onLoadMore?: () => void;
  loadingMore?: boolean;
  statusFilter?: string;
  onStatusChange?: (value: string) => void;
  onApprove?: (quoteId: string) => Promise<void>;
  onRequestChanges?: (quoteId: string, comment: string) => Promise<void>;
  onUpdateStatus?: (
    quoteId: string,
    status: string,
    reviewerComment?: string | null,
  ) => Promise<void>;
  approvingId?: string | null;
  requestingId?: string | null;
  updatingId?: string | null;
}

const STATUS_OPTIONS = [
  "pending",
  "approved",
  "needs_changes",
  "in_review",
  "queued",
];

export function InsuranceTable({
  data,
  hasMore,
  onLoadMore,
  loadingMore,
  statusFilter,
  onStatusChange,
  onApprove,
  onRequestChanges,
  onUpdateStatus,
  approvingId,
  requestingId,
  updatingId,
}: InsuranceTableProps) {
  const [selected, setSelected] = useState<InsuranceQuote | null>(null);
  const [localStatus, setLocalStatus] = useState("");
  const statusValue = onStatusChange ? (statusFilter ?? "") : localStatus;

  const filteredData = useMemo(() => {
    return data.filter((quote) =>
      statusValue ? quote.status === statusValue : true
    );
  }, [data, statusValue]);

  const columns = useMemo<ColumnDef<InsuranceQuote>[]>(() => [
    {
      header: "Quote ID",
      accessorKey: "id",
    },
    {
      header: "User ID",
      accessorKey: "userId",
      cell: ({ row }) => row.original.userId ?? "—",
    },
    {
      header: "Status",
      accessorKey: "status",
      cell: ({ row }) => (
        onUpdateStatus
          ? (
            <StatusSelect
              quote={row.original}
              disabled={updatingId === row.original.id}
              onChange={(next) => onUpdateStatus(row.original.id, next)}
            />
          )
          : row.original.status
      ),
    },
    {
      header: "Premium",
      accessorKey: "premium",
      cell: ({ row }) =>
        row.original.premium
          ? `${row.original.premium.toLocaleString()} RWF`
          : "—",
    },
    {
      header: "Insurer",
      accessorKey: "insurer",
      cell: ({ row }) => row.original.insurer ?? "—",
    },
    {
      header: "Created",
      accessorKey: "createdAt",
      cell: ({ row }) => new Date(row.original.createdAt).toLocaleString(),
    },
    {
      header: "",
      id: "actions",
      cell: ({ row }) => (
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setSelected(row.original)}
        >
          View
        </Button>
      ),
    },
  ], [onUpdateStatus, updatingId]);

  const handleStatusChange = (value: string) => {
    if (onStatusChange) {
      onStatusChange(value);
    } else {
      setLocalStatus(value);
    }
  };

  return (
    <>
      <div className="filters">
        <label>
          <span>Status</span>
          <select
            value={statusValue}
            onChange={(event) => handleStatusChange(event.target.value)}
          >
            <option value="">All</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="needs_changes">Needs changes</option>
          </select>
        </label>
      </div>
      <DataTable
        data={filteredData}
        columns={columns}
        searchPlaceholder="Search insurance quotes"
        globalFilterFn={(row, value) =>
          row.id.toLowerCase().includes(value.toLowerCase())}
        downloadFileName="insurance-quotes.csv"
        emptyTitle="No quotes pending"
        emptyDescription="Insurance quotes will surface here when Supabase data is available."
      />
      <LoadMoreButton
        hasMore={hasMore}
        loading={loadingMore}
        onClick={onLoadMore}
      >
        Load more quotes
      </LoadMoreButton>
      {selected
        ? (
          <InsuranceDrawer
            quote={selected}
            onClose={() => setSelected(null)}
            onApprove={onApprove}
            onRequestChanges={onRequestChanges}
            onUpdateStatus={onUpdateStatus}
            approving={approvingId === selected.id}
            requesting={requestingId === selected.id}
            updating={updatingId === selected.id}
          />
        )
        : null}
    </>
  );
}

function StatusSelect({
  quote,
  onChange,
  disabled,
}: {
  quote: InsuranceQuote;
  onChange: (status: string) => void;
  disabled?: boolean;
}) {
  return (
    <select
      value={quote.status}
      onChange={(event) => onChange(event.target.value)}
      disabled={disabled}
    >
      {STATUS_OPTIONS.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}
