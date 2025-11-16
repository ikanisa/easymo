"use client";

import { MetricCard } from "@/src/v2/components/dashboard/MetricCard";
import { RecentActivity } from "@/src/v2/components/dashboard/RecentActivity";
import {
  UsersIcon,
  TruckIcon,
  MapPinIcon,
  CurrencyDollarIcon,
} from "@heroicons/react/24/outline";
import { useDashboardMetrics } from "@/src/v2/lib/supabase/hooks";

export default function DashboardPage() {
  const { data: metrics } = useDashboardMetrics();

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
            icon={<UsersIcon className="h-6 w-6" aria-hidden="true" />}
            trend="+12%"
          />
          <MetricCard
            title="Active Drivers"
            value={metrics?.totalDrivers ?? 0}
            icon={<TruckIcon className="h-6 w-6" aria-hidden="true" />}
            trend="+5%"
          />
          <MetricCard
            title="Stations"
            value={metrics?.totalStations ?? 0}
            icon={<MapPinIcon className="h-6 w-6" aria-hidden="true" />}
            trend="+2%"
          />
          <MetricCard
            title="Monthly Revenue"
            value={`$${(metrics?.monthlyRevenue ?? 0).toFixed(2)}`}
            icon={<CurrencyDollarIcon className="h-6 w-6" aria-hidden="true" />}
            trend="+18%"
          />
        </div>
      </section>

      <RecentActivity />
    </section>
  );
}
