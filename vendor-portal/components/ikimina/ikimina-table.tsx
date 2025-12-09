"use client";

import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";
import type { CellContext, ColumnDef } from "@tanstack/react-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { StatusChip } from "@/components/common/status-chip";
import { DataTable } from "@/src/components/common/DataTable";
import { FilterBar, type FilterChipDefinition } from "@/src/components/common/FilterBar";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/providers/i18n-provider";

export interface IkiminaTableRow {
  id: string;
  name: string;
  code: string;
  status: string;
  type: string;
  members_count: number;
  created_at: string | null;
  updated_at: string | null;
  month_total: number;
  last_payment_at: string | null;
  unallocated_count: number;
  sacco_name?: string | null;
}

interface IkiminaTableProps {
  rows: IkiminaTableRow[];
  statusOptions: string[];
  typeOptions: string[];
  saccoOptions?: string[];
  showSaccoColumn?: boolean;
}

const currencyFormatter = new Intl.NumberFormat("en-RW", {
  style: "currency",
  currency: "RWF",
  maximumFractionDigits: 0,
});

const relativeDate = (value: string | null) => {
  if (!value) return "—";
  const target = new Date(value);
  if (Number.isNaN(target.getTime())) return "—";
  const now = new Date();
  const diffMs = now.getTime() - target.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 30) return `${diffDays} days ago`;
  return target.toLocaleDateString();
};

