"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table/DataTable";
import { LoadMoreButton } from "@/components/ui/LoadMoreButton";
import type { OcrJob } from "@/lib/schemas";

interface OcrJobsTableProps {
  data: OcrJob[];
  hasMore?: boolean;
  onLoadMore?: () => void;
  loadingMore?: boolean;
}

const columns: ColumnDef<OcrJob>[] = [
  {
    header: "Bar",
    accessorKey: "barName",
  },
  {
    header: "File name",
    accessorKey: "fileName",
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
    header: "Duration (s)",
    accessorKey: "durationSeconds",
    cell: ({ row }) => row.original.durationSeconds ?? "—",
  },
  {
    header: "Retries",
    accessorKey: "retries",
  },
  {
    header: "Submitted",
    accessorKey: "submittedAt",
    cell: ({ row }) => new Date(row.original.submittedAt).toLocaleString(),
  },
];

export function OcrJobsTable({ data, hasMore, onLoadMore, loadingMore }: OcrJobsTableProps) {
  return (
    <div className="space-y-3">
      <DataTable
        data={data}
        columns={columns}
        searchPlaceholder="Search OCR jobs"
        globalFilterFn={(row, value) =>
          `${row.barName} ${row.fileName}`.toLowerCase().includes(
            value.toLowerCase(),
          )}
        downloadFileName="ocr-jobs.csv"
      />
      <LoadMoreButton
        hasMore={hasMore}
        loading={loadingMore}
        onClick={onLoadMore}
      >
        Load more jobs
      </LoadMoreButton>
    </div>
  );
}
