"use client";

import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import type { DashboardSummary } from "@/lib/dashboard";
import { VirtualTable } from "@/components/datagrid/virtual-table";
import { useTranslation } from "@/providers/i18n-provider";
import { StatusChip } from "@/components/common/status-chip";
import { EmptyState } from "@/components/ui/empty-state";

interface TopIkiminaTableProps {
  data: DashboardSummary["topIkimina"];
  tableHeight?: number;
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-RW", {
    style: "currency",
    currency: "RWF",
    maximumFractionDigits: 0,
  }).format(amount);

export function TopIkiminaTable({ data, tableHeight = 260 }: TopIkiminaTableProps) {
  const { t } = useTranslation();
  const columns = useMemo<ColumnDef<DashboardSummary["topIkimina"][number]>[]>(
    () => [
      {
        accessorKey: "name",
        header: () => (
          <span className="text-xs uppercase tracking-[0.3em] text-neutral-2">
            {t("reports.table.ikimina", "Ikimina")}
          </span>
        ),
        cell: ({ row }) => (
          <div>
            <p className="font-medium text-neutral-0">{row.original.name}</p>
            <p className="text-xs text-neutral-2">Code · {row.original.code}</p>
          </div>
        ),
      },
      {
        accessorKey: "updated_at",
        header: () => (
          <span className="text-xs uppercase tracking-[0.3em] text-neutral-2">
            {t("common.updated", "Updated")}
          </span>
        ),
        cell: ({ getValue }) => {
          const value = getValue() as string | null;
          return value ? new Date(value).toLocaleDateString() : "—";
        },
      },
      {
        accessorKey: "month_total",
        header: () => (
          <span className="text-xs uppercase tracking-[0.3em] text-neutral-2">
            {t("dashboard.table.thisMonth", "This month")}
          </span>
        ),
        cell: ({ getValue }) => formatCurrency(Number(getValue() ?? 0)),
        meta: { align: "right" as const },
      },
      {
        accessorKey: "member_count",
        header: () => (
          <span className="text-xs uppercase tracking-[0.3em] text-neutral-2">
            {t("table.members", "Members")}
          </span>
        ),
        cell: ({ getValue }) => <span className="text-neutral-0">{Number(getValue() ?? 0)}</span>,
      },
      {
        accessorKey: "status",
        header: () => (
          <span className="text-xs uppercase tracking-[0.3em] text-neutral-2">
            {t("table.status", "Status")}
          </span>
        ),
        cell: ({ getValue }) => (
          <StatusChip tone="neutral">{String(getValue() ?? "UNKNOWN")}</StatusChip>
        ),
      },
    ],
    [t]
  );

  const empty = (
    <EmptyState
      title={t("dashboard.top.emptyTitle", "No ikimina activity")}
      description={t(
        "dashboard.top.emptyDescription",
        "Recent groups will show here once transactions start flowing."
      )}
    />
  );

  return (
    <VirtualTable
      data={data}
      columns={columns}
      tableHeight={tableHeight}
      emptyState={empty}
      ux={{ tableId: "dashboard.topIkimina" }}
    />
  );
}