export function IkiminaTable({
  rows,
  _statusOptions,
  _typeOptions,
  _saccoOptions,
  showSaccoColumn = false,
}: IkiminaTableProps) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("");
  const [type, setType] = useState<string>("");
  const [sacco, setSacco] = useState<string>("");

  const deferredSearch = useDeferredValue(search);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const matchesSearch = deferredSearch
        ? row.name.toLowerCase().includes(deferredSearch.toLowerCase()) ||
          row.code.toLowerCase().includes(deferredSearch.toLowerCase())
        : true;
      const matchesStatus = status ? row.status === status : true;
      const matchesType = type ? row.type === type : true;
      const matchesSacco = sacco ? row.sacco_name === sacco : true;
      return matchesSearch && matchesStatus && matchesType && matchesSacco;
    });
  }, [rows, deferredSearch, status, type, sacco]);

  const filterChips = useMemo<FilterChipDefinition[]>(() => {
    const chips: FilterChipDefinition[] = [];

    if (status) {
      chips.push({
        id: "status",
        label: t("filter.status", "Status"),
        valueLabel: status,
        active: true,
        onClear: () => setStatus(""),
        renderEditor: ({ close }) => (
          <div className="p-2">
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                close();
              }}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-neutral-0"
            >
              <option value="">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        ),
      });
    }

    if (type) {
      chips.push({
        id: "type",
        label: t("filter.type", "Type"),
        valueLabel: type,
        active: true,
        onClear: () => setType(""),
        renderEditor: ({ close }) => (
          <div className="p-2">
            <select
              value={type}
              onChange={(e) => {
                setType(e.target.value);
                close();
              }}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-neutral-0"
            >
              <option value="">All</option>
              <option value="savings">Savings</option>
              <option value="credit">Credit</option>
            </select>
          </div>
        ),
      });
    }

    if (sacco) {
      chips.push({
        id: "sacco",
        label: t("filter.sacco", "SACCO"),
        valueLabel: sacco,
        active: true,
        onClear: () => setSacco(""),
        renderEditor: () => (
          <div className="p-2">
            <Input
              value={sacco}
              onChange={(e) => setSacco(e.target.value)}
              placeholder={t("filter.saccoPlaceholder", "Enter SACCO name")}
            />
          </div>
        ),
      });
    }

    return chips;
  }, [status, type, sacco, t]);

  const columns = useMemo<ColumnDef<IkiminaTableRow, unknown>[]>(() => {
    const baseColumns: ColumnDef<IkiminaTableRow, unknown>[] = [
      showSaccoColumn
        ? {
            accessorKey: "sacco_name",
            header: () => (
              <span className="text-xs uppercase tracking-[0.3em] text-neutral-2">
                {t("table.sacco", "SACCO")}
              </span>
            ),
            cell: (info: CellContext<IkiminaTableRow, unknown>) => {
              const value = info.getValue<string | null>();
              return <span className="text-sm text-neutral-2">{value ?? "—"}</span>;
            },
            size: 180,
            meta: { align: "left" },
          }
        : undefined,
      {
        accessorKey: "name",
        header: () => (
          <span className="text-xs uppercase tracking-[0.3em] text-neutral-2">
            {t("table.name", "Name")}
          </span>
        ),
        cell: (info: CellContext<IkiminaTableRow, unknown>) => (
          <div>
            <p className="font-medium text-neutral-0">{info.row.original.name}</p>
            <p className="text-xs text-neutral-2">Code · {info.row.original.code}</p>
          </div>
        ),
        size: 260,
        meta: { pinned: "left" },
      },
      {
        accessorKey: "type",
        header: () => (
          <span className="text-xs uppercase tracking-[0.3em] text-neutral-2">
            {t("table.type", "Type")}
          </span>
        ),
        cell: (info: CellContext<IkiminaTableRow, unknown>) => (
          <span className="text-sm text-neutral-0">{String(info.getValue() ?? "—")}</span>
        ),
        size: 150,
      },
      {
        accessorKey: "members_count",
        header: () => (
          <span className="text-xs uppercase tracking-[0.3em] text-neutral-2">
            {t("table.members", "Members")}
          </span>
        ),
        cell: (info: CellContext<IkiminaTableRow, unknown>) => (
          <span className="font-semibold text-neutral-0">{String(info.getValue() ?? 0)}</span>
        ),
        size: 130,
        meta: { align: "right", cellClassName: "font-semibold" },
      },
      {
        accessorKey: "month_total",
        header: () => (
          <span className="text-xs uppercase tracking-[0.3em] text-neutral-2">
            {t("table.mtdVolume", "MTD volume")}
          </span>
        ),
        cell: (info: CellContext<IkiminaTableRow, unknown>) =>
          currencyFormatter.format(Number(info.getValue() ?? 0)),
        size: 180,
        meta: { align: "right", cellClassName: "font-semibold" },
      },
      {
        accessorKey: "last_payment_at",
        header: () => (
          <span className="text-xs uppercase tracking-[0.3em] text-neutral-2">
            {t("table.lastPayment", "Last payment")}
          </span>
        ),
        cell: (info: CellContext<IkiminaTableRow, unknown>) => (
          <span className="text-sm text-neutral-0">
            {relativeDate(info.getValue<string | null>() ?? null)}
          </span>
        ),
        size: 180,
      },
      {
        accessorKey: "unallocated_count",
        header: () => (
          <span className="text-xs uppercase tracking-[0.3em] text-neutral-2">
            {t("table.exceptions", "Exceptions")}
          </span>
        ),
        cell: (info: CellContext<IkiminaTableRow, unknown>) => {
          const value = Number(info.getValue() ?? 0);
          return (
            <span
              className={cn(
                "rounded-full px-3 py-1 text-xs uppercase tracking-[0.25em]",
                value > 0 ? "bg-amber-500/20 text-amber-200" : "bg-white/10 text-neutral-2"
              )}
            >
              {value}
            </span>
          );
        },
        size: 150,
        meta: { align: "right" },
      },
      {
        accessorKey: "status",
        header: () => (
          <span className="text-xs uppercase tracking-[0.3em] text-neutral-2">
            {t("table.status", "Status")}
          </span>
        ),
        cell: (info: CellContext<IkiminaTableRow, unknown>) => (
          <StatusChip tone="neutral">{String(info.getValue() ?? "")}</StatusChip>
        ),
        size: 150,
      },
      {
        id: "actions",
        header: () => <span className="sr-only">{t("common.actions", "Actions")}</span>,
        cell: ({ row }: CellContext<IkiminaTableRow, unknown>) => (
          <Link
            href={`/ikimina/${row.original.id}`}
            className="inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-1 text-xs uppercase tracking-[0.3em] text-neutral-0 transition hover:bg-white/10"
          >
            {t("common.open", "Open")}
          </Link>
        ),
        size: 160,
        meta: { align: "right", cellClassName: "justify-end", pinned: "right" },
      },
    ].filter(Boolean) as ColumnDef<IkiminaTableRow, unknown>[];

    return baseColumns;
  }, [showSaccoColumn, t]);

  return (
    <DataTable
      data={filteredRows}
      columns={columns}
      tableHeight={560}
      empty={
        <EmptyState
          title={t("ikimina.list.emptyTitle", "No ikimina")}
          description={t(
            "ikimina.list.emptyDescription",
            "Try adjusting filters or create a new group."
          )}
        />
      }
      filterBar={
        <FilterBar
          filters={filterChips}
          onClearAll={() => {
            setSearch("");
            setStatus("");
            setType("");
            setSacco("");
          }}
        />
      }
    />
  );
}
