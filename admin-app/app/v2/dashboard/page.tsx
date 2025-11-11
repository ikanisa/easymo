"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/src/v2/lib/supabase/client";
import { MetricCard } from "@/src/v2/components/dashboard/MetricCard";
import { RecentActivity } from "@/src/v2/components/dashboard/RecentActivity";
import {
  UsersIcon,
  TruckIcon,
  MapPinIcon,
  CurrencyDollarIcon,
} from "@heroicons/react/24/outline";

export default function DashboardPage() {
  const supabase = createClient();

  const { data: metrics } = useQuery({
    queryKey: ["dashboard-metrics"],
    queryFn: async () => {
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const [agents, drivers, stations, transactions] = await Promise.all([
        supabase.from("agents").select("id", { count: "exact", head: true }),
        supabase.from("drivers").select("id", { count: "exact", head: true }),
        supabase.from("stations").select("id", { count: "exact", head: true }),
        supabase
          .from("transactions")
          .select("amount, created_at")
          .gte("created_at", since),
      ]);

      const totalRevenue =
        transactions.data?.reduce((sum, transaction) => sum + transaction.amount, 0) ?? 0;

      return {
        totalAgents: agents.count ?? 0,
        totalDrivers: drivers.count ?? 0,
        totalStations: stations.count ?? 0,
        monthlyRevenue: totalRevenue,
      };
    },
  });

  return (
    <section aria-labelledby="dashboard-heading" className="space-y-8">
      <header className="space-y-2">
        <p className="text-sm font-medium text-gray-500">Overview</p>
        <h1 id="dashboard-heading" className="text-2xl font-semibold text-gray-900">
          Dashboard
        </h1>
      </header>

      <section aria-labelledby="dashboard-metrics-heading" className="space-y-4">
        <h2 id="dashboard-metrics-heading" className="visually-hidden">
          Key metrics
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="Total Agents"
            value={metrics?.totalAgents ?? 0}
            icon={UsersIcon}
            trend="+12%"
          />
          <MetricCard
            title="Active Drivers"
            value={metrics?.totalDrivers ?? 0}
            icon={TruckIcon}
            trend="+5%"
          />
          <MetricCard
            title="Stations"
            value={metrics?.totalStations ?? 0}
            icon={MapPinIcon}
            trend="+2%"
          />
          <MetricCard
            title="Monthly Revenue"
            value={`$${(metrics?.monthlyRevenue ?? 0).toFixed(2)}`}
            icon={CurrencyDollarIcon}
            trend="+18%"
          />
        </div>
      </section>

      <RecentActivity />
    </section>
  );
}
