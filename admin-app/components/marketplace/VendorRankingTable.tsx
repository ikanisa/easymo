"use client";

import { useEffect, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table/DataTable";
import type { VendorRanking } from "@/lib/schemas";

interface VendorRankingTableProps {
  data: VendorRanking[];
}

export function VendorRankingTable({ data }: VendorRankingTableProps) {
  function EntitlementBadge({ tenantId, vendorId }: { tenantId: string; vendorId: string }) {
    const [info, setInfo] = useState<{ freeRemaining: number; subscribed: boolean } | null>(null);
    useEffect(() => {
      let active = true;
      (async () => {
        try {
          const res = await fetch(`/api/subscriptions/entitlements?tenantId=${encodeURIComponent(tenantId)}&vendorId=${encodeURIComponent(vendorId)}`);
          const json = await res.json();
          if (active && json?.ok && json.data) setInfo({ freeRemaining: json.data.freeRemaining, subscribed: json.data.subscribed });
        } catch (_) {
          // ignore
        }
      })();
      return () => { active = false; };
    }, [tenantId, vendorId]);
    if (!info) return <span className="text-xs text-[color:var(--color-muted)]">…</span>;
    return (
      <span className="text-xs px-2 py-0.5 rounded-full border" title={info.subscribed ? "Subscribed" : "Free quota"}>
        {info.subscribed ? "Sub" : `Free ${info.freeRemaining}`}
      </span>
    );
  }

  const columns = useMemo<ColumnDef<VendorRanking>[]>(() => [
    {
      header: "#",
      accessorKey: "rank",
      cell: ({ row }) => <span className="font-semibold">{row.index + 1}</span>,
      meta: { width: "80px" },
    },
    {
      header: "Entitlement",
      accessorKey: "entitlement",
      cell: ({ row }) => (
        <EntitlementBadge tenantId={row.original.tenantId} vendorId={row.original.vendorId} />
      ),
    },
    {
      header: "Vendor",
      accessorKey: "name",
      cell: ({ row }) => (
        <div>
          <div className="font-medium text-[color:var(--color-foreground)]">
            {row.original.name}
          </div>
          <div className="text-xs text-[color:var(--color-muted)]">
            {row.original.categories.join(", ") || "—"}
          </div>
        </div>
      ),
    },
    {
      header: "Score",
      accessorKey: "score",
      cell: ({ row }) => row.original.score.toFixed(2),
    },
    {
      header: "Rating",
      accessorKey: "rating",
      cell: ({ row }) => row.original.rating?.toFixed(1) ?? "—",
    },
    {
      header: "Fulfilment",
      accessorKey: "fulfilmentRate",
      cell: ({ row }) =>
        row.original.fulfilmentRate
          ? `${Math.round(row.original.fulfilmentRate * 100)}%`
          : "—",
    },
    {
      header: "Response",
      accessorKey: "avgResponseMs",
      cell: ({ row }) =>
        row.original.avgResponseMs ? `${Math.round(row.original.avgResponseMs / 1000)}s` : "—",
    },
    {
      header: "Trips",
      accessorKey: "totalTrips",
    },
    {
      header: "Recent",
      accessorKey: "recentTrips",
    },
    {
      header: "Balance",
      accessorKey: "balance",
      cell: ({ row }) =>
        row.original.balance != null ? `$${row.original.balance.toFixed(2)}` : "—",
    },
  ], []);

  return (
    <DataTable
      data={data}
      columns={columns}
      searchPlaceholder="Search vendors"
      globalFilterFn={(row, value) =>
        `${row.name} ${row.region}`.toLowerCase().includes(value.toLowerCase())}
      downloadFileName="vendor-ranking.csv"
    />
  );
}
