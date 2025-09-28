"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { useMemo, useState } from "react";
import { DataTable } from "@/components/data-table/DataTable";
import type { AuditEvent } from "@/lib/schemas";

interface LogsTableProps {
  data: AuditEvent[];
}

const columns: ColumnDef<AuditEvent>[] = [
  {
    header: "Time",
    accessorKey: "createdAt",
    cell: ({ row }) => new Date(row.original.createdAt).toLocaleString(),
  },
  {
    header: "Actor",
    accessorKey: "actor",
  },
  {
    header: "Action",
    accessorKey: "action",
  },
  {
    header: "Target",
    accessorKey: "targetTable",
  },
  {
    header: "Record ID",
    accessorKey: "targetId",
  },
  {
    header: "Summary",
    accessorKey: "summary",
    cell: ({ row }) => row.original.summary ?? "—",
  },
];

export function LogsTable({ data }: LogsTableProps) {
  const [filters, setFilters] = useState<{ actor?: string; target?: string }>(
    {},
  );

  const filteredData = useMemo(() => {
    return data.filter((event) => {
      const actorMatch = filters.actor ? event.actor === filters.actor : true;
      const targetMatch = filters.target
        ? event.targetTable === filters.target
        : true;
      return actorMatch && targetMatch;
    });
  }, [data, filters]);

  return (
    <div className="stack">
      <div className="filters">
        <label>
          <span>Actor</span>
          <input
            value={filters.actor ?? ""}
            onChange={(event) =>
              setFilters((prev) => ({
                ...prev,
                actor: event.target.value || undefined,
              }))}
            placeholder="e.g. admin:ops"
          />
        </label>
        <label>
          <span>Target table</span>
          <input
            value={filters.target ?? ""}
            onChange={(event) =>
              setFilters((prev) => ({
                ...prev,
                target: event.target.value || undefined,
              }))}
            placeholder="e.g. vouchers"
          />
        </label>
      </div>
      <DataTable
        data={filteredData}
        columns={columns}
        searchPlaceholder="Search audit log"
        globalFilterFn={(row, value) =>
          `${row.actor} ${row.action} ${row.targetTable}`.toLowerCase()
            .includes(value.toLowerCase())}
        downloadFileName="audit-log.csv"
      />
    </div>
  );
}
