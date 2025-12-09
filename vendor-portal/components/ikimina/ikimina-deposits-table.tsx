"use client";

import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { VirtualTable } from "@/components/datagrid/virtual-table";
import { StatusChip } from "@/components/common/status-chip";
import { useTranslation } from "@/providers/i18n-provider";
import { EmptyState } from "@/components/ui/empty-state";

export interface IkiminaDepositRecord {
  id: string;
  amount: number;
  currency: string | null;
  status: string;
  occurred_at: string;
  reference: string | null;
  msisdn: string | null;
}

interface IkiminaDepositsTableProps {
  data: IkiminaDepositRecord[];
  tableHeight?: number;
}

const formatAmount = (value: number, currency?: string | null) =>
  new Intl.NumberFormat("en-RW", {
    style: "currency",
    currency: currency ?? "RWF",
    maximumFractionDigits: 0,
  }).format(value);

export function IkiminaDepositsTable({ data, tableHeight = 360 }: IkiminaDepositsTableProps) {
  const { t } = useTranslation();
  const columns = useMemo<ColumnDef<IkiminaDepositRecord>[]>(
    () => [
      {
        accessorKey: "occurred_at",
        header: () => t("table.occurred", "Occurred"),
        cell: ({ getValue }) => new Date(getValue() as string).toLocaleString(),
      },
      {
        accessorKey: "amount",
        header: () => t("table.amount", "Amount"),
        cell: ({ row }) => formatAmount(row.original.amount, row.original.currency),
        meta: { align: "right" as const },
      },
      {
        accessorKey: "reference",
        header: () => t("table.reference", "Reference"),
        cell: ({ getValue }) => (getValue() as string | null) ?? "—",
      },
      {
        accessorKey: "msisdn",
        header: () => t("table.msisdn", "MSISDN"),
        cell: ({ getValue }) => (getValue() as string | null) ?? "—",
      },
      {
        accessorKey: "status",
        header: () => t("table.status", "Status"),
        cell: ({ getValue }) => (
          <StatusChip
            tone={
              (getValue() as string) === "POSTED" || (getValue() as string) === "SETTLED"
                ? "success"
                : "warning"
            }
          >
            {getValue() as string}
          </StatusChip>
        ),
      },
    ],
    [t]
  );

  const empty = (
    <EmptyState
      tone="quiet"
      title={t("ikimina.deposits.emptyTitle", "No deposits")}
      description={t(
        "ikimina.deposits.emptyDescription",
        "Use the statement wizard to ingest CSV files."
      )}
      offlineHint={t(
        "ikimina.deposits.offlineHint",
        "Uploads queue automatically if you're offline."
      )}
    />
  );

  const dataSignature = useMemo(() => {
    if (data.length === 0) {
      return "empty";
    }
    const first = data[0]?.id ?? "none";
    const last = data[data.length - 1]?.id ?? "none";
    return `${first}:${data.length}:${last}`;
  }, [data]);

  return (
    <VirtualTable
      data={data}
      columns={columns}
      tableHeight={tableHeight}
      emptyState={empty}
      ux={{
        tableId: "ikimina.deposits",
        requestToken: dataSignature,
        context: { rowCount: data.length },
      }}
    />
  );
}
