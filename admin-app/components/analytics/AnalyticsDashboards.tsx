"use client";

import { useEffect, useState } from "react";
import { SectionCard } from "@/components/ui/SectionCard";

type Metrics = {
  totalAgents: number;
  totalDrivers: number;
  totalStations: number;
  monthlyRevenue: number;
};

function formatNumber(n: number) {
  try {
    return new Intl.NumberFormat("en", { maximumFractionDigits: 0 }).format(n);
  } catch {
    return String(n);
  }
}

function formatCurrency(n: number) {
  try {
    return new Intl.NumberFormat("en-RW", { style: "currency", currency: "RWF", maximumFractionDigits: 0 }).format(Math.round(n));
  } catch {
    return String(n);
  }
}

export function AnalyticsDashboards() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch("/api/v2/dashboard/metrics", { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to load metrics");
        const data = (await res.json()) as Metrics;
        if (mounted) setMetrics(data);
      } catch (_err) {
        if (mounted) setMetrics(null);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <SectionCard
      title="Analytics"
      description="Live operational metrics from Supabase tables."
    >
      <div className="grid gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4">
          <p className="text-xs text-[color:var(--color-muted)]">Agents</p>
          <p className="mt-1 text-2xl font-semibold">{loading ? "—" : formatNumber(metrics?.totalAgents ?? 0)}</p>
        </div>
        <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4">
          <p className="text-xs text-[color:var(--color-muted)]">Drivers</p>
          <p className="mt-1 text-2xl font-semibold">{loading ? "—" : formatNumber(metrics?.totalDrivers ?? 0)}</p>
        </div>
        <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4">
          <p className="text-xs text-[color:var(--color-muted)]">Stations</p>
          <p className="mt-1 text-2xl font-semibold">{loading ? "—" : formatNumber(metrics?.totalStations ?? 0)}</p>
        </div>
        <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4">
          <p className="text-xs text-[color:var(--color-muted)]">Monthly revenue</p>
          <p className="mt-1 text-2xl font-semibold">{loading ? "—" : formatCurrency(metrics?.monthlyRevenue ?? 0)}</p>
        </div>
      </div>
    </SectionCard>
  );
}
